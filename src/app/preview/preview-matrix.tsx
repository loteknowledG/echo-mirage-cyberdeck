"use client";

import { useRef } from "react";
import { FigletFontPreviewSlide } from "@/components/cyberdeck/figlet-font-preview-slide";
import { PowerfistRemoteLinkBanner } from "@/components/cyberdeck/powerfist-remote-link-banner";
import { ALL_PREVIEW_DECKS, type PreviewDeckWithTarget } from "./preview-data";
import {
  CARD_PLAY_TRACE_PATH,
  CARD_PLAY_TRAIL_DURATION_MS,
  cardNeedsComposer,
  composerPlaceholderForArg,
} from "./preview-matrix-play";
import { usePowerfistMatrixRemote } from "./use-powerfist-matrix-remote";
import { usePreviewMatrixCarousels } from "./use-preview-matrix-carousels";
import { usePreviewMatrixCardPlay } from "./use-preview-matrix-card-play";
import { useSurveyDeckCommands } from "./use-survey-deck-commands";
import { PowerfistJoystickControls } from "./powerfist-joystick-controls";
import "./preview-matrix.css";

export function PreviewMatrix({
  embedSurface = "page",
  decks,
  onDeckCommand,
}: {
  embedSurface?: "page" | "survey" | "rola-dex";
  decks?: PreviewDeckWithTarget[];
  onDeckCommand?: (command: string) => Promise<{ ok: boolean; message: string }>;
}) {
  const paneRef = useRef<HTMLElement>(null);
  const activeDecks = decks ?? ALL_PREVIEW_DECKS;
  const surveyCommandMode = Boolean(onDeckCommand);

  const {
    matrixRef,
    deckViewportRef,
    handViewportRefs,
    activeDeckIndex,
    activeCardIndex,
    isCompactCards,
    applyFocus,
    navigateCard,
    navigateDeck,
  } = usePreviewMatrixCarousels(activeDecks, embedSurface);

  const { remoteSocketRef, remoteSocketStatus, pairMessage } = usePowerfistMatrixRemote(
    !surveyCommandMode,
  );

  const handlePushCardRef = useRef<(deckIndex: number, cardIndex: number) => void>(() => {});

  const {
    armedCard,
    armedCardKey,
    armingCardKey,
    armedPanelArming,
    armedPanelTraceKey,
    composerText,
    setComposerText,
    cancelCardHold,
    cancelArmedPanelHold,
    resetCardPlay,
    handleCardPointerDown,
    handleCardPointerMove,
    handleArmedPanelPointerDown,
    handleArmedPanelPointerMove,
  } = usePreviewMatrixCardPlay({
    activeDecks,
    applyFocus,
    navigateCard,
    navigateDeck,
    onArmedPanelPush: (deckIndex, cardIndex) => {
      handlePushCardRef.current(deckIndex, cardIndex);
    },
  });

  const { handlePushCard, pushReceiptHtml } = useSurveyDeckCommands({
    activeDecks,
    applyFocus,
    composerText,
    setComposerText,
    onDeckCommand,
    remoteSocketRef,
  });

  handlePushCardRef.current = (deckIndex, cardIndex) => {
    void handlePushCard(deckIndex, cardIndex);
  };

  return (
    <div
      className="powerfist-preview-root"
      data-compact-cards={isCompactCards ? "true" : "false"}
      data-embed-surface={embedSurface}
      style={
        {
          "--pf-card-play-trail-ms": `${CARD_PLAY_TRAIL_DURATION_MS}ms`,
        } as React.CSSProperties
      }
    >
      <main className="shell" ref={paneRef}>
        {embedSurface !== "survey" && !surveyCommandMode ? (
          <PowerfistRemoteLinkBanner status={remoteSocketStatus} pairMessage={pairMessage} />
        ) : null}
        <div className="powerfistMainLayout">
          <section className="matrixStage">
            <section className="matrix" ref={matrixRef} data-testid="preview-matrix">
              <div className="deckViewport" ref={deckViewportRef}>
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
                            const isSelected =
                              deckIndex === activeDeckIndex && cardIndex === activeCardIndex;
                            const cardKey = `${deckIndex}:${cardIndex}`;
                            const isArming = armingCardKey === cardKey;
                            const isArmed = armedCardKey === cardKey;
                            return (
                              <article
                                key={`${deck.name}-${card.title}`}
                                className={`cardSlide${isSelected ? " is-selected" : ""}`}
                                data-card-index={cardIndex}
                                data-testid={`card-slide-${deckIndex}-${cardIndex}`}
                                onPointerDown={(event) =>
                                  handleCardPointerDown(event, deckIndex, cardIndex)
                                }
                                onPointerMove={handleCardPointerMove}
                                onPointerUp={cancelCardHold}
                                onPointerCancel={cancelCardHold}
                              >
                                <div
                                  className={`card${isArming ? " is-arming" : ""}${isArmed ? " is-armed" : ""}`}
                                >
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
              </div>
              {armedCard ? (
                <section
                  className={`cardOpenViewport${armedPanelArming === "push" ? " is-arming-push" : ""}${armedPanelArming === "cancel" ? " is-arming-cancel" : ""}`}
                  data-testid="powerfist-open-card"
                  onPointerDown={handleArmedPanelPointerDown}
                  onPointerMove={handleArmedPanelPointerMove}
                  onPointerUp={cancelArmedPanelHold}
                  onPointerCancel={cancelArmedPanelHold}
                >
                  {armedPanelArming ? (
                    <svg
                      aria-hidden
                      className={`cardPlayTrace cardOpenViewportTrace${armedPanelArming === "cancel" ? " is-cancel" : ""}`}
                      preserveAspectRatio="none"
                      viewBox="0 0 100 100"
                    >
                      <path
                        key={armedPanelTraceKey}
                        className={`cardPlayTracePath${armedPanelArming === "cancel" ? " is-reverse" : ""}`}
                        d={CARD_PLAY_TRACE_PATH}
                        pathLength="1"
                      />
                    </svg>
                  ) : null}
                  <div className="cardOpenViewportHeader">
                    <div>
                      <div className="cardArmedPanelStatus">
                        <span
                          className={`cardArmedPanelDot${armedPanelArming === "cancel" ? " is-cancel" : ""}`}
                          aria-hidden
                        />
                        {armedPanelArming === "cancel"
                          ? "Disarming // Red reverse ×2"
                          : armedPanelArming === "push"
                            ? "Arming push // Trace ×2"
                            : "Prepared // Locked"}
                      </div>
                      <h2 className="cardOpenViewportTitle">{armedCard.card.title}</h2>
                    </div>
                    <span className={`risk ${armedCard.card.risk}`}>{armedCard.card.risk}</span>
                  </div>
                  <div className="cardOpenViewportBody">
                    <div className="cardOpenViewportType">{armedCard.card.type}</div>
                    {armedCard.card.preview?.kind === "figlet" ? (
                      <div className="cardOpenViewportArtifact">
                        <FigletFontPreviewSlide
                          font={armedCard.card.preview.value}
                          active
                          loadPreview
                          size="lg"
                        />
                      </div>
                    ) : null}
                    {armedCard.card.preview?.kind === "oneline" ? (
                      <pre className="cardOpenViewportArtifact cardOpenViewportAscii">
                        {armedCard.card.preview.value}
                      </pre>
                    ) : null}
                    <p className="cardOpenViewportPurpose">{armedCard.card.purpose}</p>
                    {cardNeedsComposer(armedCard.card) ? (
                      <label className="cardOpenViewportComposer">
                        <span className="cardOpenViewportComposerLabel">
                          {armedCard.card.toolOverride?.composerArg}
                        </span>
                        <input
                          aria-label="PowerFist instruction"
                          className="powerfistMessageInput cardOpenViewportComposerInput"
                          value={composerText}
                          onChange={(event) => setComposerText(event.target.value)}
                          placeholder={composerPlaceholderForArg(
                            armedCard.card.toolOverride?.composerArg ?? "",
                          )}
                          onKeyDown={(event) => {
                            if (event.key !== "Enter") return;
                            event.preventDefault();
                            handlePushCard(armedCard.deckIndex, armedCard.cardIndex);
                            resetCardPlay();
                          }}
                        />
                      </label>
                    ) : null}
                  </div>
                  <p className="cardOpenViewportGestureHint">
                    Hold panel — clockwise trace ×2 to push · counter-clockwise red ×2 to cancel
                  </p>
                  <div className="cardOpenViewportActions">
                    <button type="button" className="cardClose" onClick={resetCardPlay}>
                      Close
                    </button>
                    <button
                      type="button"
                      className="push"
                      onClick={() => {
                        handlePushCard(armedCard.deckIndex, armedCard.cardIndex);
                        resetCardPlay();
                      }}
                    >
                      Push
                    </button>
                  </div>
                </section>
              ) : null}
              {pushReceiptHtml ? (
                <div
                  aria-live="polite"
                  className="cardPushReceipt"
                  data-testid="powerfist-push-receipt"
                  dangerouslySetInnerHTML={{ __html: pushReceiptHtml }}
                  role="status"
                />
              ) : null}
            </section>
            {!armedCardKey ? (
              <PowerfistJoystickControls
                disabled={Boolean(armedCardKey)}
                onNavigateCard={(direction) => {
                  if (!armedCardKey) navigateCard(direction);
                }}
                onNavigateDeck={(direction) => {
                  if (!armedCardKey) navigateDeck(direction);
                }}
              />
            ) : null}
          </section>
        </div>
      </main>
    </div>
  );
}
