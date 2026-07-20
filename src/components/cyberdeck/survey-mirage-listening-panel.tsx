"use client";

import { useCallback, useEffect, useState } from "react";
import { CyberdeckActionButton } from "@/components/cyberdeck/cyberdeck-control-button";
import { LiveAudioVisualizer } from "@/components/cyberdeck/live-audio-visualizer";
import { SurveyListeningSourceToggle } from "@/components/cyberdeck/survey-listening-source-toggle";
import { SurveyListeningSpectrum } from "@/components/cyberdeck/survey-listening-spectrum";
import {
  executeSurveyDeckCommand,
  resolveSurveyEchoDeckContext,
} from "@/lib/cyberdeck/survey-deck-command.client";
import { SURVEY_ECHO_COMMAND } from "@/lib/cyberdeck/survey-deck-data";
import {
  clearSurveyListeningTranscript,
  useSurveyListeningStatus,
} from "@/lib/cyberdeck/survey-listening.client";
import {
  subscribeSurveyListeningSource,
  type SurveyListeningSource,
} from "@/lib/cyberdeck/survey-listening-source.client";
import { solveMirageSelectedTextAsync } from "@/lib/cyberdeck/survey-mirage-item-queue.client";
import { useMirageLocalListening } from "@/lib/cyberdeck/use-mirage-local-listening";
import { stopMirageLocalListening } from "@/lib/cyberdeck/mirage-local-listening.client";
import { SURVEY_ECHO_DISPLAY } from "@/lib/cyberdeck/survey-mode";

/**
 * Mirage Survey LISTENING tab — Start/Stop, source toggle (Echo | Mirage), STT, Solve.
 */
