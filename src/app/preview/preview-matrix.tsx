"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import EmblaCarousel, { type EmblaCarouselType } from "embla-carousel";
import { LuPlay } from "react-icons/lu";
import { PREVIEW_DECKS } from "./preview-data";
import { scrollMatrixTo, wrapIndex } from "./preview-matrix-nav";
import "./preview-matrix.css";

export function PreviewMatrix() {
  const [activeDeckIndex, setActiveDeckIndex] = useState(0);
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [stackLogHtml, setStackLogHtml] = useState("Stack idle.");

  const matrixRef = useRef<HTMLElement>(null);
  const deckViewportRef = useRef<HTMLDivElement>(null);
  const handViewportRefs = useRef<(HTMLDivElement | null)[]>([]);
  const deckEmblaRef = useRef<EmblaCarouselType | null>(null);
  const handEmblaRefs = useRef<(EmblaCarouselType | null)[]>([]);

  const activeDeck = PREVIEW_DECKS[activeDeckIndex];
  const activeCard = activeDeck?.cards[activeCardIndex];

  const applyFocus = useCallback((deckIndex: number, cardIndex: number) => {
    const deckEmbla = deckEmblaRef.current;
    if (!deckEmbla) return;

    const deckCount = PREVIEW_DECKS.length;
    const cardCount = PREVIEW_DECKS[wrapIndex(deckIndex, deckCount)]?.cards.length ?? 0;
    const next = scrollMatrixTo(
      deckEmbla,
      handEmblaRefs.current,
      deckIndex,
      cardIndex,
      deckCount,
    );
    setActiveDeckIndex(next.deckIndex);
    setActiveCardIndex(next.cardIndex);
  }, []);

  const syncFromEmbla = useCallback(() => {
    const deckEmbla = deckEmblaRef.current;
    if (!deckEmbla) return;
    const deckIdx = deckEmbla.selectedScrollSnap();
    const handEmbla = handEmblaRefs.current[deckIdx];
    setActiveDeckIndex(deckIdx);
    setActiveCardIndex(handEmbla?.selectedScrollSnap() ?? 0);
  }, []);

  const mountCarousels = useCallback(() => {
    const deckViewport = deckViewportRef.current;
    const matrix = matrixRef.current;
    if (!deckViewport || !matrix || deckViewport.clientHeight < 8 || matrix.clientHeight < 8) {
      return false;
    }

    deckEmblaRef.current?.destroy();
    handEmblaRefs.current.forEach((embla) => embla?.destroy());
    handEmblaRefs.current = [];

    PREVIEW_DECKS.forEach((_, deckIndex) => {
      const handViewport = handViewportRefs.current[deckIndex];
      if (!handViewport) return;

      const handEmbla = EmblaCarousel(handViewport, {
        axis: "x",
        loop: true,
        align: "center",
        dragFree: false,
        containScroll: false,
      });

      handEmblaRefs.current[deckIndex] = handEmbla;

      handEmbla.on("select", () => {
        if (deckEmblaRef.current?.selectedScrollSnap() !== deckIndex) return;
        setActiveCardIndex(handEmbla.selectedScrollSnap());
      });

      handEmbla.on("settle", () => {
        if (deckEmblaRef.current?.selectedScrollSnap() !== deckIndex) return;
        setActiveCardIndex(handEmbla.selectedScrollSnap());
      });
    });

    const deckEmbla = EmblaCarousel(deckViewport, {
      axis: "y",
      loop: PREVIEW_DECKS.length > 1,
      align: "center",
      dragFree: false,
      containScroll: false,
    });

    deckEmblaRef.current = deckEmbla;
    deckEmbla.on("select", syncFromEmbla);
    deckEmbla.scrollTo(0, true);
    syncFromEmbla();
    requestAnimationFrame(() => {
      deckEmbla.reInit();
      deckEmbla.scrollTo(deckEmbla.selectedScrollSnap(), true);
      syncFromEmbla();
    });

    return true;
  }, [syncFromEmbla]);

  useLayoutEffect(() => {
    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;

    const tryMount = () => {
      if (cancelled) return false;
      return mountCarousels();
    };

    if (!tryMount()) {
      const matrix = matrixRef.current;
      if (matrix) {
        resizeObserver = new ResizeObserver(() => {
          if (tryMount()) resizeObserver?.disconnect();
        });
        resizeObserver.observe(matrix);
      }
    }

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      deckEmblaRef.current?.destroy();
      deckEmblaRef.current = null;
      handEmblaRefs.current.forEach((embla) => embla?.destroy());
      handEmblaRefs.current = [];
    };
  }, [mountCarousels]);

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
          deckEmblaRef.current.reInit();
          deckEmblaRef.current.scrollTo(deckEmblaRef.current.selectedScrollSnap(), true);
          syncFromEmbla();
        });
      },
      { threshold: 0.1 },
    );

    observer.observe(matrix);
    return () => observer.disconnect();
  }, [mountCarousels, syncFromEmbla]);

  const playFocusedCard = useCallback(() => {
    const deck = PREVIEW_DECKS[activeDeckIndex];
    const card = deck?.cards[activeCardIndex];
    if (!deck || !card) return;
    setStackLogHtml(
      `Played <strong>${card.title}</strong> from <strong>${deck.name}</strong>. Card would be pushed to Stack. Execution still blocked in prototype.`,
    );
  }, [activeDeckIndex, activeCardIndex]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const deckEmbla = deckEmblaRef.current;
      if (!deckEmbla) return;
      const handEmbla = handEmblaRefs.current[activeDeckIndex];

      if (event.key === "ArrowUp") deckEmbla.scrollPrev();
      if (event.key === "ArrowDown") deckEmbla.scrollNext();
      if (event.key === "ArrowLeft") handEmbla?.scrollPrev();
      if (event.key === "ArrowRight") handEmbla?.scrollNext();
      if (event.key === "Enter") playFocusedCard();
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [activeDeckIndex, playFocusedCard]);

  const handlePlayCard = useCallback(
    (deckIndex: number, cardIndex: number) => {
      applyFocus(deckIndex, cardIndex);
      const deck = PREVIEW_DECKS[deckIndex];
      const card = deck.cards[cardIndex];
      setStackLogHtml(
        `Played <strong>${card.title}</strong> from <strong>${deck.name}</strong>. Card would be pushed to Stack. Execution still blocked in prototype.`,
      );
    },
    [applyFocus],
  );

  return (
    <div className="powerfist-preview-root">
      <main className="shell">
        <section className="status">
          <div>
            POWERFIST MATRIX // <strong>{activeDeck?.name ?? "—"}</strong> //{" "}
            <strong>{activeCard?.title ?? "—"}</strong>
          </div>
          <div className="hint">
            Drag cards left/right, decks up/down — neighbor decks peek above/below. Arrow keys
            and buttons still work.
          </div>
        </section>

        <section className="matrix" ref={matrixRef} data-testid="preview-matrix">
          <div className="deckViewport" ref={deckViewportRef}>
            <div className="deckContainer">
              {PREVIEW_DECKS.map((deck, deckIndex) => (
                <section
                  key={deck.name}
                  className={`deckSlide${deckIndex === activeDeckIndex ? " is-selected" : ""}`}
                  data-deck-index={deckIndex}
                >
                  <header className="deckHeader">
                    <div className="deckTitle">{deck.name}</div>
                    <div className="deckBadge">{deck.badge}</div>
                  </header>

                  <div
                    className="handViewport"
                    ref={(el) => {
                      handViewportRefs.current[deckIndex] = el;
                    }}
                  >
                    <div className="handContainer">
                      {deck.cards.map((card, cardIndex) => {
                        const isSelected =
                          deckIndex === activeDeckIndex && cardIndex === activeCardIndex;
                        return (
                          <article
                            key={`${deck.name}-${card.title}`}
                            className={`cardSlide${isSelected ? " is-selected" : ""}`}
                            data-card-index={cardIndex}
                            data-testid={`card-slide-${deckIndex}-${cardIndex}`}
                          >
                            <div className="card">
                              <div className="cardTop">
                                <div className="cardType">{card.type}</div>
                                <div className="cardTitle">{card.title}</div>
                                <div className="cardPurpose">{card.purpose}</div>
                              </div>
                              <div className="cardBottom">
                                <span className={`risk ${card.risk}`}>{card.risk}</span>
                                <button
                                  type="button"
                                  className="play"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    handlePlayCard(deckIndex, cardIndex);
                                  }}
                                >
                                  Play
                                </button>
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </div>
                </section>
              ))}
            </div>
          </div>
        </section>

        <section className="controls">
          <div className="dpad" aria-label="Matrix navigation">
            <button
              type="button"
              className="dpadBtn dpadUp"
              aria-label="Previous deck"
              onClick={() => deckEmblaRef.current?.scrollPrev()}
            >
              ↑
            </button>
            <button
              type="button"
              className="dpadBtn dpadLeft"
              aria-label="Previous card"
              onClick={() => handEmblaRefs.current[activeDeckIndex]?.scrollPrev()}
            >
              ←
            </button>
            <button
              type="button"
              className="dpadBtn dpadPlay"
              aria-label="Play focused card"
              onClick={playFocusedCard}
            >
              <LuPlay aria-hidden className="dpadPlayIcon" />
            </button>
            <button
              type="button"
              className="dpadBtn dpadRight"
              aria-label="Next card"
              onClick={() => handEmblaRefs.current[activeDeckIndex]?.scrollNext()}
            >
              →
            </button>
            <button
              type="button"
              className="dpadBtn dpadDown"
              aria-label="Next deck"
              onClick={() => deckEmblaRef.current?.scrollNext()}
            >
              ↓
            </button>
          </div>
        </section>

        <section
          className="stackLog"
          dangerouslySetInnerHTML={{ __html: stackLogHtml }}
        />
      </main>
    </div>
  );
}
