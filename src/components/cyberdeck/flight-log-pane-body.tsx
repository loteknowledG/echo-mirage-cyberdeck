"use client";

import { useEffect, useRef, useState } from "react";
import {
  CyberdeckPaneHeader,
  CyberdeckPaneHeaderSubtitle,
  CyberdeckPaneHeaderTitle,
} from "@/components/cyberdeck/pane-header";
import { getFlightLogEntries, subscribeFlightLog, type FlightLogEntry } from "@/lib/flight-log";

function stamp(at: number | null) {
  if (!at) return "--:--:--";
  return new Date(at).toTimeString().slice(0, 8);
}

export function CyberdeckFlightLogPaneBody() {
  const [entries, setEntries] = useState<FlightLogEntry[]>(() => getFlightLogEntries());
  const [isPinnedToBottom, setIsPinnedToBottom] = useState(true);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => subscribeFlightLog(setEntries), []);

  useEffect(() => {
    if (!isPinnedToBottom) return;
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [entries, isPinnedToBottom]);

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
          <div className="rounded-sm border border-[#1c1c1c] bg-black/80 p-3 font-mono text-[10px] leading-relaxed text-green-200/90">
            {[...entries].slice(-200).map((entry) => (
              <div
                key={entry.id}
                className={
                  entry.result === "SUCCESS" || entry.result === "ONLINE"
                    ? "text-emerald-300"
                    : entry.result === "THINKING" || entry.result === "REVIEWING"
                      ? "text-amber-300"
                      : entry.result === "BLOCKED"
                        ? "text-red-300"
                        : "text-[#acacac]"
                }
              >
                [{stamp(entry.at)}] {entry.actor} :: {entry.action} :: {entry.result}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
