"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  CyberdeckPaneHeader,
  CyberdeckPaneHeaderSubtitle,
  CyberdeckPaneHeaderTitle,
} from "@/components/cyberdeck/pane-header";
import { appendFlightLog } from "@/lib/flight-log";

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
    appendFlightLog({
      actor: "COMMAND",
      action: line.toLowerCase(),
      result: "QUEUED",
    });
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
