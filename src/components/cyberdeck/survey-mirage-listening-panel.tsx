"use client";

import { useCallback, useState } from "react";
import { CyberdeckActionButton } from "@/components/cyberdeck/cyberdeck-control-button";
import { LiveAudioVisualizer } from "@/components/cyberdeck/live-audio-visualizer";
import { solveMirageSelectedTextAsync } from "@/lib/cyberdeck/survey-mirage-item-queue.client";
import { useMirageLocalListening } from "@/lib/cyberdeck/use-mirage-local-listening";

/**
 * Mirage Survey LISTENING tab — Start/Stop mic, live waveform, STT text, Solve → advice.
 */
export function SurveyMirageListeningPanel() {
  const {
    active,
    interim,
    transcript,
    error,
    mediaRecorder,
    displayText,
    start,
    stop,
    clearTranscript,
  } = useMirageLocalListening();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [advice, setAdvice] = useState("");
  const [solveError, setSolveError] = useState("");

  const handleStart = useCallback(async () => {
    setBusy(true);
    setSolveError("");
    setStatus("Requesting microphone…");
    const result = await start();
    setBusy(false);
    setStatus(result.message);
  }, [start]);

  const handleStop = useCallback(() => {
    const result = stop();
    setStatus(result.message);
  }, [stop]);

  const handleSolve = useCallback(async () => {
    const text = displayText || transcript;
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
  }, [displayText, transcript]);

  const handleClear = useCallback(() => {
    clearTranscript();
    setAdvice("");
    setSolveError("");
    setStatus("Transcript cleared.");
  }, [clearTranscript]);

  return (
    <div className="flex flex-col gap-3" data-testid="survey-mirage-listening-panel">
      <div className="rounded-sm border border-[#1c1c1c] bg-black/70 p-3">
        <div className="mb-2 text-[9px] tracking-[0.08em] text-[#8a8a8a]">
          MIRAGE LISTENING // mic → live STT → solve advice
        </div>
        <p className="mb-3 text-[9px] leading-relaxed tracking-[0.04em] text-[#5f5f5f]">
          Start Listening opens this device&apos;s microphone, shows a live volume waveform, and runs
          continuous speech-to-text. Solve reads the transcript and returns interview advice.
        </p>

        <div className="mb-3 overflow-hidden rounded-sm border border-[#1c1c1c] bg-black/80 px-2 py-3">
          {mediaRecorder && active ? (
            <LiveAudioVisualizer
              mediaRecorder={mediaRecorder}
              width={480}
              height={72}
              barWidth={3}
              gap={2}
              barColor="#34d399"
              backgroundColor="#050807"
              fftSize={256}
              smoothingTimeConstant={0.5}
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
            {active ? "MIC // LIVE" : "MIC // STANDBY"}
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
            onClick={handleStop}
            data-testid="survey-mirage-listening-stop"
          >
            STOP LISTENING
          </CyberdeckActionButton>
          <CyberdeckActionButton
            disabled={busy || !(displayText || transcript)}
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
            ? `${transcript ? `${transcript}\n` : ""}… ${interim}`
            : transcript || "— waiting for speech —"}
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