export function SurveyMirageListeningPanel() {
  const mirage = useMirageLocalListening();
  const echo = useSurveyListeningStatus();
  const [source, setSource] = useState<SurveyListeningSource>("echo");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [advice, setAdvice] = useState("");
  const [solveError, setSolveError] = useState("");

  useEffect(() => subscribeSurveyListeningSource(setSource), []);

  const active = source === "mirage" ? mirage.active : echo.armed || echo.listening;
  const transcript =
    source === "mirage"
      ? mirage.displayText || mirage.transcript
      : [echo.lastFinal, echo.interim].filter(Boolean).join(echo.interim ? " … " : "").trim();
  const interim = source === "mirage" ? mirage.interim : echo.interim;
  const finals = source === "mirage" ? mirage.transcript : echo.lastFinal;
  const error = source === "mirage" ? mirage.error : echo.error;

  const handleStart = useCallback(async () => {
    setBusy(true);
    setSolveError("");
    if (source === "mirage") {
      setStatus("Requesting Mirage microphone…");
      void executeSurveyDeckCommand(
        SURVEY_ECHO_COMMAND.STOP_LISTENING,
        resolveSurveyEchoDeckContext(),
      ).catch(() => undefined);
      const result = await mirage.start();
      setBusy(false);
      setStatus(result.message);
      return;
    }
    setStatus(`Arming ${SURVEY_ECHO_DISPLAY} listening…`);
    stopMirageLocalListening();
    const result = await executeSurveyDeckCommand(
      SURVEY_ECHO_COMMAND.START_LISTENING,
      resolveSurveyEchoDeckContext(),
    );
    setBusy(false);
    if (!result.ok) {
      setSolveError(result.message);
      setStatus("");
      return;
    }
    setStatus(result.message);
  }, [mirage, source]);

  const handleStop = useCallback(async () => {
    setBusy(true);
    if (source === "mirage") {
      const result = mirage.stop();
      setBusy(false);
      setStatus(result.message);
      return;
    }
    const result = await executeSurveyDeckCommand(
      SURVEY_ECHO_COMMAND.STOP_LISTENING,
      resolveSurveyEchoDeckContext(),
    );
    setBusy(false);
    setStatus(result.message);
  }, [mirage, source]);

  const handleSolve = useCallback(async () => {
    const text = transcript;
    if (!text.trim()) {
      setSolveError("No transcript yet — start listening and speak first.");
      setAdvice("");
      return;
    }
    setBusy(true);
    setSolveError("");
    setStatus("SOLVE // reading transcript…");
    const result = await solveMirageSelectedTextAsync(text);
    setBusy(false);
    if (!result.ok) {
      setSolveError(result.message);
      setStatus("");
      return;
    }
    setAdvice(result.answerText?.trim() || result.message);
    setStatus(result.message || "Advice ready.");
  }, [transcript]);

  const handleClear = useCallback(() => {
    if (source === "mirage") {
      mirage.clearTranscript();
    } else {
      clearSurveyListeningTranscript();
    }
    setAdvice("");
    setSolveError("");
    setStatus("Transcript cleared.");
  }, [mirage, source]);

  return (
    <div className="flex flex-col gap-3" data-testid="survey-mirage-listening-panel">
      <div className="rounded-sm border border-[#1c1c1c] bg-black/70 p-3">
        <div className="mb-2 text-[9px] tracking-[0.08em] text-[#8a8a8a]">
          LISTENING // source → live STT → solve advice
        </div>
        <SurveyListeningSourceToggle className="mb-3" disabled={busy || active} />
        <p className="mb-3 text-[9px] leading-relaxed tracking-[0.04em] text-[#5f5f5f]">
          {source === "mirage"
            ? "MIRAGE uses this device microphone and browser speech recognition."
            : `ECHO uses ${SURVEY_ECHO_DISPLAY} Satellite mic STT (relay / LAN poll).`}
        </p>

        <div className="mb-3 overflow-hidden rounded-sm border border-[#1c1c1c] bg-black/80 px-2 py-3">
          {source === "mirage" && mirage.mediaRecorder && mirage.active ? (
            <LiveAudioVisualizer
              mediaRecorder={mirage.mediaRecorder}
              width={480}
              height={72}
              barWidth={3}
              gap={2}
              barColor="#34d399"
              backgroundColor="#050807"
              fftSize={256}
              smoothingTimeConstant={0.5}
            />
          ) : source === "echo" && (echo.armed || echo.listening) ? (
            <SurveyListeningSpectrum
              active={echo.listening || echo.armed}
              level={echo.level}
              bands={echo.bands}
            />
          ) : (
            <div
              className="flex h-[72px] items-center justify-center text-[9px] tracking-[0.1em] text-[#4a4a4a]"
              data-testid="mirage-listening-visualizer-idle"
            >
              WAVEFORM // idle — press Start Listening
            </div>
          )}
          <p className="mt-2 text-center text-[9px] tracking-[0.1em] text-[#6a6a6a]">
            {active ? `MIC // LIVE · ${source.toUpperCase()}` : "MIC // STANDBY"}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <CyberdeckActionButton
            disabled={busy || active}
            onClick={() => void handleStart()}
            data-testid="survey-mirage-listening-start"
          >
            START LISTENING
          </CyberdeckActionButton>
          <CyberdeckActionButton
            disabled={busy || !active}
            onClick={() => void handleStop()}
            data-testid="survey-mirage-listening-stop"
          >
            STOP LISTENING
          </CyberdeckActionButton>
          <CyberdeckActionButton
            disabled={busy || !transcript}
            onClick={() => void handleSolve()}
            data-testid="survey-mirage-listening-solve"
          >
            SOLVE
          </CyberdeckActionButton>
          <CyberdeckActionButton
            disabled={busy}
            onClick={handleClear}
            data-testid="survey-mirage-listening-clear"
          >
            CLEAR
          </CyberdeckActionButton>
        </div>

        {status ? <p className="mt-2 text-[9px] text-[#9a9a9a]">{status}</p> : null}
        {error ? (
          <p className="mt-2 text-[9px] text-red-400/90" data-testid="survey-mirage-listening-error">
            {error}
          </p>
        ) : null}
        {solveError ? <p className="mt-2 text-[9px] text-red-400/90">{solveError}</p> : null}
      </div>

      <div
        className="rounded-sm border border-[#1c1c1c] bg-black/70 p-3"
        data-testid="survey-mirage-listening-stt"
      >
        <div className="mb-2 text-[9px] tracking-[0.1em] text-[#8a8a8a]">STT OUTPUT</div>
        <pre className="min-h-[4.5rem] whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-[#c8c8c8]">
          {interim
            ? `${finals ? `${finals}\n` : ""}… ${interim}`
            : finals || "— waiting for speech —"}
        </pre>
      </div>

      <div
        className="rounded-sm border border-[#1c1c1c] bg-black/70 p-3"
        data-testid="survey-mirage-listening-advice"
      >
        <div className="mb-2 text-[9px] tracking-[0.1em] text-emerald-300/80">ADVICE</div>
        {advice ? (
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-[#b8e0c8]">
            {advice}
          </pre>
        ) : (
          <p className="text-[9px] tracking-[0.06em] text-[#5f5f5f]">
            Press SOLVE after speech appears above — advice renders here.
          </p>
        )}
      </div>
    </div>
  );
}
