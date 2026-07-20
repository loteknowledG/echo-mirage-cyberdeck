"use client";

import { useEffect, useState } from "react";
import { FigletFontPreviewSlide } from "@/components/cyberdeck/figlet-font-preview-slide";
import { LiveAudioVisualizer } from "@/components/cyberdeck/live-audio-visualizer";
import { SurveyListeningSpectrum } from "@/components/cyberdeck/survey-listening-spectrum";
import { SurveyListeningSourceToggle } from "@/components/cyberdeck/survey-listening-source-toggle";
import type { PreviewDeckWithTarget } from "./preview-data";
import { SURVEY_ECHO_COMMAND, SURVEY_POWERFIST_DECK_COMMAND } from "@/lib/cyberdeck/survey-deck-data";
import { useSurveyContinuousScreenshotStatus } from "@/lib/cyberdeck/survey-continuous-screenshot.client";
import { useSurveyListeningStatus } from "@/lib/cyberdeck/survey-listening.client";
import {
  subscribeSurveyListeningSource,
  type SurveyListeningSource,
} from "@/lib/cyberdeck/survey-listening-source.client";
import {
  readMirageLocalListeningState,
  subscribeMirageLocalListening,
  type MirageLocalListeningState,
} from "@/lib/cyberdeck/mirage-local-listening.client";
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
  const echoListening = useSurveyListeningStatus();
  const [listeningSource, setListeningSource] = useState<SurveyListeningSource>("echo");
  const [mirageListening, setMirageListening] = useState<MirageLocalListeningState>(() =>
    readMirageLocalListeningState(),
  );

  useEffect(() => subscribeSurveyListeningSource(setListeningSource), []);
  useEffect(() => subscribeMirageLocalListening(setMirageListening), []);

  const isContinuousCard =
    armedCard.card.surveyCommand === SURVEY_ECHO_COMMAND.CONTINUOUS_SCREENSHOTS;
  const isListenCard =
    armedCard.card.surveyCommand === SURVEY_POWERFIST_DECK_COMMAND.LISTEN ||
    armedCard.card.surveyCommand === SURVEY_ECHO_COMMAND.START_LISTENING;
  const continuousActive = isContinuousCard && continuous.running;
  const echoLive = echoListening.armed || echoListening.listening;
  const mirageLive = mirageListening.active;
  const listeningActive =
    isListenCard &&
    (listeningSource === "mirage"
      ? mirageLive || executionResult?.ok === true
      : echoLive || executionResult?.ok === true);
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

  const liveNow =
    listeningSource === "mirage" ? mirageListening.active : echoListening.listening;

  const statusLabel = continuousActive
    ? "Live // Continuous capture"
    : listeningActive
      ? armedPanelArming === "cancel"
        ? `Stopping // Trace ×${CARD_PLAY_LAPS}`
        : liveNow
          ? `Live // ${listeningSource === "mirage" ? "Mirage mic" : "Echo mic"}`
          : `Armed // ${listeningSource === "mirage" ? "Mirage" : "Echo"} listening`
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

  const holdEnabled = !continuousActive && !executionPending;
  const sourceLocked = listeningActive && (mirageLive || echoLive);

  const sttText =
    listeningSource === "mirage"
      ? mirageListening.interim
        ? `… ${mirageListening.interim}`
        : mirageListening.transcript || "Waiting for speech…"
      : echoListening.interim
        ? `… ${echoListening.interim}`
        : echoListening.lastFinal || "Waiting for speech…";

  return (
    <section
      className={`cardOpenViewport${armedPanelArming === "cancel" ? " is-arming-cancel" : ""}${continuousActive ? " is-continuous-active" : ""}${listeningActive ? " is-listening-active" : ""}${executionPending ? " is-executing" : ""}${executionResult && !executionResult.ok ? " is-result-failed" : ""}${executionResult?.ok && !listeningActive ? " is-result-ok" : ""}`}
      data-testid="powerfist-open-card"
      onPointerDown={holdEnabled ? onArmedPanelPointerDown : undefined}
      onPointerMove={holdEnabled ? onArmedPanelPointerMove : undefined}
      onPointerUp={holdEnabled ? onCancelArmedPanelHold : undefined}
      onPointerCancel={holdEnabled ? onCancelArmedPanelHold : undefined}
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
              className={`cardArmedPanelDot${armedPanelArming === "cancel" ? " is-cancel" : ""}${executionResult && !executionResult.ok ? " is-cancel" : ""}${listeningActive ? " is-live" : ""}`}
              aria-hidden
            />
            {statusLabel}
          </div>
          <h2 className="cardOpenViewportTitle">{armedCard.card.title}</h2>
        </div>
      </div>
      <div className="cardOpenViewportBody">
        <div className="cardOpenViewportType">{armedCard.card.type}</div>
        {isListenCard ? (
          <div className="mb-2" data-armed-scroll>
            <SurveyListeningSourceToggle compact disabled={sourceLocked} />
            {!listeningActive ? (
              <p className="mt-1 text-[8px] tracking-[0.04em] text-[#5f5f5f]">
                Pick source, then hold Listen to arm. After switching source, hold Listen again.
              </p>
            ) : null}
          </div>
        ) : null}
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
        {listeningActive ? (
          <div className="survey-listening-live-panel" data-testid="survey-listening-live-panel">
            {listeningSource === "mirage" && mirageListening.mediaRecorder ? (
              <LiveAudioVisualizer
                mediaRecorder={mirageListening.mediaRecorder}
                width={320}
                height={56}
                barWidth={3}
                gap={2}
                barColor="#34d399"
                backgroundColor="#050807"
                fftSize={256}
                smoothingTimeConstant={0.5}
              />
            ) : (
              <SurveyListeningSpectrum
                active={echoListening.listening || echoListening.armed}
                level={echoListening.level}
                bands={echoListening.bands}
              />
            )}
            <p className="survey-listening-live-label">
              {liveNow ? "MIC // LIVE" : "MIC // ARMED"}
              {listeningSource === "echo" && echoListening.level > 0.02
                ? ` · ${Math.round(echoListening.level * 100)}%`
                : ""}
              {` · ${listeningSource.toUpperCase()}`}
            </p>
            <pre className="survey-listening-live-stt" data-armed-scroll data-testid="survey-listening-live-stt">
              {sttText}
            </pre>
            {listeningSource === "echo" && echoListening.lastSuggestAnswer ? (
              <pre className="survey-listening-live-suggest" data-armed-scroll>
                {echoListening.lastSuggestAnswer.slice(0, 360)}
                {echoListening.lastSuggestAnswer.length > 360 ? "…" : ""}
              </pre>
            ) : null}
            {(listeningSource === "mirage" ? mirageListening.error : echoListening.error) ? (
              <p className="survey-listening-live-error">
                {listeningSource === "mirage" ? mirageListening.error : echoListening.error}
              </p>
            ) : null}
          </div>
        ) : executionPending ? (
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
            {executionResult.answerText ? (
              <pre
                className="cardOpenViewportAnswer"
                data-armed-scroll
                data-testid="powerfist-execution-answer"
              >
                {executionResult.answerText}
              </pre>
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
          : listeningActive
            ? `Hold panel — runner ×${CARD_PLAY_LAPS} to stop listening`
            : executionPending
              ? "Hold disabled while executing…"
              : `Hold panel — runner ×${CARD_PLAY_LAPS} to cancel`}
      </p>
      {continuousActive || showComposer ? (
        <div className="cardOpenViewportActions">
          {continuousActive ? (
            <button
              type="button"
              className="push is-stop"
              onClick={handleStop}
              data-testid="survey-continuous-stop"
            >
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
