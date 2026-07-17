"use client";

import { FigletFontPreviewSlide } from "@/components/cyberdeck/figlet-font-preview-slide";
import type { PreviewDeckWithTarget } from "./preview-data";
import { SURVEY_ECHO_COMMAND } from "@/lib/cyberdeck/survey-deck-data";
import { useSurveyContinuousScreenshotStatus } from "@/lib/cyberdeck/survey-continuous-screenshot.client";
import {
  CARD_PLAY_LAPS,
  CARD_PLAY_TRACE_PATH,
  cardNeedsComposer,
  composerPlaceholderForArg,
} from "./preview-matrix-play";
import type {
  ArmedPanelArmingMode,
  CardExecutionResult,
} from "./use-preview-matrix-card-play";

type ArmedCard = {
  card: PreviewDeckWithTarget["cards"][number];
  cardIndex: number;
  deck: PreviewDeckWithTarget;
  deckIndex: number;
};

type PreviewMatrixArmedPanelProps = {
  armedCard: ArmedCard;
  armedPanelArming: ArmedPanelArmingMode | null;
  armedPanelTraceKey: number;
  composerText: string;
  executionPending?: boolean;
  executionResult?: CardExecutionResult | null;
  onCancelArmedPanelHold: () => void;
  onArmedPanelPointerDown: (event: React.PointerEvent<HTMLElement>) => void;
  onArmedPanelPointerMove: (event: React.PointerEvent<HTMLElement>) => void;
  onComposerTextChange: (value: string) => void;
  onPushCard: (
    deckIndex: number,
    cardIndex: number,
  ) => void | Promise<CardExecutionResult | unknown>;
  onResetCardPlay: () => void;
};

export function PreviewMatrixArmedPanel({
  armedCard,
  armedPanelArming,
  armedPanelTraceKey,
  composerText,
  executionPending = false,
  executionResult = null,
  onCancelArmedPanelHold,
  onArmedPanelPointerDown,
  onArmedPanelPointerMove,
  onComposerTextChange,
  onPushCard,
  onResetCardPlay,
}: PreviewMatrixArmedPanelProps) {
  const continuous = useSurveyContinuousScreenshotStatus();
  const isContinuousCard =
    armedCard.card.surveyCommand === SURVEY_ECHO_COMMAND.CONTINUOUS_SCREENSHOTS;
  const continuousActive = isContinuousCard && continuous.running;
  const needsComposer = cardNeedsComposer(armedCard.card);
  const showComposer = needsComposer && !executionResult && !executionPending;

  const handlePush = () => {
    void Promise.resolve(onPushCard(armedCard.deckIndex, armedCard.cardIndex)).then((result) => {
      const keepArmed =
        result && typeof result === "object" && "keepArmed" in result
          ? Boolean((result as { keepArmed?: boolean }).keepArmed)
          : true;
      if (!keepArmed) onResetCardPlay();
    });
  };

  const handleStop = () => {
    onResetCardPlay();
  };

  const statusLabel = continuousActive
    ? "Live // Continuous capture"
    : armedPanelArming === "cancel"
      ? `Canceling // Trace ×${CARD_PLAY_LAPS}`
      : executionPending
        ? "Executing…"
        : executionResult
          ? executionResult.ok
            ? "Result // Complete"
            : "Result // Failed"
          : showComposer
            ? "Prepared // Enter argument"
            : "Prepared // Locked";

  return (
    <section
      className={`cardOpenViewport${armedPanelArming === "cancel" ? " is-arming-cancel" : ""}${continuousActive ? " is-continuous-active" : ""}${executionPending ? " is-executing" : ""}${executionResult && !executionResult.ok ? " is-result-failed" : ""}${executionResult?.ok ? " is-result-ok" : ""}`}
      data-testid="powerfist-open-card"
      onPointerDown={continuousActive || executionPending ? undefined : onArmedPanelPointerDown}
      onPointerMove={continuousActive || executionPending ? undefined : onArmedPanelPointerMove}
      onPointerUp={continuousActive || executionPending ? undefined : onCancelArmedPanelHold}
      onPointerCancel={continuousActive || executionPending ? undefined : onCancelArmedPanelHold}
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
              className={`cardArmedPanelDot${armedPanelArming === "cancel" ? " is-cancel" : ""}${executionResult && !executionResult.ok ? " is-cancel" : ""}`}
              aria-hidden
            />
            {statusLabel}
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
        {executionPending ? (
          <p className="cardOpenViewportPurpose" data-testid="powerfist-execution-pending">
            Running {armedCard.card.title}…
          </p>
        ) : executionResult ? (
          <>
            {executionResult.imageDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- local capture preview
              <img
                className="cardOpenViewportResultImage"
                src={executionResult.imageDataUrl}
                alt={`${armedCard.card.title} capture`}
                data-testid="powerfist-execution-result-image"
              />
            ) : null}
            <p
              className={`cardOpenViewportPurpose cardOpenViewportResult${executionResult.ok ? " is-ok" : " is-fail"}`}
              data-testid="powerfist-execution-result"
            >
              {executionResult.message}
            </p>
          </>
        ) : (
          <p className="cardOpenViewportPurpose">{armedCard.card.purpose}</p>
        )}
        {continuousActive ? (
          <div className="survey-continuous-shot-panel" data-testid="survey-continuous-shot-panel">
            <p className="survey-continuous-shot-label">
              {continuous.phase === "capturing"
                ? "CAPTURING…"
                : continuous.countdown != null
                  ? `NEXT SHOT IN ${continuous.countdown}`
                  : "ARMED"}
            </p>
            {continuous.countdown != null ? (
              <p className="survey-continuous-shot-countdown" aria-live="polite">
                {continuous.countdown}
              </p>
            ) : null}
            <p className="survey-continuous-shot-meta">
              {continuous.shotCount} shot{continuous.shotCount === 1 ? "" : "s"} · {continuous.message}
            </p>
          </div>
        ) : null}
        {showComposer ? (
          <label className="cardOpenViewportComposer">
            <span className="cardOpenViewportComposerLabel">
              {armedCard.card.toolOverride?.composerArg}
            </span>
            <input
              aria-label="PowerFist instruction"
              className="powerfistMessageInput cardOpenViewportComposerInput"
              value={composerText}
              onChange={(event) => onComposerTextChange(event.target.value)}
              placeholder={composerPlaceholderForArg(
                armedCard.card.toolOverride?.composerArg ?? "",
              )}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                handlePush();
              }}
            />
          </label>
        ) : null}
      </div>
      <p className="cardOpenViewportGestureHint">
        {continuousActive
          ? "Continuous mode — Stop to disarm this card."
          : executionPending
            ? "Hold disabled while executing…"
            : `Hold panel — runner ×${CARD_PLAY_LAPS} to cancel`}
      </p>
      {continuousActive || showComposer ? (
        <div className="cardOpenViewportActions">
          {continuousActive ? (
            <button type="button" className="push is-stop" onClick={handleStop} data-testid="survey-continuous-stop">
              Stop
            </button>
          ) : (
            <button type="button" className="push" onClick={handlePush}>
              Push
            </button>
          )}
        </div>
      ) : null}
    </section>
  );
}
