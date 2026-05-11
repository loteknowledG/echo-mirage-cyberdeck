"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CyberdeckPaneHeader,
  CyberdeckPaneHeaderSubtitle,
  CyberdeckPaneHeaderTitle,
} from "@/components/cyberdeck/pane-header";
import { getFlightLogEntries, subscribeFlightLog, type FlightLogEntry } from "@/lib/flight-log";
import { useSignalHistory, type DeckSignal } from "@/lib/cyberdeck/signal-router";

type FlightLogView = "log" | "signals";

function stamp(at: number | null) {
  if (!at) return "--:--:--";
  return new Date(at).toTimeString().slice(0, 8);
}

function tsStamp(ts: string): string {
  try {
    return new Date(ts).toTimeString().slice(0, 8);
  } catch {
    return "--:--:--";
  }
}

function payloadPreview(payload: DeckSignal["payload"]): string {
  if (!payload) return "—";
  try {
    const raw = JSON.stringify(payload);
    if (raw.length <= 60) return raw;
    return `${raw.slice(0, 57)}…`;
  } catch {
    return "[unserializable]";
  }
}

function severityTone(severity: DeckSignal["severity"]): string {
  switch (severity) {
    case "success":
      return "text-emerald-300";
    case "warning":
      return "text-amber-300";
    case "error":
      return "text-red-300";
    default:
      return "text-[#a8a8a8]";
  }
}

export function CyberdeckFlightLogPaneBody() {
  const [entries, setEntries] = useState<FlightLogEntry[]>(() => getFlightLogEntries());
  const [isPinnedToBottom, setIsPinnedToBottom] = useState(true);
  const [view, setView] = useState<FlightLogView>("log");
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const signals = useSignalHistory(20);

  useEffect(() => subscribeFlightLog(setEntries), []);

  useEffect(() => {
    if (!isPinnedToBottom) return;
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [entries, signals, isPinnedToBottom, view]);

  const recentSignals = useMemo(() => signals.slice(-20), [signals]);

  return (
    <div className="custom-scrollbar flex h-full min-h-0 flex-1 flex-col overflow-y-auto bg-black p-3">
      <div className="flex min-h-0 flex-1 flex-col rounded-sm border border-[#141414] bg-black transition-colors">
        <CyberdeckPaneHeader
          left={
            <div className="flex flex-col">
              <CyberdeckPaneHeaderTitle style={{ textShadow: "0 0 6px rgba(138,138,138,0.2)" }}>
                FLIGHT LOG
              </CyberdeckPaneHeaderTitle>
              <CyberdeckPaneHeaderSubtitle>OPERATIONS TRACE // LOCAL BUS</CyberdeckPaneHeaderSubtitle>
            </div>
          }
          right={
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setView("log")}
                className={`rounded-sm border px-2 py-1 font-mono text-[9px] tracking-[0.08em] transition ${
                  view === "log"
                    ? "border-emerald-500/60 text-emerald-200"
                    : "border-[#2d2d2d] text-[#9a9a9a] hover:border-emerald-500/50 hover:text-emerald-100"
                }`}
                aria-pressed={view === "log"}
              >
                [ LOG ]
              </button>
              <button
                type="button"
                onClick={() => setView("signals")}
                className={`rounded-sm border px-2 py-1 font-mono text-[9px] tracking-[0.08em] transition ${
                  view === "signals"
                    ? "border-amber-500/60 text-amber-200"
                    : "border-[#2d2d2d] text-[#9a9a9a] hover:border-amber-500/50 hover:text-amber-100"
                }`}
                aria-pressed={view === "signals"}
              >
                [ SIGNALS ]
              </button>
            </div>
          }
        />
        <div
          ref={scrollRef}
          className="custom-scrollbar min-h-0 flex-1 overflow-y-auto p-3"
          onScroll={(event) => {
            const el = event.currentTarget;
            const threshold = 12;
            setIsPinnedToBottom(el.scrollHeight - el.scrollTop - el.clientHeight <= threshold);
          }}
        >
          {view === "log" ? (
            <div className="rounded-sm border border-[#1c1c1c] bg-black/80 p-3 font-mono text-[10px] leading-relaxed text-green-200/90">
              {[...entries].slice(-200).map((entry) => {
                const sev = entry.severity;
                const toneClass =
                  sev === "success"
                    ? "text-emerald-300"
                    : sev === "warning"
                      ? "text-amber-300"
                      : sev === "error"
                        ? "text-red-300"
                        : entry.result === "SUCCESS" || entry.result === "ONLINE"
                          ? "text-emerald-300"
                          : entry.result === "THINKING" || entry.result === "REVIEWING"
                            ? "text-amber-300"
                            : entry.result === "BLOCKED"
                              ? "text-red-300"
                              : "text-[#acacac]";
                return (
                  <div key={entry.id} className={toneClass}>
                    [{stamp(entry.at)}] {entry.actor} :: {entry.action} :: {entry.result}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-sm border border-[#1c1c1c] bg-black/80 p-2 font-mono text-[9px] leading-relaxed">
              <div className="grid grid-cols-[64px_70px_110px_60px_1fr] gap-x-2 border-b border-[#1c1c1c] pb-1 text-[8px] tracking-[0.08em] text-[#6f6f6f]">
                <div>TIME</div>
                <div>SOURCE</div>
                <div>TYPE</div>
                <div>SEV</div>
                <div>PAYLOAD</div>
              </div>
              {recentSignals.length === 0 ? (
                <div className="px-1 py-2 text-[#7a7a7a]">NO SIGNALS RECEIVED.</div>
              ) : (
                recentSignals.map((signal) => (
                  <div
                    key={signal.id}
                    className={`grid grid-cols-[64px_70px_110px_60px_1fr] gap-x-2 border-b border-[#161616] py-0.5 ${severityTone(
                      signal.severity,
                    )}`}
                  >
                    <div className="text-[#9a9a9a]">{tsStamp(signal.ts)}</div>
                    <div className="text-[#cfcfcf]">{signal.source}</div>
                    <div className="text-[#cfcfcf]">{signal.type}</div>
                    <div>{(signal.severity ?? "info").toUpperCase()}</div>
                    <div className="truncate text-[#a8a8a8]">{payloadPreview(signal.payload)}</div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
