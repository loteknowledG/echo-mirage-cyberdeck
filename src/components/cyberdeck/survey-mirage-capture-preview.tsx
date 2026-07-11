"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { SurveyAnalyzeSolvingBanner } from "@/components/cyberdeck/survey-analyze-solving-banner";
import { CyberdeckActionButton } from "@/components/cyberdeck/cyberdeck-control-button";
import {
  resolveSurveyEchoDeckContext,
  SURVEY_LAST_CAPTURE_EVENT,
  SURVEY_LAST_CAPTURE_STORAGE_KEY,
  takeSurveyScreenshot,
} from "@/lib/cyberdeck/survey-deck-command.client";
import {
  resolveMiragePreviewContent,
  solveMirageCaptureAsync,
  SURVEY_MIRAGE_ITEM_CHANGED_EVENT,
} from "@/lib/cyberdeck/survey-mirage-item-queue.client";
import { SURVEY_ECHO_DISPLAY } from "@/lib/cyberdeck/survey-mode";
import { useSurveyAnalyzeStatus } from "@/lib/cyberdeck/survey-analyze-status.client";
import { useSurveyTeamStatus } from "@/lib/cyberdeck/use-survey-team-status";

function formatCaptureSize(imageSrc: string): string {
  const bytes = Math.round((imageSrc.length * 3) / 4);
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

/** Echo screenshot + preview; SOLVE sends the capture into the answers pane. */
export function SurveyMirageCapturePreview() {
  const team = useSurveyTeamStatus();
  const analyzeStatus = useSurveyAnalyzeStatus();
  const [captureTick, setCaptureTick] = useState(0);
  const [captureBusy, setCaptureBusy] = useState(false);
  const [solveBusy, setSolveBusy] = useState(false);
  const [deckMessage, setDeckMessage] = useState<string | null>(null);

  const bumpCapture = useCallback(() => setCaptureTick((value) => value + 1), []);

  useEffect(() => {
    window.addEventListener(SURVEY_LAST_CAPTURE_EVENT, bumpCapture);
    window.addEventListener(SURVEY_MIRAGE_ITEM_CHANGED_EVENT, bumpCapture);
    const onStorage = (event: StorageEvent) => {
      if (event.key === SURVEY_LAST_CAPTURE_STORAGE_KEY) bumpCapture();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(SURVEY_LAST_CAPTURE_EVENT, bumpCapture);
      window.removeEventListener(SURVEY_MIRAGE_ITEM_CHANGED_EVENT, bumpCapture);
      window.removeEventListener("storage", onStorage);
    };
  }, [bumpCapture]);

  useEffect(() => {
    if (analyzeStatus.phase !== "running") setSolveBusy(false);
  }, [analyzeStatus.phase]);

  const previewContent = useMemo(() => {
    void captureTick;
    return resolveMiragePreviewContent();
  }, [captureTick]);

  const imageSrc = previewContent?.kind === "image" ? previewContent.imageDataUrl : null;
  const solving = analyzeStatus.phase === "running";

  const echoCtx = useMemo(
    () => resolveSurveyEchoDeckContext(team.echoHost),
    [team.echoHost],
  );
  const echoReady = Boolean(echoCtx.echoHost);
  const echoTargetLabel = echoCtx.echoHost
    ? `${echoCtx.echoHost}:${echoCtx.echoHttpPort}`
    : null;

  const handleScreenshot = useCallback(async () => {
    if (captureBusy || solving) return;
    setCaptureBusy(true);
    setDeckMessage(null);
    const result = await takeSurveyScreenshot(echoCtx);
    setDeckMessage(result.message);
    if (result.ok) bumpCapture();
    setCaptureBusy(false);
  }, [bumpCapture, captureBusy, echoCtx, solving]);

  const handleSolve = useCallback(async () => {
    if (!imageSrc || solveBusy || solving) return;
    setSolveBusy(true);
    setDeckMessage(null);
    const result = await solveMirageCaptureAsync();
    setDeckMessage(result.message);
    setSolveBusy(false);
  }, [imageSrc, solveBusy, solving]);

  return (
    <section
      className="-mx-4 border-b border-[#1a1a1a] bg-[#060606] px-4 py-3 font-mono"
      aria-label="Mirage capture preview"
      data-testid="survey-mirage-capture-preview"
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[9px] tracking-[0.1em] text-fuchsia-300/90">CAPTURE</p>
        {imageSrc ? (
          <p className="text-[8px] text-[#6a6a6a]">{formatCaptureSize(imageSrc)}</p>
        ) : null}
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        <CyberdeckActionButton
          variant="neutral"
          disabled={!echoReady || captureBusy || solving}
          onClick={() => void handleScreenshot()}
          data-testid="survey-mirage-take-screenshot"
        >
          {captureBusy ? "CAPTURING…" : `${SURVEY_ECHO_DISPLAY} · SCREENSHOT`}
        </CyberdeckActionButton>
        <CyberdeckActionButton
          variant="accent"
          disabled={!imageSrc || solveBusy || solving}
          onClick={() => void handleSolve()}
          data-testid="survey-mirage-solve-capture"
        >
          {solving && imageSrc ? "SOLVING…" : "SOLVE"}
        </CyberdeckActionButton>
      </div>

      {!echoReady ? (
        <p className="mb-2 text-[8px] text-[#6a6a6a]">
          Link {SURVEY_ECHO_DISPLAY} in TEAM LINKS first — capture runs on that machine.
        </p>
      ) : echoTargetLabel ? (
        <p className="mb-2 text-[8px] text-[#6a6a6a]">
          {SURVEY_ECHO_DISPLAY} · {echoTargetLabel}
        </p>
      ) : null}

      {solving ? <SurveyAnalyzeSolvingBanner status={analyzeStatus} compact /> : null}

      {!imageSrc ? (
        <p className="text-[9px] leading-relaxed text-[#6a6a6a]">
          No capture yet — press SCREENSHOT, then SOLVE to fill Answers below.
        </p>
      ) : (
        <div className="relative overflow-hidden rounded border border-[#1c1c1c] bg-black">
          {/* eslint-disable-next-line @next/next/no-img-element -- data URL / local capture blob */}
          <img
            src={imageSrc}
            alt="Echo capture preview"
            className={`max-h-[min(42vh,420px)] w-full object-contain object-left-top ${solving ? "opacity-60" : ""}`}
          />
        </div>
      )}

      {deckMessage ? (
        <p className="mt-2 text-[8px] text-cyan-200/80" role="status">
          {deckMessage}
        </p>
      ) : null}
    </section>
  );
}
