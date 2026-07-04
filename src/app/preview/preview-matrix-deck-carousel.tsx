"use client";

import { FigletFontPreviewSlide } from "@/components/cyberdeck/figlet-font-preview-slide";
import type { MutableRefObject } from "react";
import type { PreviewDeckWithTarget } from "./preview-data";
import { CARD_PLAY_TRACE_PATH } from "./preview-matrix-play";

type PreviewMatrixDeckCarouselProps = {
  activeDecks: PreviewDeckWithTarget[];
  activeDeckIndex: number;
  activeCardIndex: number;
  armingCardKey: string | null;
  armedCardKey: string | null;
  handViewportRefs: MutableRefObject<(HTMLDivElement | null)[]>;
  onCancelCardHold: () => void;
  onCardPointerDown: (
    event: React.PointerEvent<HTMLElement>,
    deckIndex: number,
    cardIndex: number,
  ) => void;
  onCardPointerMove: (event: React.PointerEvent<HTMLElement>) => void;
};

export function PreviewMatrixDeckCarousel({
  activeDecks,
  activeDeckIndex,
  activeCardIndex,
  armingCardKey,
  armedCardKey,
  handViewportRefs,
  onCancelCardHold,
  onCardPointerDown,
  onCardPointerMove,
}: PreviewMatrixDeckCarouselProps) {
  return (
    <div className="deckContainer">
      {activeDecks.map((deck, deckIndex) => (
        <section
          key={deck.name}
          className={`deckSlide${deckIndex === activeDeckIndex ? " is-selected" : ""}`}
          data-deck-index={deckIndex}
        >
          <div
            className="handViewport"
            ref={(el) => {
              handViewportRefs.current[deckIndex] = el;
            }}
          >
            <div className="handContainer">
              {deck.cards.map((card, cardIndex) => {
                const isSelected = deckIndex === activeDeckIndex && cardIndex === activeCardIndex;
                const cardKey = `${deckIndex}:${cardIndex}`;
                const isArming = armingCardKey === cardKey;
                const isArmed = armedCardKey === cardKey;
                return (
                  <article
                    key={`${deck.name}-${card.title}`}
                    className={`cardSlide${isSelected ? " is-selected" : ""}`}
                    data-card-index={cardIndex}
                    data-testid={`card-slide-${deckIndex}-${cardIndex}`}
                    onPointerDown={(event) => onCardPointerDown(event, deckIndex, cardIndex)}
                    onPointerMove={onCardPointerMove}
                    onPointerUp={onCancelCardHold}
                    onPointerCancel={onCancelCardHold}
                  >
                    <div className={`card${isArming ? " is-arming" : ""}${isArmed ? " is-armed" : ""}`}>
                      {isArming ? (
                        <svg
                          aria-hidden
                          className="cardPlayTrace"
                          preserveAspectRatio="none"
                          viewBox="0 0 100 100"
                        >
                          <path
                            className="cardPlayTracePath"
                            d={CARD_PLAY_TRACE_PATH}
                            pathLength="1"
                          />
                        </svg>
                      ) : null}
                      <div className="cardTop">
                        <div className="cardType">{card.type}</div>
                        <div className="cardTitle">{card.title}</div>
                        {card.preview?.kind === "oneline" ? (
                          <pre className="cardArtifactPreview cardArtifactPreviewOneline">
                            {card.preview.value}
                          </pre>
                        ) : null}
                        {card.preview?.kind === "figlet" ? (
                          <div className="cardArtifactPreview cardArtifactPreviewFiglet">
                            <FigletFontPreviewSlide
                              font={card.preview.value}
                              active={isSelected}
                              loadPreview={isSelected}
                              size="lg"
                            />
                          </div>
                        ) : null}
                        <div className="cardPurpose">{card.purpose}</div>
                      </div>
                      <div className="cardBottom">
                        <span className={`risk ${card.risk}`}>{card.risk}</span>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
          <header className="deckHeader" aria-label={`${deck.name} deck`}>
            <div className="deckTitle">{deck.name}</div>
            <div className="deckBadge">{deck.badge}</div>
          </header>
        </section>
      ))}
    </div>
  );
}
