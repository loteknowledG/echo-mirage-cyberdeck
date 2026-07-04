"use client";

import { useRef } from "react";
import { PowerfistRemoteLinkBanner } from "@/components/cyberdeck/powerfist-remote-link-banner";
import { ALL_PREVIEW_DECKS, type PreviewDeckWithTarget } from "./preview-data";
import { PreviewMatrixArmedPanel } from "./preview-matrix-armed-panel";
import { PreviewMatrixDeckCarousel } from "./preview-matrix-deck-carousel";
import { CARD_PLAY_TRAIL_DURATION_MS } from "./preview-matrix-play";
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
                <PreviewMatrixDeckCarousel
                  activeDecks={activeDecks}
                  activeDeckIndex={activeDeckIndex}
                  activeCardIndex={activeCardIndex}
                  armingCardKey={armingCardKey}
                  armedCardKey={armedCardKey}
                  handViewportRefs={handViewportRefs}
                  onCancelCardHold={cancelCardHold}
                  onCardPointerDown={handleCardPointerDown}
                  onCardPointerMove={handleCardPointerMove}
                />
              </div>
              {armedCard ? (
                <PreviewMatrixArmedPanel
                  armedCard={armedCard}
                  armedPanelArming={armedPanelArming}
                  armedPanelTraceKey={armedPanelTraceKey}
                  composerText={composerText}
                  onCancelArmedPanelHold={cancelArmedPanelHold}
                  onArmedPanelPointerDown={handleArmedPanelPointerDown}
                  onArmedPanelPointerMove={handleArmedPanelPointerMove}
                  onComposerTextChange={setComposerText}
                  onPushCard={handlePushCard}
                  onResetCardPlay={resetCardPlay}
                />
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
