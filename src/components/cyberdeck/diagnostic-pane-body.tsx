'use client';

import {
  CyberdeckPaneHeader,
  CyberdeckPaneHeaderSubtitle,
  CyberdeckPaneHeaderTitle,
} from "@/components/cyberdeck/pane-header";
import { MUTHUR_MEMORY_STORAGE_KEY, type MuthurMemoryState } from "@/lib/muthur-memory";

type DiagnosticPaneBodyProps = {
  server: string;
  connectionState: "offline" | "connecting" | "connected";
  activeProvider: string;
  modelID: string;
  providerModelFetchStatus: "idle" | "retrieving" | "invalid-key" | "error" | "ready";
  voiceEnabled: boolean;
  voiceHealth: "idle" | "backend" | "fallback" | "off";
  muthurMemory: MuthurMemoryState;
  muthurMemoryHydrated: boolean;
  muthurMemoryLoadError: string | null;
  memoryContext: string;
  heapCount: number;
  chatCount: number;
};

const SERVER_LABEL: Record<string, string> = {
  m: "ØPERATOR",
  s: "MAINNET-UPLINK",
  b: "SETTINGS",
};

function formatMemoryUpdated(at: number) {
  if (!at) return "—";
  try {
    return new Date(at).toISOString();
  } catch {
    return String(at);
  }
}

