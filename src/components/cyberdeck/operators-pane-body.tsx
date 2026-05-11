"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CyberdeckPaneHeader,
  CyberdeckPaneHeaderSubtitle,
  CyberdeckPaneHeaderTitle,
} from "@/components/cyberdeck/pane-header";
import { appendFlightLog } from "@/lib/flight-log";

type OperatorStatus = "ONLINE" | "THINKING" | "REVIEWING" | "IDLE" | "BLOCKED";
type OperatorCard = { callsign: string; role: string };

const OPERATOR_CARDS: OperatorCard[] = [
  { callsign: "ChatGPT", role: "Lead" },
  { callsign: "Cursor", role: "Dev" },
  { callsign: "Codex", role: "Test" },
  { callsign: "Samus-Manus", role: "Memory" },
];

const STATUSES: OperatorStatus[] = ["ONLINE", "THINKING", "REVIEWING", "IDLE", "BLOCKED"];

function statusTone(status: OperatorStatus) {
  if (status === "ONLINE") return "text-emerald-300 border-emerald-600/50";
  if (status === "THINKING" || status === "REVIEWING") return "text-amber-300 border-amber-600/50";
  if (status === "BLOCKED") return "text-red-300 border-red-600/50";
  return "text-[#a0a0a0] border-[#2a2a2a]";
}

function statusBar(status: OperatorStatus) {
  if (status === "ONLINE") return "bg-emerald-400/80";
  if (status === "THINKING" || status === "REVIEWING") return "bg-amber-400/80";
  if (status === "BLOCKED") return "bg-red-400/80";
  return "bg-[#555]";
}

function randomStatus(index: number): OperatorStatus {
  const jitter = Math.floor(Math.random() * STATUSES.length);
  return STATUSES[(index + jitter) % STATUSES.length]!;
}

export function CyberdeckOperatorsPaneBody() {
  const [statusMap, setStatusMap] = useState<Record<string, OperatorStatus>>(() =>
    Object.fromEntries(OPERATOR_CARDS.map((operator, index) => [operator.callsign, randomStatus(index)])),
  );

  useEffect(() => {
    const timer = window.setInterval(() => {
      setStatusMap((prev) => {
        const next = { ...prev };
        const pick = OPERATOR_CARDS[Math.floor(Math.random() * OPERATOR_CARDS.length)];
        if (!pick) return prev;
        const nextStatus = randomStatus(Math.floor(Math.random() * 7));
        next[pick.callsign] = nextStatus;
        if (Math.random() > 0.55) {
          appendFlightLog({
            actor: pick.callsign.toUpperCase(),
            action: "status rotation",
            result: nextStatus,
          });
        }
        return next;
      });
    }, 3200);
    return () => window.clearInterval(timer);
  }, []);

  const onlineCount = useMemo(
    () => OPERATOR_CARDS.filter((operator) => statusMap[operator.callsign] === "ONLINE").length,
    [statusMap],
  );

  return (
    <div className="custom-scrollbar flex h-full min-h-0 flex-1 flex-col overflow-y-auto bg-black p-3">
      <div className="flex min-h-0 flex-1 flex-col rounded-sm border border-[#141414] bg-black transition-colors">
        <CyberdeckPaneHeader
          left={
            <div className="flex flex-col">
              <CyberdeckPaneHeaderTitle style={{ textShadow: "0 0 6px rgba(138,138,138,0.2)" }}>
                OPERATORS
              </CyberdeckPaneHeaderTitle>
              <CyberdeckPaneHeaderSubtitle>SYNTH CREW // LIVE STATUS FEED</CyberdeckPaneHeaderSubtitle>
            </div>
          }
          right={<div className="font-mono text-[9px] text-[#9a9a9a]">{onlineCount}/4 ONLINE</div>}
        />
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 p-3 md:grid-cols-2">
          {OPERATOR_CARDS.map((operator) => {
            const status = statusMap[operator.callsign] ?? "IDLE";
            return (
              <div
                key={operator.callsign}
                className={`rounded-sm border bg-black/80 p-3 font-mono text-[10px] ${statusTone(status)}`}
              >
                <div className="text-[#d8d8d8]">{operator.callsign.toUpperCase()} // {operator.role.toUpperCase()}</div>
                <div className="mt-2 text-[9px] tracking-[0.08em]">{status}</div>
                <div className="mt-2 h-1.5 w-full rounded bg-[#141414]">
                  <div className={`h-full rounded ${statusBar(status)} ${status !== "IDLE" ? "animate-pulse" : ""}`} style={{ width: `${status === "ONLINE" ? 92 : status === "THINKING" || status === "REVIEWING" ? 66 : status === "BLOCKED" ? 22 : 40}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
