"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import EmblaCarousel, { type EmblaCarouselType } from "embla-carousel";
import { PREVIEW_DECKS } from "./preview-data";
import { resolveMatrixDrag, scrollMatrixTo, wrapIndex } from "./preview-matrix-nav";
import "./preview-matrix.css";

const DRAG_THRESHOLD_PX = 36;

export function PreviewMatrix() {
  const [activeDeckIndex, setActiveDeckIndex] = useState(0);
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [stackLogHtml, setStackLogHtml] = useState("Stack idle.");

  const matrixRef = useRef<HTMLElement>(null);
  const deckViewportRef = useRef<HTMLDivElement>(null);
  const handViewportRefs = useRef<(HTMLDivElement | null)[]>([]);
  const deckEmblaRef = useRef<EmblaCarouselType | null>(null);
  const handEmblaRefs = useRef<(EmblaCarouselType | null)[]>([]);

  const dragRef = useRef({
    active: false,
    pointerId: -1,
    startX: 0,
    startY: 0,
    startDeck: 0,
    startCard: 0,
  });

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
        dragFree: true,
        containScroll: false,
        watchDrag: false,
      });

      handEmblaRefs.current[deckIndex] = handEmbla;

      handEmbla.on("select", () => {
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
      watchDrag: false,
    });

    deckEmblaRef.current = deckEmbla;
    deckEmbla.on("select", syncFromEmbla);
    deckEmbla.scrollTo(0, true);
    syncFromEmbla();

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

  useEffect(() => {
    const matrix = matrixRef.current;
    if (!matrix) return;

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      const target = event.target as HTMLElement;
      if (target.closest(".play")) return;

      const deckEmbla = deckEmblaRef.current;
      const deckIdx = deckEmbla?.selectedScrollSnap() ?? activeDeckIndex;
      const handEmbla = handEmblaRefs.current[deckIdx];
      dragRef.current = {
        active: true,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startDeck: deckIdx,
        startCard: handEmbla?.selectedScrollSnap() ?? activeCardIndex,
      };
      matrix.setPointerCapture(event.pointerId);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!dragRef.current.active || event.pointerId !== dragRef.current.pointerId) return;
      event.preventDefault();
    };

    const onPointerUp = (event: PointerEvent) => {
      if (!dragRef.current.active || event.pointerId !== dragRef.current.pointerId) return;

      const { startX, startY, startDeck, startCard } = dragRef.current;
      dragRef.current.active = false;
      matrix.releasePointerCapture(event.pointerId);

      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      if (Math.abs(dx) < DRAG_THRESHOLD_PX && Math.abs(dy) < DRAG_THRESHOLD_PX) return;

      const deckCount = PREVIEW_DECKS.length;
      const cardCount = PREVIEW_DECKS[startDeck]?.cards.length ?? 0;
      const next = resolveMatrixDrag(startDeck, startCard, { dx, dy }, deckCount, cardCount, DRAG_THRESHOLD_PX);
      applyFocus(next.deckIndex, next.cardIndex);
    };

    const onPointerCancel = (event: PointerEvent) => {
      if (event.pointerId === dragRef.current.pointerId) {
        dragRef.current.active = false;
      }
    };

    matrix.addEventListener("pointerdown", onPointerDown, { capture: true });
    matrix.addEventListener("pointermove", onPointerMove, { capture: true });
    matrix.addEventListener("pointerup", onPointerUp, { capture: true });
    matrix.addEventListener("pointercancel", onPointerCancel, { capture: true });

    return () => {
      matrix.removeEventListener("pointerdown", onPointerDown, { capture: true });
      matrix.removeEventListener("pointermove", onPointerMove, { capture: true });
      matrix.removeEventListener("pointerup", onPointerUp, { capture: true });
      matrix.removeEventListener("pointercancel", onPointerCancel, { capture: true });
    };
  }, [activeDeckIndex, activeCardIndex, applyFocus]);

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

  const handlePeekCardClick = useCallback(
    (deckIndex: number, cardIndex: number) => {
      applyFocus(deckIndex, cardIndex);
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
            Drag on the matrix (including corner peek cards) to move diagonal. Arrow keys and
            buttons still work. Enter plays the focused card.
          </div>
        </section>

        <section className="matrix" ref={matrixRef} data-testid="preview-matrix">
          <div className="deckViewport" ref={deckViewportRef}>
            <div className="deckContainer">
              {PREVIEW_DECKS.map((deck, deckIndex) => (
                <section key={deck.name} className="deckSlide" data-deck-index={deckIndex}>
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
                            onClick={() => {
                              if (!isSelected) handlePeekCardClick(deckIndex, cardIndex);
                            }}
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
          <button type="button" onClick={() => deckEmblaRef.current?.scrollPrev()}>
            Deck ↑
          </button>
          <button type="button" onClick={() => deckEmblaRef.current?.scrollNext()}>
            Deck ↓
          </button>
          <button
            type="button"
            onClick={() => handEmblaRefs.current[activeDeckIndex]?.scrollPrev()}
          >
            Card ←
          </button>
          <button
            type="button"
            onClick={() => handEmblaRefs.current[activeDeckIndex]?.scrollNext()}
          >
            Card →
          </button>
          <button type="button" onClick={playFocusedCard}>
            Play Focused Card
          </button>
        </section>

        <section
          className="stackLog"
          dangerouslySetInnerHTML={{ __html: stackLogHtml }}
        />
      </main>
    </div>
  );
}