function formatAgeMs(ms: number) {
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

function truncateLine(text: string, max: number) {
  const t = (text || "").replace(/\s+/g, " ").trim();
  if (!t) return "—";
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

export function CyberdeckDiagnosticPaneBody({
  server,
  connectionState,
  activeProvider,
  modelID,
  providerModelFetchStatus,
  voiceEnabled,
  voiceHealth,
  muthurMemory,
  muthurMemoryHydrated,
  muthurMemoryLoadError,
  memoryContext,
  heapCount,
  chatCount,
}: DiagnosticPaneBodyProps) {
  const railLabel = SERVER_LABEL[server] ?? server.toUpperCase();

  const factCount = muthurMemory.facts.length;
  const turnCount = muthurMemory.turnCount;
  const recentCount = muthurMemory.recentTurns.length;
  const lastTurn = muthurMemory.recentTurns[recentCount - 1];
  const lastTurnSnippet = lastTurn
    ? `${lastTurn.role}: ${truncateLine(lastTurn.text, 96)}`
    : "—";
  const summaryPreview = truncateLine(muthurMemory.summary, 140);
  const freshness =
    muthurMemoryHydrated && muthurMemory.updatedAt
      ? `${formatAgeMs(Date.now() - muthurMemory.updatedAt)} ago`
      : "—";

  return (
    <div className="custom-scrollbar flex h-full min-h-0 flex-1 flex-col overflow-y-auto bg-black p-3">
      <div className="flex min-h-0 flex-1 flex-col rounded-sm border border-[#141414] bg-black transition-colors">
        <CyberdeckPaneHeader
          left={
            <div className="flex flex-col">
              <CyberdeckPaneHeaderTitle style={{ textShadow: "0 0 6px rgba(138,138,138,0.2)" }}>
                DIAGNOSTICS
              </CyberdeckPaneHeaderTitle>
              <CyberdeckPaneHeaderSubtitle>STATUS PLANE // SESSION TELEMETRY</CyberdeckPaneHeaderSubtitle>
            </div>
          }
        />
        <div className="custom-scrollbar flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 py-4">
          <div className="rounded-sm border border-[#1c1c1c] bg-black/80 p-3 font-mono text-[10px] leading-snug text-[#8a8a8a]">
            SERVER RAIL // ACTIVE
            <div className="mt-2 whitespace-pre-wrap text-[#cfcfcf]">
              SLOT: {railLabel} ({server.toUpperCase()})
            </div>
          </div>
          <div className="rounded-sm border border-[#1c1c1c] bg-black/80 p-3 font-mono text-[10px] leading-snug text-[#8a8a8a]">
            UPLINK
            <div className="mt-2 text-[#cfcfcf]">
              STATE: {connectionState.toUpperCase()}
              <br />
              PROVIDER: {activeProvider.toUpperCase()}
              <br />
              MODEL: {modelID || "UNSET"}
              <br />
              PROVIDER_FETCH: {providerModelFetchStatus.toUpperCase()}
            </div>
          </div>
          <div className="rounded-sm border border-[#1c1c1c] bg-black/80 p-3 font-mono text-[10px] leading-snug text-[#8a8a8a]">
            VOICE // MUTHUR
            <div className="mt-2 text-[#cfcfcf]">
              ENABLED: {voiceEnabled ? "ON" : "OFF"}
              <br />
              HEALTH: {voiceHealth.toUpperCase()}
            </div>
          </div>
          <div className="rounded-sm border border-[#1c1c1c] bg-black/80 p-3 font-mono text-[10px] leading-snug text-[#8a8a8a]">
            MUTHUR MEMORY
            <div className="mt-2 text-[#cfcfcf]">
              STORAGE_KEY: {MUTHUR_MEMORY_STORAGE_KEY}
              <br />
              HYDRATED: {muthurMemoryHydrated ? "YES" : "NO"}
              <br />
              SCHEMA_VERSION:{" "}
              {typeof muthurMemory.schemaVersion === "number" ? muthurMemory.schemaVersion : "—"}
              <br />
              TURN_COUNT: {turnCount}
              <br />
              UPDATED_AT: {formatMemoryUpdated(muthurMemory.updatedAt)}
              <br />
              FRESHNESS: {freshness}
              <br />
              FACTS: {factCount}
              <br />
              RECENT_TURNS: {recentCount}
              <br />
              LAST_TURN: {lastTurnSnippet}
              <br />
              SUMMARY_PREVIEW: {summaryPreview}
            </div>
            {muthurMemoryLoadError ? (
              <div className="mt-2 rounded-sm border border-amber-900/60 bg-amber-950/30 p-2 text-[9px] leading-relaxed text-amber-200/90">
                LOAD_ERROR (IndexedDB read): {muthurMemoryLoadError}
              </div>
            ) : null}
            {factCount > 0 ? (
              <details className="mt-2 border-t border-[#1c1c1c] pt-2 text-[#cfcfcf] [&_summary]:cursor-pointer [&_summary]:text-[9px] [&_summary]:uppercase [&_summary]:tracking-[0.06em] [&_summary]:text-[#9a9a9a]">
                <summary className="select-none hover:text-[#cfcfcf]">LIST_FACTS ({factCount})</summary>
                <ul className="mt-1 max-h-[28vh] list-inside list-disc overflow-y-auto break-words pl-1 text-[9px] leading-relaxed text-green-200/85">
                  {muthurMemory.facts.map((f, i) => (
                    <li key={`${i}-${f}`}>{f}</li>
                  ))}
                </ul>
              </details>
            ) : null}
          </div>
          <div className="rounded-sm border border-[#1c1c1c] bg-black/80 p-3 font-mono text-[10px] leading-snug text-[#8a8a8a]">
            LOCAL STORES
            <div className="mt-2 text-[#cfcfcf]">
              HEAP_ENTRIES: {heapCount}
              <br />
              CHAT_MESSAGES (INCL. STREAM): {chatCount}
            </div>
          </div>
          <div className="flex min-h-0 flex-1 flex-col rounded-sm border border-[#1c1c1c] bg-black/80 p-3 font-mono text-[10px] leading-snug text-[#8a8a8a]">
            MEMORY CONTEXT (BUILD PREVIEW)
            <pre className="custom-scrollbar mt-2 max-h-[40vh] min-h-[8rem] flex-1 whitespace-pre-wrap break-words rounded-sm border border-[#1c1c1c] bg-black/60 p-2 text-[9px] leading-relaxed text-green-200/90">
              {memoryContext.trim() ? memoryContext : "—"}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
