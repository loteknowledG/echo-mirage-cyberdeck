"use client";

import { useCallback, useEffect, useState } from "react";
import { CyberdeckActionButton } from "@/components/cyberdeck/cyberdeck-control-button";
import {
  captureEchoExtensionActiveTab,
  captureEchoExtensionTab,
  listEchoExtensionTabs,
  readLinkedEchoExtensionTabId,
  writeLinkedEchoExtensionTabId,
} from "@/lib/cyberdeck/survey-echo-extension.client";
import { resolveSurveyEchoDeckContext } from "@/lib/cyberdeck/survey-deck-command.client";
import type { SurveyExtensionTabOption } from "@/lib/cyberdeck/survey-extension-page-context";
import {
  solveLastSurveyExtensionPage,
  useSurveyExtensionPageContextStatus,
} from "@/lib/cyberdeck/survey-extension-page-context.client";

export function SurveyMirageExtCapturePanel() {
  const pageContext = useSurveyExtensionPageContextStatus();
  const [tabs, setTabs] = useState<SurveyExtensionTabOption[]>([]);
  const [linkedTabId, setLinkedTabId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [solveBusy, setSolveBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [echoHostHint, setEchoHostHint] = useState<string | null>(null);

  useEffect(() => {
    setLinkedTabId(readLinkedEchoExtensionTabId());
    const ctx = resolveSurveyEchoDeckContext();
    setEchoHostHint(ctx.echoHost);
  }, []);

  const captureActive = useCallback(async () => {
    setBusy(true);
    setError("");
    setMessage("Capturing active Chrome tab via echo-extension…");
    const result = await captureEchoExtensionActiveTab(resolveSurveyEchoDeckContext());
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      setMessage("");
      return;
    }
    setMessage(
      result.snapshotIngested
        ? `${result.message} · staged for SOLVE (page text)`
        : result.message,
    );
  }, []);

  const refresh = useCallback(async () => {
    setBusy(true);
    setError("");
    setMessage("Refreshing Chrome tabs via echo-electron…");
    const result = await listEchoExtensionTabs(resolveSurveyEchoDeckContext());
    setBusy(false);
    if (!result.ok) {
      setTabs([]);
      setError(result.message);
      setMessage("");
      return;
    }
    const nextTabs = result.tabs ?? [];
    setTabs(nextTabs);
    setMessage(result.message);

    const linked = readLinkedEchoExtensionTabId();
    if (linked != null && !nextTabs.some((t) => t.tabId === linked)) {
      writeLinkedEchoExtensionTabId(null);
      setLinkedTabId(null);
      setMessage(`${result.message} · linked tab closed — pick again.`);
    } else {
      setLinkedTabId(linked);
    }
  }, []);

  const linkSelected = useCallback(
    (tabId: number) => {
      writeLinkedEchoExtensionTabId(tabId);
      setLinkedTabId(tabId);
      const row = tabs.find((t) => t.tabId === tabId);
      setMessage(row ? `Linked · ${row.label}` : `Linked tabId ${tabId}`);
      setError("");
    },
    [tabs],
  );

  const captureLinked = useCallback(async () => {
    const tabId = linkedTabId ?? readLinkedEchoExtensionTabId();
    if (tabId == null) {
      setError("Link a tab by title first.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("Capturing linked tab via echo-extension…");
    const result = await captureEchoExtensionTab(tabId, resolveSurveyEchoDeckContext());
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      setMessage("");
      return;
    }
    setMessage(
      result.snapshotIngested
        ? `${result.message} · staged for SOLVE`
        : result.message,
    );
  }, [linkedTabId]);

  const solvePage = useCallback(async () => {
    setSolveBusy(true);
    setError("");
    setMessage("Solving page text…");
    const result = await solveLastSurveyExtensionPage();
    setSolveBusy(false);
    if (!result.ok) {
      setError(result.message);
      setMessage("");
      return;
    }
    setMessage(result.message);
  }, []);

  const linkedLabel = tabs.find((t) => t.tabId === linkedTabId)?.label;
  const hasPageText = Boolean(pageContext.lastSnapshot?.pageText.trim());
  const lastTitle = pageContext.lastSnapshot?.title?.trim();
  const lastUrl = pageContext.lastSnapshot?.url?.trim();

  return (
    <div
      className="rounded border border-emerald-950/50 bg-black/40 p-3"
      data-survey-role="mirage"
      data-survey-runtime="browser"
      data-echo-agent="echo-extension"
      data-testid="survey-mirage-ext-capture-panel"
    >
      <p className="mb-1 text-[9px] tracking-[0.08em] text-emerald-300/90">
        echo-extension · tab text capture
      </p>
      <p className="mb-3 text-[8px] leading-relaxed text-[#5f8f74]">
        Focus the page you want in capture Chrome (extension loaded), then Capture active tab.
        Text is staged into Solutions — press SOLVE PAGE TEXT for the answer. Mirage must be local
        HTTP (not Vercel).
        {echoHostHint ? ` Echo · ${echoHostHint}` : ""}
      </p>

      <div className="mb-3 flex flex-wrap gap-2">
        <CyberdeckActionButton
          variant="accent"
          disabled={busy || solveBusy}
          onClick={() => void captureActive()}
          data-testid="survey-ext-capture-active"
        >
          {busy ? "CAPTURING…" : "Capture active tab"}
        </CyberdeckActionButton>
        <CyberdeckActionButton
          disabled={busy || solveBusy || !hasPageText}
          onClick={() => void solvePage()}
          data-testid="survey-ext-solve-page"
        >
          {solveBusy ? "SOLVING…" : "SOLVE PAGE TEXT"}
        </CyberdeckActionButton>
      </div>

      {hasPageText ? (
        <p className="mb-3 text-[8px] leading-relaxed text-emerald-300/80">
          Staged · {lastTitle || "(untitled)"}
          {lastUrl ? ` · ${lastUrl}` : ""} · {pageContext.lastSnapshot?.pageText.length ?? 0} chars
        </p>
      ) : null}

      <p className="mb-2 text-[8px] tracking-[0.06em] text-[#5f5f5f]">
        Optional · pick by title
      </p>
      <div className="mb-2 flex flex-wrap gap-2">
        <CyberdeckActionButton disabled={busy || solveBusy} onClick={() => void refresh()}>
          Refresh tabs
        </CyberdeckActionButton>
        <CyberdeckActionButton
          disabled={busy || solveBusy || linkedTabId == null}
          onClick={() => void captureLinked()}
        >
          Capture linked tab
        </CyberdeckActionButton>
      </div>

      {linkedLabel ? (
        <p className="mb-2 text-[8px] text-emerald-300/80">Linked · {linkedLabel}</p>
      ) : (
        <p className="mb-2 text-[8px] text-[#5f5f5f]">No tab linked yet.</p>
      )}

      {tabs.length > 0 ? (
        <ul className="max-h-40 space-y-1 overflow-y-auto">
          {tabs.map((tab) => {
            const selected = tab.tabId === linkedTabId;
            return (
              <li key={tab.tabId}>
                <button
                  type="button"
                  disabled={busy || solveBusy}
                  onClick={() => linkSelected(tab.tabId)}
                  className={
                    selected
                      ? "w-full rounded border border-emerald-500/50 bg-emerald-950/30 px-2 py-1 text-left text-[8px] text-emerald-200"
                      : "w-full rounded border border-[#1c1c1c] bg-black/30 px-2 py-1 text-left text-[8px] text-[#8a8a8a] hover:border-emerald-900/60 hover:text-emerald-200/80"
                  }
                >
                  {tab.label}
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-[8px] text-[#5f5f5f]">
          Optional: Refresh to link a specific tab — Echo Satellite + echo-extension on the capture
          PC.
        </p>
      )}

      {message ? <p className="mt-2 text-[8px] text-[#7a9a8a]">{message}</p> : null}
      {error ? <p className="mt-2 text-[8px] text-red-300/90">{error}</p> : null}
    </div>
  );
}
