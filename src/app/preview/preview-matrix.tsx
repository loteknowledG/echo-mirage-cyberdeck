"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import EmblaCarousel, { type EmblaCarouselType } from "embla-carousel";
import { PREVIEW_DECKS } from "./preview-data";
import "./preview-matrix.css";

export function PreviewMatrix() {
  const [activeDeckIndex, setActiveDeckIndex] = useState(0);
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [stackLogHtml, setStackLogHtml] = useState("Stack idle.");

  const deckViewportRef = useRef<HTMLDivElement>(null);
  const handViewportRefs = useRef<(HTMLDivElement | null)[]>([]);
  const deckEmblaRef = useRef<EmblaCarouselType | null>(null);
  const handEmblaRefs = useRef<(EmblaCarouselType | null)[]>([]);

  const activeDeck = PREVIEW_DECKS[activeDeckIndex];
  const activeCard = activeDeck?.cards[activeCardIndex];

  const playFocusedCard = useCallback(() => {
    const deck = PREVIEW_DECKS[activeDeckIndex];
    const card = deck?.cards[activeCardIndex];
    if (!deck || !card) return;
    setStackLogHtml(
      `Played <strong>${card.title}</strong> from <strong>${deck.name}</strong>. Card would be pushed to Stack. Execution still blocked in prototype.`,
    );
  }, [activeDeckIndex, activeCardIndex]);

  useEffect(() => {
    const viewport = deckViewportRef.current;
    if (!viewport) return;

    const deckEmbla = EmblaCarousel(viewport, {
      axis: "y",
      loop: true,
      align: "center",
      dragFree: false,
      containScroll: false,
    });

    deckEmblaRef.current = deckEmbla;

    const onDeckSelect = () => {
      const deckIdx = deckEmbla.selectedScrollSnap();
      setActiveDeckIndex(deckIdx);
      const handEmbla = handEmblaRefs.current[deckIdx];
      const cardIdx = handEmbla?.selectedScrollSnap() ?? 0;
      setActiveCardIndex(cardIdx);
    };

    deckEmbla.on("select", onDeckSelect);

    return () => {
      deckEmbla.off("select", onDeckSelect);
      deckEmbla.destroy();
      deckEmblaRef.current = null;
    };
  }, []);

  useLayoutEffect(() => {
    const cleanups: (() => void)[] = [];

    PREVIEW_DECKS.forEach((_, deckIndex) => {
      const viewport = handViewportRefs.current[deckIndex];
      if (!viewport) return;

      const handEmbla = EmblaCarousel(viewport, {
        axis: "x",
        loop: true,
        align: "center",
        dragFree: true,
        containScroll: false,
      });

      handEmblaRefs.current[deckIndex] = handEmbla;

      const onHandSelect = () => {
        if (deckEmblaRef.current?.selectedScrollSnap() !== deckIndex) return;
        setActiveCardIndex(handEmbla.selectedScrollSnap());
      };

      handEmbla.on("select", onHandSelect);
      cleanups.push(() => {
        handEmbla.off("select", onHandSelect);
        handEmbla.destroy();
        handEmblaRefs.current[deckIndex] = null;
      });
    });

    return () => {
      cleanups.forEach((fn) => fn());
    };
  }, []);

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
      deckEmblaRef.current?.scrollTo(deckIndex);
      handEmblaRefs.current[deckIndex]?.scrollTo(cardIndex);
      setActiveDeckIndex(deckIndex);
      setActiveCardIndex(cardIndex);
      const deck = PREVIEW_DECKS[deckIndex];
      const card = deck.cards[cardIndex];
      setStackLogHtml(
        `Played <strong>${card.title}</strong> from <strong>${deck.name}</strong>. Card would be pushed to Stack. Execution still blocked in prototype.`,
      );
    },
    [],
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
            Use Arrow Up/Down to switch decks. Arrow Left/Right to choose cards. Enter plays the
            focused card.
          </div>
        </section>

        <section className="matrix">
          <div className="deckViewport" ref={deckViewportRef}>
            <div className="deckContainer">
              {PREVIEW_DECKS.map((deck, deckIndex) => (
                <section
                  key={deck.name}
                  className="deckSlide"
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
                                  onClick={() => handlePlayCard(deckIndex, cardIndex)}
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
          // Prototype used innerHTML for stack log emphasis
          dangerouslySetInnerHTML={{ __html: stackLogHtml }}
        />
      </main>
    </div>
  );
}
