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

export function SurveyMirageExtCapturePanel() {
  const [tabs, setTabs] = useState<SurveyExtensionTabOption[]>([]);
  const [linkedTabId, setLinkedTabId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
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
    setMessage("Capturing active Chrome tab via echo-electron…");
    const result = await captureEchoExtensionActiveTab(resolveSurveyEchoDeckContext());
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      setMessage("");
      return;
    }
    setMessage(
      result.snapshotIngested
        ? `${result.message} · ingested on mirage-browser`
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

  const linkSelected = useCallback((tabId: number) => {
    writeLinkedEchoExtensionTabId(tabId);
    setLinkedTabId(tabId);
    const row = tabs.find((t) => t.tabId === tabId);
    setMessage(row ? `Linked · ${row.label}` : `Linked tabId ${tabId}`);
    setError("");
  }, [tabs]);

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
        ? `${result.message} · ingested on mirage-browser`
        : result.message,
    );
  }, [linkedTabId]);

  const linkedLabel = tabs.find((t) => t.tabId === linkedTabId)?.label;

  return (
    <div
      className="rounded border border-emerald-950/50 bg-black/40 p-3"
      data-survey-role="mirage"
      data-survey-runtime="browser"
      data-echo-agent="echo-extension"
    >
      <p className="mb-1 text-[9px] tracking-[0.08em] text-emerald-300/90">
        echo-extension · capture text
      </p>
      <p className="mb-3 text-[8px] leading-relaxed text-[#5f8f74]">
        Phase 1: Capture active tab via echo-electron on this PC. Use Mirage on{" "}
        <span className="text-emerald-300/80">local HTTP</span> (cyberdeck-electron or
        http://127.0.0.1/… ) — not Vercel HTTPS. Focus the target page in capture Chrome, then
        click below.
        {echoHostHint ? ` Echo host · ${echoHostHint}` : ""}
      </p>

      <div className="mb-3 flex flex-wrap gap-2">
        <CyberdeckActionButton disabled={busy} onClick={() => void captureActive()}>
          Capture active tab
        </CyberdeckActionButton>
      </div>

      <p className="mb-2 text-[8px] tracking-[0.06em] text-[#5f5f5f]">
        Phase 1.1 · pick by title (optional)
      </p>
      <div className="mb-2 flex flex-wrap gap-2">
        <CyberdeckActionButton disabled={busy} onClick={() => void refresh()}>
          Refresh tabs
        </CyberdeckActionButton>
        <CyberdeckActionButton
          disabled={busy || linkedTabId == null}
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
                  disabled={busy}
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
          Optional: Refresh to link a specific tab — echo-electron + echo-extension 0.2.1 on the
          capture PC.
        </p>
      )}

      {message ? <p className="mt-2 text-[8px] text-[#7a9a8a]">{message}</p> : null}
      {error ? <p className="mt-2 text-[8px] text-red-300/90">{error}</p> : null}
    </div>
  );
}
