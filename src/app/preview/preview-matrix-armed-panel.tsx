"use client";

import { FigletFontPreviewSlide } from "@/components/cyberdeck/figlet-font-preview-slide";
import type { PreviewDeckWithTarget } from "./preview-data";
import { SURVEY_ECHO_COMMAND } from "@/lib/cyberdeck/survey-deck-data";
import { useSurveyContinuousScreenshotStatus } from "@/lib/cyberdeck/survey-continuous-screenshot.client";
import {
  CARD_PLAY_TRACE_PATH,
  cardNeedsComposer,
  composerPlaceholderForArg,
} from "./preview-matrix-play";
import type { ArmedPanelArmingMode } from "./use-preview-matrix-card-play";

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
  onCancelArmedPanelHold: () => void;
  onArmedPanelPointerDown: (event: React.PointerEvent<HTMLElement>) => void;
  onArmedPanelPointerMove: (event: React.PointerEvent<HTMLElement>) => void;
  onComposerTextChange: (value: string) => void;
  onPushCard: (deckIndex: number, cardIndex: number) => void | Promise<unknown>;
  onResetCardPlay: () => void;
};

export function PreviewMatrixArmedPanel({
  armedCard,
  armedPanelArming,
  armedPanelTraceKey,
  composerText,
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

  const handlePush = () => {
    void Promise.resolve(onPushCard(armedCard.deckIndex, armedCard.cardIndex)).then((result) => {
      const keepArmed =
        result && typeof result === "object" && "keepArmed" in result
          ? Boolean((result as { keepArmed?: boolean }).keepArmed)
          : false;
      if (!keepArmed) onResetCardPlay();
    });
  };

  const handleStop = () => {
    onResetCardPlay();
  };

  return (
    <section
      className={`cardOpenViewport${armedPanelArming === "push" ? " is-arming-push" : ""}${armedPanelArming === "cancel" ? " is-arming-cancel" : ""}${continuousActive ? " is-continuous-active" : ""}`}
      data-testid="powerfist-open-card"
      onPointerDown={continuousActive ? undefined : onArmedPanelPointerDown}
      onPointerMove={continuousActive ? undefined : onArmedPanelPointerMove}
      onPointerUp={continuousActive ? undefined : onCancelArmedPanelHold}
      onPointerCancel={continuousActive ? undefined : onCancelArmedPanelHold}
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
            {continuousActive
              ? "Live // Continuous capture"
              : armedPanelArming === "cancel"
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
        {cardNeedsComposer(armedCard.card) ? (
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
                onPushCard(armedCard.deckIndex, armedCard.cardIndex);
                onResetCardPlay();
              }}
            />
          </label>
        ) : null}
      </div>
      <p className="cardOpenViewportGestureHint">
        {continuousActive
          ? "Continuous mode — Stop to disarm this card."
          : "Hold panel — clockwise trace ×2 to push · counter-clockwise red ×2 to cancel"}
      </p>
      <div className="cardOpenViewportActions">
        {continuousActive ? (
          <button type="button" className="push is-stop" onClick={handleStop} data-testid="survey-continuous-stop">
            Stop
          </button>
        ) : (
          <>
            <button type="button" className="cardClose" onClick={onResetCardPlay}>
              Close
            </button>
            <button type="button" className="push" onClick={handlePush}>
              Push
            </button>
          </>
        )}
      </div>
    </section>
  );
}
