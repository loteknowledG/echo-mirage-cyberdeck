"use client";

import { useRef } from "react";
import { PowerfistRemoteLinkBanner } from "@/components/cyberdeck/powerfist-remote-link-banner";
import { ALL_PREVIEW_DECKS, type PreviewDeckWithTarget } from "./preview-data";
import { PreviewMatrixArmedPanel } from "./preview-matrix-armed-panel";
import { PreviewMatrixDeckCarousel } from "./preview-matrix-deck-carousel";
import { PowerfistJoystickControls } from "./powerfist-joystick-controls";
import { CARD_PLAY_TRAIL_DURATION_MS } from "./preview-matrix-play";
import { usePowerfistMatrixRemote } from "./use-powerfist-matrix-remote";
import { usePreviewMatrixCarousels } from "./use-preview-matrix-carousels";
import { usePreviewMatrixCardPlay } from "./use-preview-matrix-card-play";
import { useSurveyDeckCommands } from "./use-survey-deck-commands";
import { stopSurveyContinuousScreenshot } from "@/lib/cyberdeck/survey-continuous-screenshot.client";
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

  const handlePushCardRef = useRef<
    (deckIndex: number, cardIndex: number) => Promise<{ ok: boolean; message: string; keepArmed?: boolean }>
  >(async () => ({ ok: false, message: "Not ready." }));

  const {
    armedCard,
    armedCardKey,
    armingCardKey,
    armedPanelArming,
    armedPanelTraceKey,
    composerText,
    setComposerText,
    executionPending,
    executionResult,
    setExecutionResult,
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
    onExecuteCard: (deckIndex, cardIndex) => handlePushCardRef.current(deckIndex, cardIndex),
  });

  const { handlePushCard } = useSurveyDeckCommands({
    activeDecks,
    applyFocus,
    composerText,
    setComposerText,
    onDeckCommand,
    remoteSocketRef,
  });

  handlePushCardRef.current = async (deckIndex, cardIndex) => {
    const result = await handlePushCard(deckIndex, cardIndex);
    // Keep the large card open so it can show the execution result (cancel with ×3 hold).
    return { ...result, keepArmed: result.keepArmed ?? true };
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
                  executionPending={executionPending}
                  executionResult={executionResult}
                  onCancelArmedPanelHold={cancelArmedPanelHold}
                  onArmedPanelPointerDown={handleArmedPanelPointerDown}
                  onArmedPanelPointerMove={handleArmedPanelPointerMove}
                  onComposerTextChange={setComposerText}
                  onPushCard={async (deckIndex, cardIndex) => {
                    const result = await handlePushCardRef.current(deckIndex, cardIndex);
                    setExecutionResult(result);
                    return result;
                  }}
                  onResetCardPlay={() => {
                    stopSurveyContinuousScreenshot();
                    resetCardPlay();
                  }}
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
