"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
  type MutableRefObject,
} from "react";
import EmblaCarousel, { type EmblaCarouselType } from "embla-carousel";
import { ensurePickerSnappedToCenter } from "@/lib/embla-ios-picker-loop";
import type { PreviewDeckWithTarget } from "./preview-data";
import { scrollMatrixTo } from "./preview-matrix-nav";
import { attachMatrixGrabCursor } from "./preview-matrix-play";

type PreviewMatrixEmbedSurface = "page" | "survey" | "rola-dex";

export type PreviewMatrixCarousels = {
  matrixRef: RefObject<HTMLElement>;
  deckViewportRef: RefObject<HTMLDivElement>;
  handViewportRefs: MutableRefObject<(HTMLDivElement | null)[]>;
  activeDeckIndex: number;
  activeCardIndex: number;
  isCompactCards: boolean;
  applyFocus: (deckIndex: number, cardIndex: number) => void;
  navigateCard: (direction: 1 | -1) => void;
  navigateDeck: (direction: 1 | -1) => void;
};

export function usePreviewMatrixCarousels(
  activeDecks: PreviewDeckWithTarget[],
  embedSurface: PreviewMatrixEmbedSurface,
): PreviewMatrixCarousels {
  const [activeDeckIndex, setActiveDeckIndex] = useState(0);
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [isCompactCards, setIsCompactCards] = useState(false);

  const matrixRef = useRef<HTMLElement>(null);
  const deckViewportRef = useRef<HTMLDivElement>(null);
  const handViewportRefs = useRef<(HTMLDivElement | null)[]>([]);
  const deckEmblaRef = useRef<EmblaCarouselType | null>(null);
  const handEmblaRefs = useRef<(EmblaCarouselType | null)[]>([]);
  const activeDeckIndexRef = useRef(activeDeckIndex);
  const activeCardIndexRef = useRef(activeCardIndex);

  const setActiveFocus = useCallback((deckIndex: number, cardIndex: number) => {
    activeDeckIndexRef.current = deckIndex;
    activeCardIndexRef.current = cardIndex;
    setActiveDeckIndex(deckIndex);
    setActiveCardIndex(cardIndex);
  }, []);

  const syncFromEmbla = useCallback(() => {
    const deckEmbla = deckEmblaRef.current;
    if (!deckEmbla) return;
    const deckIdx = deckEmbla.selectedScrollSnap();
    const handEmbla = handEmblaRefs.current[deckIdx];
    setActiveFocus(deckIdx, handEmbla?.selectedScrollSnap() ?? 0);
  }, [setActiveFocus]);

  const recenterSelectedCard = useCallback(() => {
    const deckEmbla = deckEmblaRef.current;
    if (!deckEmbla) return;
    const deckCount = activeDecks.length;
    if (deckCount < 1) return;

    deckEmbla.reInit();
    handEmblaRefs.current.forEach((embla) => embla?.reInit());

    const next = scrollMatrixTo(
      deckEmbla,
      handEmblaRefs.current,
      activeDeckIndexRef.current,
      activeCardIndexRef.current,
      deckCount,
      { jump: true },
    );
    setActiveFocus(next.deckIndex, next.cardIndex);
  }, [activeDecks, setActiveFocus]);

  const applyFocus = useCallback(
    (deckIndex: number, cardIndex: number) => {
      const deckEmbla = deckEmblaRef.current;
      if (!deckEmbla) return;

      const deckCount = activeDecks.length;
      const next = scrollMatrixTo(
        deckEmbla,
        handEmblaRefs.current,
        deckIndex,
        cardIndex,
        deckCount,
      );
      setActiveFocus(next.deckIndex, next.cardIndex);
    },
    [activeDecks, setActiveFocus],
  );

  const mountCarousels = useCallback(() => {
    const deckViewport = deckViewportRef.current;
    const matrix = matrixRef.current;
    if (!deckViewport || !matrix || deckViewport.clientHeight < 8 || matrix.clientHeight < 8) {
      return false;
    }

    deckEmblaRef.current?.destroy();
    handEmblaRefs.current.forEach((embla) => embla?.destroy());
    handEmblaRefs.current = [];

    activeDecks.forEach((_, deckIndex) => {
      const handViewport = handViewportRefs.current[deckIndex];
      if (!handViewport) return;

      const handEmbla = EmblaCarousel(handViewport, {
        axis: "x",
        loop: true,
        align: "center",
        dragFree: true,
        skipSnaps: false,
        containScroll: false,
      });

      handEmblaRefs.current[deckIndex] = handEmbla;
      attachMatrixGrabCursor(handEmbla, handViewport);

      handEmbla.on("select", () => {
        if (deckEmblaRef.current?.selectedScrollSnap() !== deckIndex) return;
        const nextCardIndex = handEmbla.selectedScrollSnap();
        activeCardIndexRef.current = nextCardIndex;
        setActiveCardIndex(nextCardIndex);
      });

      handEmbla.on("settle", () => {
        if (deckEmblaRef.current?.selectedScrollSnap() !== deckIndex) return;
        if (ensurePickerSnappedToCenter(handEmbla)) return;
        const nextCardIndex = handEmbla.selectedScrollSnap();
        activeCardIndexRef.current = nextCardIndex;
        setActiveCardIndex(nextCardIndex);
      });
    });

    const deckEmbla = EmblaCarousel(deckViewport, {
      axis: "y",
      loop: true,
      align: "center",
      dragFree: false,
      containScroll: false,
      duration: 30,
    });

    deckEmblaRef.current = deckEmbla;
    attachMatrixGrabCursor(deckEmbla, deckViewport);
    deckEmbla.on("select", syncFromEmbla);
    deckEmbla.on("settle", syncFromEmbla);
    const next = scrollMatrixTo(
      deckEmbla,
      handEmblaRefs.current,
      activeDeckIndexRef.current,
      activeCardIndexRef.current,
      activeDecks.length,
      { jump: true },
    );
    setActiveFocus(next.deckIndex, next.cardIndex);

    return true;
  }, [activeDecks, setActiveFocus, syncFromEmbla]);

  useLayoutEffect(() => {
    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;

    const syncCarousels = () => {
      if (cancelled) return;
      if (deckEmblaRef.current) {
        deckEmblaRef.current.reInit();
        handEmblaRefs.current.forEach((embla) => embla?.reInit());
        const deckCount = activeDecks.length;
        if (deckCount < 1) return;
        const next = scrollMatrixTo(
          deckEmblaRef.current,
          handEmblaRefs.current,
          activeDeckIndexRef.current,
          activeCardIndexRef.current,
          deckCount,
          { jump: true },
        );
        setActiveFocus(next.deckIndex, next.cardIndex);
        return;
      }
      mountCarousels();
    };

    syncCarousels();

    const matrix = matrixRef.current;
    if (matrix) {
      resizeObserver = new ResizeObserver(() => syncCarousels());
      resizeObserver.observe(matrix);
    }

    const retryTimers =
      embedSurface === "survey"
        ? [120, 400, 1200, 2400].map((ms) =>
            window.setTimeout(() => {
              if (!cancelled) syncCarousels();
            }, ms),
          )
        : [];

    return () => {
      cancelled = true;
      for (const timer of retryTimers) {
        window.clearTimeout(timer);
      }
      resizeObserver?.disconnect();
      deckEmblaRef.current?.destroy();
      deckEmblaRef.current = null;
      handEmblaRefs.current.forEach((embla) => embla?.destroy());
      handEmblaRefs.current = [];
    };
  }, [activeDecks, embedSurface, mountCarousels, setActiveFocus]);

  useEffect(() => {
    const matrix = matrixRef.current;
    if (!matrix) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        requestAnimationFrame(() => {
          if (!deckEmblaRef.current) {
            mountCarousels();
            return;
          }
          syncFromEmbla();
        });
      },
      { threshold: 0.1 },
    );

    observer.observe(matrix);
    return () => observer.disconnect();
  }, [mountCarousels, syncFromEmbla]);

  useEffect(() => {
    const matrix = matrixRef.current;
    const deckViewport = deckViewportRef.current;
    if (!matrix || !deckViewport) return;

    let raf = 0;
    const onResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        setIsCompactCards(matrix.clientWidth <= 520);
        recenterSelectedCard();
      });
    };

    const observer = new ResizeObserver(onResize);
    observer.observe(matrix);
    observer.observe(deckViewport);

    const activeHandViewport = handViewportRefs.current[activeDeckIndex];
    if (activeHandViewport) observer.observe(activeHandViewport);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [activeDeckIndex, recenterSelectedCard]);

  useEffect(() => {
    const matrix = matrixRef.current;
    if (!matrix) return;
    setIsCompactCards(matrix.clientWidth <= 520);
    const raf = requestAnimationFrame(() => recenterSelectedCard());
    return () => cancelAnimationFrame(raf);
  }, [isCompactCards, recenterSelectedCard]);

  const navigateCard = useCallback(
    (direction: 1 | -1) => {
      const deckIndex = activeDeckIndexRef.current;
      const deck = activeDecks[deckIndex];
      if (!deck || deck.cards.length < 1) return;

      const handEmbla = handEmblaRefs.current[deckIndex];
      if (!handEmbla) return;
      if (direction < 0) handEmbla.scrollPrev();
      else handEmbla.scrollNext();
    },
    [activeDecks],
  );

  const navigateDeck = useCallback(
    (direction: 1 | -1) => {
      const deckEmbla = deckEmblaRef.current;
      if (!deckEmbla) return;
      if (direction < 0) deckEmbla.scrollNext();
      else deckEmbla.scrollPrev();
      syncFromEmbla();
    },
    [syncFromEmbla],
  );

  return {
    matrixRef,
    deckViewportRef,
    handViewportRefs,
    activeDeckIndex,
    activeCardIndex,
    isCompactCards,
    applyFocus,
    navigateCard,
    navigateDeck,
  };
}
