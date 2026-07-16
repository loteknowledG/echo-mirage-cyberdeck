"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { SurveyAnalyzeSolvingBanner } from "@/components/cyberdeck/survey-analyze-solving-banner";
import { CyberdeckActionButton } from "@/components/cyberdeck/cyberdeck-control-button";
import { SurveyProviderSetup } from "@/components/cyberdeck/survey-provider-setup";
import {
  resolveSurveyEchoDeckContext,
  resolveSurveyRelayEchoNodeId,
  SURVEY_LAST_CAPTURE_EVENT,
  SURVEY_LAST_CAPTURE_STORAGE_KEY,
  takeSurveyScreenshot,
} from "@/lib/cyberdeck/survey-deck-command.client";
import {
  ensureSurveyRelayEchoNodeId,
  SURVEY_RELAY_ECHO_CHANGED_EVENT,
} from "@/lib/cyberdeck/survey-relay.client";
import {
  clearSurveyCaptureStack,
  readSurveyCaptureStack,
  removeSurveyCaptureStackPage,
  SURVEY_CAPTURE_STACK_CHANGED_EVENT,
  SURVEY_CAPTURE_STACK_MAX,
  type SurveyCaptureStackPage,
} from "@/lib/cyberdeck/survey-capture-stack.client";
import { surveyCaptureDataUrl } from "@/lib/cyberdeck/survey-capture-mime";
import {
  resolveMiragePreviewContent,
  solveMirageCaptureAsync,
  SURVEY_MIRAGE_ITEM_CHANGED_EVENT,
} from "@/lib/cyberdeck/survey-mirage-item-queue.client";
import { SURVEY_ECHO_DISPLAY } from "@/lib/cyberdeck/survey-mode";
import { useSurveyAnalyzeStatus } from "@/lib/cyberdeck/survey-analyze-status.client";
import { useSurveyTeamStatus } from "@/lib/cyberdeck/use-survey-team-status";
import { SURVEY_PAIR_PIN_DRAFT_EVENT } from "@/lib/cyberdeck/survey-pair-pin-draft";
import { isSurveyHttpsPairBlocked } from "@/lib/cyberdeck/survey-pairing-shared.client";

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
  const [endpointTick, setEndpointTick] = useState(0);
  const [stackTick, setStackTick] = useState(0);
  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [captureBusy, setCaptureBusy] = useState(false);
  const [solveBusy, setSolveBusy] = useState(false);
  const [deckMessage, setDeckMessage] = useState<string | null>(null);
  const [pwaBlocked, setPwaBlocked] = useState(false);
  const [relayLiveId, setRelayLiveId] = useState<string | null>(null);
  const [relayWaitHint, setRelayWaitHint] = useState<string | null>(null);

  const bumpCapture = useCallback(() => setCaptureTick((value) => value + 1), []);
  const bumpEndpoint = useCallback(() => setEndpointTick((value) => value + 1), []);
  const bumpStack = useCallback(() => setStackTick((value) => value + 1), []);

  useEffect(() => {
    setPwaBlocked(isSurveyHttpsPairBlocked());
  }, []);

  useEffect(() => {
    if (!pwaBlocked) {
      setRelayLiveId(null);
      setRelayWaitHint(null);
      return;
    }
    let cancelled = false;
    const discover = () => {
      void ensureSurveyRelayEchoNodeId(resolveSurveyRelayEchoNodeId()).then((result) => {
        if (cancelled) return;
        if (result.ok) {
          setRelayLiveId(result.echoNodeId);
          setRelayWaitHint(null);
          bumpEndpoint();
          return;
        }
        setRelayLiveId(null);
        setRelayWaitHint(
          "Waiting for Echo — open Satellite on the Mac and tap Send to Mirage (no team id needed).",
        );
      });
    };
    discover();
    const timer = window.setInterval(discover, 20_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [pwaBlocked, bumpEndpoint]);

  useEffect(() => {
    window.addEventListener(SURVEY_LAST_CAPTURE_EVENT, bumpCapture);
    window.addEventListener(SURVEY_MIRAGE_ITEM_CHANGED_EVENT, bumpCapture);
    window.addEventListener(SURVEY_PAIR_PIN_DRAFT_EVENT, bumpEndpoint);
    window.addEventListener(SURVEY_CAPTURE_STACK_CHANGED_EVENT, bumpStack);
    window.addEventListener(SURVEY_RELAY_ECHO_CHANGED_EVENT, bumpEndpoint);
    const onStorage = (event: StorageEvent) => {
      if (event.key === SURVEY_LAST_CAPTURE_STORAGE_KEY) bumpCapture();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(SURVEY_LAST_CAPTURE_EVENT, bumpCapture);
      window.removeEventListener(SURVEY_MIRAGE_ITEM_CHANGED_EVENT, bumpCapture);
      window.removeEventListener(SURVEY_PAIR_PIN_DRAFT_EVENT, bumpEndpoint);
      window.removeEventListener(SURVEY_CAPTURE_STACK_CHANGED_EVENT, bumpStack);
      window.removeEventListener(SURVEY_RELAY_ECHO_CHANGED_EVENT, bumpEndpoint);
      window.removeEventListener("storage", onStorage);
    };
  }, [bumpCapture, bumpEndpoint, bumpStack]);

  useEffect(() => {
    if (analyzeStatus.phase !== "running") setSolveBusy(false);
  }, [analyzeStatus.phase]);

  const stackPages = useMemo(() => {
    void stackTick;
    void captureTick;
    return readSurveyCaptureStack();
  }, [stackTick, captureTick]);

  useEffect(() => {
    if (stackPages.length === 0) {
      setActivePageId(null);
      return;
    }
    if (!activePageId || !stackPages.some((page) => page.id === activePageId)) {
      setActivePageId(stackPages[stackPages.length - 1]?.id ?? null);
    }
  }, [stackPages, activePageId]);

  const previewContent = useMemo(() => {
    void captureTick;
    return resolveMiragePreviewContent();
  }, [captureTick]);

  const activePage: SurveyCaptureStackPage | null =
    stackPages.find((page) => page.id === activePageId) ??
    stackPages[stackPages.length - 1] ??
    null;

  const imageSrc = activePage
    ? surveyCaptureDataUrl(activePage.pngBase64)
    : previewContent?.kind === "image"
      ? previewContent.imageDataUrl
      : null;
  const solving = analyzeStatus.phase === "running";
  const pageCount = stackPages.length;
  const canSolve = pageCount > 0 || Boolean(imageSrc);

  const echoCtx = useMemo(() => {
    void endpointTick;
    return resolveSurveyEchoDeckContext(team.echoHost);
  }, [endpointTick, team.echoHost]);
  const relayEchoNodeId = useMemo(() => {
    void endpointTick;
    return relayLiveId || resolveSurveyRelayEchoNodeId();
  }, [endpointTick, relayLiveId]);
  // HTTPS PWA: screenshots ride the relay; no manual team id — discover active Echo.
  const relayReady = pwaBlocked;
  const echoReady = (Boolean(echoCtx.echoHost) && !pwaBlocked) || relayReady;
  const echoTargetLabel = pwaBlocked
    ? relayEchoNodeId
      ? `relay · team ${relayEchoNodeId.slice(0, 8)}…`
      : "relay · auto-discovering Echo…"
    : echoCtx.echoHost
      ? `${echoCtx.echoHost}:${echoCtx.echoHttpPort}`
      : null;

  const handleScreenshot = useCallback(async () => {
    if (captureBusy || solving) return;
    setCaptureBusy(true);
    setDeckMessage(null);
    const result = await takeSurveyScreenshot(echoCtx);
    setDeckMessage(
      result.ok
        ? `${result.message} · page added (${Math.min(pageCount + 1, SURVEY_CAPTURE_STACK_MAX)}/${SURVEY_CAPTURE_STACK_MAX})`
        : result.message,
    );
    if (result.ok) {
      bumpCapture();
      bumpStack();
    }
    setCaptureBusy(false);
  }, [bumpCapture, bumpStack, captureBusy, echoCtx, pageCount, solving]);

  const handleSolve = useCallback(async () => {
    if (!canSolve || solveBusy || solving) return;
    setSolveBusy(true);
    setDeckMessage(null);
    const result = await solveMirageCaptureAsync();
    setDeckMessage(result.message);
    setSolveBusy(false);
  }, [canSolve, solveBusy, solving]);

  const handleClearPages = useCallback(() => {
    clearSurveyCaptureStack();
    setActivePageId(null);
    setDeckMessage("Capture pages cleared.");
    bumpStack();
  }, [bumpStack]);

  const handleRemovePage = useCallback(
    (pageId: string) => {
      removeSurveyCaptureStackPage(pageId);
      bumpStack();
    },
    [bumpStack],
  );

  return (
    <section
      className="-mx-4 border-b border-[#1a1a1a] bg-[#060606] px-4 py-3 font-mono"
      aria-label="Mirage capture preview"
      data-testid="survey-mirage-capture-preview"
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[9px] tracking-[0.1em] text-fuchsia-300/90">CAPTURE</p>
        {pageCount > 0 ? (
          <p className="text-[8px] text-[#6a6a6a]">
            {pageCount} page{pageCount === 1 ? "" : "s"}
            {imageSrc ? ` · ${formatCaptureSize(imageSrc)}` : null}
          </p>
        ) : imageSrc ? (
          <p className="text-[8px] text-[#6a6a6a]">{formatCaptureSize(imageSrc)}</p>
        ) : null}
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        <CyberdeckActionButton
          variant="neutral"
          disabled={!echoReady || captureBusy || solving || pageCount >= SURVEY_CAPTURE_STACK_MAX}
          onClick={() => void handleScreenshot()}
          data-testid="survey-mirage-take-screenshot"
        >
          {captureBusy
            ? "CAPTURING…"
            : pageCount > 0
              ? `${SURVEY_ECHO_DISPLAY} · + PAGE`
              : `${SURVEY_ECHO_DISPLAY} · SCREENSHOT`}
        </CyberdeckActionButton>
        <CyberdeckActionButton
          variant="accent"
          disabled={!canSolve || solveBusy || solving}
          onClick={() => void handleSolve()}
          data-testid="survey-mirage-solve-capture"
        >
          {solving && canSolve
            ? "SOLVING…"
            : pageCount > 1
              ? `SOLVE ${pageCount} PAGES`
              : "SOLVE"}
        </CyberdeckActionButton>
        {pageCount > 0 ? (
          <CyberdeckActionButton
            variant="neutral"
            disabled={captureBusy || solveBusy || solving}
            onClick={handleClearPages}
            data-testid="survey-mirage-clear-pages"
          >
            CLEAR PAGES
          </CyberdeckActionButton>
        ) : null}
      </div>

      <SurveyProviderSetup />

      {pwaBlocked && relayWaitHint && !relayEchoNodeId ? (
        <p className="mb-2 text-[8px] leading-relaxed text-amber-200/90">{relayWaitHint}</p>
      ) : null}

      {pwaBlocked && !relayEchoNodeId && !relayWaitHint ? (
        <p className="mb-2 text-[8px] text-[#6a6a6a]">
          Looking for Echo on the cloud relay…
        </p>
      ) : !echoReady ? (
        <p className="mb-2 text-[8px] text-[#6a6a6a]">
          Enter {SURVEY_ECHO_DISPLAY} IP above (Tailscale), then SCREENSHOT runs on that Mac.
        </p>
      ) : echoTargetLabel ? (
        <p className="mb-2 text-[8px] text-[#6a6a6a]">
          {SURVEY_ECHO_DISPLAY} · {echoTargetLabel}
          {pwaBlocked
            ? " — screenshot via relay middlebox (Echo still captures)."
            : " — press + PAGE for each extra screen, then SOLVE."}
        </p>
      ) : null}

      {solving ? <SurveyAnalyzeSolvingBanner status={analyzeStatus} compact /> : null}

      {pageCount > 1 ? (
        <div className="mb-3 flex flex-wrap gap-2" data-testid="survey-mirage-page-strip">
          {stackPages.map((page, index) => {
            const selected = page.id === activePage?.id;
            return (
              <button
                key={page.id}
                type="button"
                onClick={() => setActivePageId(page.id)}
                className={`relative overflow-hidden rounded border ${
                  selected ? "border-fuchsia-500/70" : "border-[#2a2a2a]"
                } bg-black`}
                title={`Page ${index + 1}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- local capture preview */}
                <img
                  src={surveyCaptureDataUrl(page.pngBase64)}
                  alt={`Page ${index + 1}`}
                  className="h-14 w-20 object-cover object-left-top"
                />
                <span className="absolute bottom-0 left-0 right-0 bg-black/75 px-1 text-[8px] text-[#cfcfcf]">
                  {index + 1}
                </span>
                <span
                  role="button"
                  tabIndex={0}
                  className="absolute right-0 top-0 bg-black/80 px-1 text-[8px] text-[#ff8a8a]"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleRemovePage(page.id);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      event.stopPropagation();
                      handleRemovePage(page.id);
                    }
                  }}
                >
                  ×
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      {!imageSrc ? (
        <p className="text-[9px] leading-relaxed text-[#6a6a6a]">
          No capture yet — SCREENSHOT for page 1, + PAGE for more screens, then SOLVE.
        </p>
      ) : (
        <div className="relative overflow-hidden rounded border border-[#1c1c1c] bg-black">
          {pageCount > 1 ? (
            <p className="absolute left-2 top-2 z-10 rounded bg-black/70 px-1.5 py-0.5 text-[8px] text-fuchsia-200/90">
              PAGE {stackPages.findIndex((page) => page.id === activePage?.id) + 1}/{pageCount}
            </p>
          ) : null}
          {/* eslint-disable-next-line @next/next/no-img-element -- data URL / local capture blob */}
          <img
            src={imageSrc}
            alt={pageCount > 1 ? `Echo capture page` : "Echo capture preview"}
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
