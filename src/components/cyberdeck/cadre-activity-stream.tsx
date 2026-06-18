"use client";

import { useEffect, useState } from "react";

import { formatCadreEventLine, type CadreEvent } from "@/lib/cadre/cadre-events";
import { getCadreEventBuffer, subscribeCadreEvents } from "@/lib/cadre/cadre-event-bus";
import { cn } from "@/lib/utils";

function severityClass(severity: CadreEvent["severity"]): string {
  if (severity === "success") return "text-emerald-300/90";
  if (severity === "warning") return "text-amber-300/90";
  if (severity === "error") return "text-red-300/90";
  return "text-[#b8d4b8]";
}

type CadreActivityStreamProps = {
  className?: string;
  emptyLabel?: string;
};

export function useCadreActivityStream() {
  const [events, setEvents] = useState<CadreEvent[]>(() => getCadreEventBuffer());

  useEffect(() => {
    return subscribeCadreEvents((event) => {
      setEvents((prev) => {
        if (prev.some((entry) => entry.id === event.id)) return prev;
        return [...prev.slice(-119), event];
      });
    });
  }, []);

  return events;
}

export function CadreActivityStream({
  className,
  emptyLabel = "No workforce activity yet. CADRE events will appear here as agents start work.",
}: CadreActivityStreamProps) {
  const events = useCadreActivityStream();

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col rounded-sm border border-[#1c1c1c] bg-[#030303]", className)}>
      <div className="border-b border-[#141414] px-3 py-1.5 font-mono text-[8px] tracking-[0.1em] text-[#666]">
        CADRE ACTIVITY STREAM
      </div>
      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto p-3">
        {events.length === 0 ? (
          <p className="font-mono text-[10px] leading-relaxed text-[#666]">{emptyLabel}</p>
        ) : (
          <ul className="space-y-2">
            {events.map((event) => (
              <li
                key={event.id}
                className="border-l border-[#1f3f1f] pl-2 font-mono text-[10px] leading-snug"
              >
                <div className="text-[8px] tracking-[0.08em] text-[#555]">
                  {new Date(event.ts).toLocaleTimeString()}
                </div>
                <div className={severityClass(event.severity)}>{formatCadreEventLine(event)}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
