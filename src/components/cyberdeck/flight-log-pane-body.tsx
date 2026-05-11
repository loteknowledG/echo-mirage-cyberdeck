"use client";

import { useEffect, useState } from "react";
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

  useEffect(() => subscribeFlightLog(setEntries), []);

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
        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto p-3">
          <div className="rounded-sm border border-[#1c1c1c] bg-black/80 p-3 font-mono text-[10px] leading-relaxed text-green-200/90">
            {entries.map((entry) => (
              <div key={entry.id}>
                [{stamp(entry.at)}] {entry.actor} :: {entry.action} :: {entry.result}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
