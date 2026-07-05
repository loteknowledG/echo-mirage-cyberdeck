"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { SurveyAnalyzeSolvingBanner } from "@/components/cyberdeck/survey-analyze-solving-banner";
import { CyberdeckActionButton } from "@/components/cyberdeck/cyberdeck-control-button";
import { useMirageItemQueue } from "@/components/cyberdeck/survey-mirage-item-select-list";
import {
  resolveSurveyEchoDeckContext,
  solveSurveySelectedText,
  SURVEY_LAST_CAPTURE_EVENT,
  SURVEY_LAST_CAPTURE_STORAGE_KEY,
  SURVEY_LAST_SELECTION_EVENT,
  SURVEY_LAST_SELECTION_STORAGE_KEY,
  takeSurveyScreenshot,
} from "@/lib/cyberdeck/survey-deck-command.client";
import {
  resolveMiragePreviewContent,
  resolveMirageQueueItemImage,
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

/** Inline Echo capture preview + Mirage-native screenshot / solve controls. */
export function SurveyMirageCapturePreview() {
  const team = useSurveyTeamStatus();
  const { current, index, items } = useMirageItemQueue();
  const analyzeStatus = useSurveyAnalyzeStatus();
  const [captureTick, setCaptureTick] = useState(0);
  const [captureBusy, setCaptureBusy] = useState(false);
  const [solveBusy, setSolveBusy] = useState(false);
  const [textSolveBusy, setTextSolveBusy] = useState(false);
  const [deckMessage, setDeckMessage] = useState<string | null>(null);

  const bumpCapture = useCallback(() => setCaptureTick((value) => value + 1), []);

  useEffect(() => {
    window.addEventListener(SURVEY_LAST_CAPTURE_EVENT, bumpCapture);
    window.addEventListener(SURVEY_LAST_SELECTION_EVENT, bumpCapture);
    window.addEventListener(SURVEY_MIRAGE_ITEM_CHANGED_EVENT, bumpCapture);
    const onStorage = (event: StorageEvent) => {
      if (
        event.key === SURVEY_LAST_CAPTURE_STORAGE_KEY ||
        event.key === SURVEY_LAST_SELECTION_STORAGE_KEY
      ) {
        bumpCapture();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(SURVEY_LAST_CAPTURE_EVENT, bumpCapture);
      window.removeEventListener(SURVEY_LAST_SELECTION_EVENT, bumpCapture);
      window.removeEventListener(SURVEY_MIRAGE_ITEM_CHANGED_EVENT, bumpCapture);
      window.removeEventListener("storage", onStorage);
    };
  }, [bumpCapture]);

  useEffect(() => {
    if (analyzeStatus.phase !== "running") {
      setSolveBusy(false);
      setTextSolveBusy(false);
    }
  }, [analyzeStatus.phase]);

  const previewContent = useMemo(() => {
    void captureTick;
    return resolveMiragePreviewContent();
  }, [captureTick, current, index, items.length]);

  const imageSrc = previewContent?.kind === "image" ? previewContent.imageDataUrl : null;
  const selectionText = previewContent?.kind === "text" ? previewContent.selectionText : null;

  const solving = analyzeStatus.phase === "running";

  const echoCtx = useMemo(
    () => resolveSurveyEchoDeckContext(team.echoHost),
    [team.echoHost],
  );
  const canSolveImage = Boolean(imageSrc);
  const canSolveText = Boolean(selectionText);
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
    if (!canSolveImage || solveBusy || solving) return;
    setSolveBusy(true);
    setDeckMessage(null);
    const result = await solveMirageCaptureAsync();
    setDeckMessage(result.message);
    setSolveBusy(false);
  }, [canSolveImage, solveBusy, solving]);

  const handleSolveSelectedText = useCallback(async () => {
    if (!echoReady || textSolveBusy || solving || captureBusy) return;
    setTextSolveBusy(true);
    setDeckMessage(null);
    const result = await solveSurveySelectedText(echoCtx);
    setDeckMessage(result.message);
    if (result.ok) bumpCapture();
    setTextSolveBusy(false);
  }, [bumpCapture, captureBusy, echoCtx, echoReady, solving, textSolveBusy]);

  const sourceLabel = current
    ? resolveMirageQueueItemImage(current)
      ? `queue item ${index + 1}/${items.length}`
      : selectionText
        ? `queue item ${index + 1}/${items.length} · Echo selected text`
        : `queue item ${index + 1}/${items.length} · image re-linked from capture`
    : selectionText
      ? "last Echo selected text"
      : imageSrc
        ? "last Echo capture"
        : null;

  return (
    <section
      className="-mx-4 border-b border-[#1a1a1a] bg-[#060606] px-4 py-3 font-mono"
      aria-label="Mirage capture preview"
      data-testid="survey-mirage-capture-preview"
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[9px] tracking-[0.1em] text-fuchsia-300/90">
          {selectionText ? "SELECTED TEXT PREVIEW" : "CAPTURE PREVIEW"}
        </p>
        {previewContent ? (
          <p className="text-[8px] text-[#6a6a6a]">
            {sourceLabel}
            {imageSrc ? ` · ${formatCaptureSize(imageSrc)}` : selectionText ? ` · ${selectionText.length} chars` : ""}
          </p>
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
          disabled={!canSolveImage || solveBusy || solving}
          onClick={() => void handleSolve()}
          data-testid="survey-mirage-solve-capture"
        >
          {solving && canSolveImage ? "SOLVING…" : "SOLVE"}
        </CyberdeckActionButton>
        <CyberdeckActionButton
          variant="neutral"
          disabled={!echoReady || textSolveBusy || solving || captureBusy}
          onClick={() => void handleSolveSelectedText()}
          data-testid="survey-mirage-solve-selected-text"
        >
          {textSolveBusy || (solving && !canSolveImage) ? "SOLVING…" : "SOLVE SELECTED TEXT"}
        </CyberdeckActionButton>
      </div>

      {!echoReady ? (
        <p className="mb-2 text-[8px] text-[#6a6a6a]">
          Link {SURVEY_ECHO_DISPLAY} in TEAM LINKS — Mirage triggers a remote capture on the
          interview machine, not this screen.
        </p>
      ) : echoTargetLabel ? (
        <p className="mb-2 text-[8px] text-[#6a6a6a]">
          {SURVEY_ECHO_DISPLAY} target · {echoTargetLabel} — highlight problem text on the interview
          machine, then use SOLVE SELECTED TEXT.
        </p>
      ) : null}

      {solving ? <SurveyAnalyzeSolvingBanner status={analyzeStatus} compact /> : null}

      {!previewContent ? (
        <p className="text-[9px] leading-relaxed text-[#6a6a6a]">
          No capture yet — use <span className="text-fuchsia-300/80">{SURVEY_ECHO_DISPLAY} · SCREENSHOT</span>{" "}
          for the full screen, or{" "}
          <span className="text-fuchsia-300/80">SOLVE SELECTED TEXT</span> after highlighting a
          problem on the interview machine.
        </p>
      ) : selectionText ? (
        <div
          className="custom-scrollbar max-h-[min(42vh,420px)] overflow-y-auto rounded border border-[#1c1c1c] bg-black px-3 py-3"
          data-testid="survey-mirage-selected-text-preview"
        >
          <pre className="whitespace-pre-wrap text-[10px] leading-relaxed text-[#d4d4d4]">
            {selectionText}
          </pre>
        </div>
      ) : (
        <div className="relative overflow-hidden rounded border border-[#1c1c1c] bg-black">
          {/* eslint-disable-next-line @next/next/no-img-element -- data URL / local capture blob */}
          <img
            src={imageSrc ?? ""}
            alt={current?.title ?? "Echo capture preview"}
            className={`max-h-[min(42vh,420px)] w-full object-contain object-left-top ${solving ? "opacity-60" : ""}`}
          />
          {solving ? (
            <div
              className="pointer-events-none absolute inset-0 bg-gradient-to-b from-emerald-500/5 via-transparent to-emerald-500/10"
              aria-hidden="true"
            />
          ) : null}
        </div>
      )}

      {canSolveImage && !solving ? (
        <p className="mt-2 text-[8px] text-[#5f5f5f]">
          Codex reads this screenshot via your login — no OpenAI API key required.
        </p>
      ) : null}

      {canSolveText && !solving ? (
        <p className="mt-2 text-[8px] text-[#5f5f5f]">
          Selected text is staged above before Codex runs — verify it matches the interview prompt.
        </p>
      ) : null}

      {deckMessage ? (
        <p className="mt-2 text-[8px] text-cyan-200/80" role="status">
          {deckMessage}
        </p>
      ) : null}
    </section>
  );
}
