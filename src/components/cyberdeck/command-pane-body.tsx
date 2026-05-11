"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  CyberdeckPaneHeader,
  CyberdeckPaneHeaderSubtitle,
  CyberdeckPaneHeaderTitle,
} from "@/components/cyberdeck/pane-header";
import { emitSignal } from "@/lib/cyberdeck/signal-router";

type CommandPaneBodyProps = {
  server: string;
};

function clockStamp() {
  const now = new Date();
  return now.toTimeString().slice(0, 8);
}

export function CyberdeckCommandPaneBody({ server }: CommandPaneBodyProps) {
  const [commandInput, setCommandInput] = useState("");
  const [localLog, setLocalLog] = useState<string[]>([]);
  const ackTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (ackTimerRef.current !== null && typeof window !== "undefined") {
        window.clearTimeout(ackTimerRef.current);
      }
    };
  }, []);

  const quickActions = useMemo(
    () => [
      { cmd: "SCAN UPLINK", desc: "Probe active provider lane" },
      { cmd: "OPEN DIAGNOSTICS", desc: "Shift rail to diagnostics panel" },
      { cmd: "SYNC MEMORY", desc: "Read MUTHUR continuity summary" },
      { cmd: "ROTATE OPERATORS", desc: "Force operator status sweep" },
      { cmd: "PING BRIDGE", desc: "Validate command relay path" },
    ],
    [],
  );

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const line = commandInput.trim();
    if (!line) return;
    const stamped = `[${clockStamp()}] COMMAND > ${line}`;
    setLocalLog((prev) => [...prev.slice(-39), stamped]);
    emitSignal({
      source: "command",
      type: "submitted",
      payload: { text: line, server },
      severity: "info",
    });

    const isOpenAtlas = /^open\s+atlas\b/i.test(line);

    if (typeof window !== "undefined") {
      if (ackTimerRef.current !== null) {
        window.clearTimeout(ackTimerRef.current);
      }
      const delay = 1100 + Math.floor(Math.random() * 200);
      ackTimerRef.current = window.setTimeout(() => {
        ackTimerRef.current = null;
        emitSignal({
          source: "operators",
          type: "acknowledged",
          payload: {
            callsign: "ChatGPT // Lead",
            text: `routing command to Memory Atlas :: ${line}`,
            ref: line,
          },
          severity: "info",
        });
        if (isOpenAtlas) {
          emitSignal({
            source: "system",
            type: "navigate",
            payload: { target: "memory-atlas" },
            severity: "info",
          });
        }
      }, delay);
    }

    setCommandInput("");
  };

  return (
    <div className="custom-scrollbar flex h-full min-h-0 flex-1 flex-col overflow-y-auto bg-black p-3">
      <div className="flex min-h-0 flex-1 flex-col rounded-sm border border-[#141414] bg-black transition-colors">
        <CyberdeckPaneHeader
          left={
            <div className="flex flex-col">
              <CyberdeckPaneHeaderTitle style={{ textShadow: "0 0 6px rgba(138,138,138,0.2)" }}>
                COMMAND
              </CyberdeckPaneHeaderTitle>
              <CyberdeckPaneHeaderSubtitle>QUICK ACTION BUS // {server.toUpperCase()}</CyberdeckPaneHeaderSubtitle>
            </div>
          }
        />
        <div className="custom-scrollbar flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
          <div className="rounded-sm border border-[#1c1c1c] bg-black/80 p-3 font-mono text-[10px] leading-snug text-[#7d7d7d]">
            {quickActions.map((action) => (
              <div key={action.cmd} className="py-0.5">
                <span className="text-[#cfcfcf]">&gt; {action.cmd}</span> :: {action.desc}
              </div>
            ))}
          </div>
          <div className="flex min-h-0 flex-1 flex-col rounded-sm border border-[#1c1c1c] bg-black/70 p-3">
            <div className="mb-2 font-mono text-[9px] tracking-[0.08em] text-[#8a8a8a]">LOCAL ECHO LOG</div>
            <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto rounded-sm border border-[#1c1c1c] bg-black/75 p-2 font-mono text-[10px] leading-relaxed text-green-200/90">
              {localLog.length === 0 ? "NO COMMANDS FIRED." : localLog.join("\n")}
            </div>
            <form onSubmit={submit} className="mt-3 flex items-center gap-2">
              <span className="font-mono text-[10px] text-emerald-300">COMMAND &gt;</span>
              <input
                value={commandInput}
                onChange={(event) => setCommandInput(event.target.value)}
                className="min-w-0 flex-1 border border-[#2d2d2d] bg-black px-2 py-1 font-mono text-[10px] tracking-[0.05em] text-[#d6d6d6] outline-none focus:border-emerald-600/70"
                spellCheck={false}
                placeholder="type mock command and press enter"
              />
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
