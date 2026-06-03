'use client';

import { useEffect, useState } from "react";
import { PanelLoader, type PanelLoadStage } from "@/features/cyberdeck/panel-loader";

const STARTUP_STAGES: Array<{ id: string; label: string }> = [
  { id: "runtime", label: "BOOTING RUNTIME" },
  { id: "memory", label: "WARMING MEMORY" },
  { id: "panes", label: "MOUNTING PANES" },
  { id: "signals", label: "LINKING SIGNALS" },
  { id: "workbench", label: "SYNCING WORKBENCH" },
];

const STARTUP_HINTS = [
  "HYDRATING CLIENT SHELL",
  "RESTORING OPERATOR STATE",
  "ATTACHING DECK SIGNALS",
  "PRIMING DOCUMENT SURFACES",
  "VERIFYING READY PATH",
];

function buildStageState(activeIndex: number): PanelLoadStage[] {
  return STARTUP_STAGES.map((stage, index) => ({
    id: stage.id,
    label: stage.label,
    status: index < activeIndex ? "done" : index === activeIndex ? "active" : "pending",
  }));
}

export function CyberdeckStartupLoader() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setStep((current) => (current + 1) % (STARTUP_STAGES.length + 2));
    }, 480);

    return () => window.clearInterval(timer);
  }, []);

  const activeIndex = Math.min(step, STARTUP_STAGES.length - 1);
  const stages = buildStageState(activeIndex);
  const activeHint = STARTUP_HINTS[step % STARTUP_HINTS.length];

  return (
    <div className="flex h-[100svh] min-h-0 w-full items-center justify-center bg-black px-4 py-8 text-emerald-300">
      <div className="w-full max-w-md border border-[#171717] bg-black/95 p-4 shadow-[0_0_0_1px_rgba(16,185,129,0.08),0_0_24px_rgba(0,0,0,0.35)]">
        <div className="mb-4 flex items-end justify-between gap-4 border-b border-[#1c1c1c] pb-2 font-mono text-[10px] tracking-[0.08em] text-[#727272]">
          <div>
            <div className="text-emerald-300/90">CYBERDECK // STARTUP</div>
            <div className="mt-1 text-[9px] text-[#666]">LOADING PANES, ROUTES, AND DOCUMENT SURFACES</div>
          </div>
          <div className="text-right text-[9px] text-[#5f5f5f]">AWAITING SHELL</div>
        </div>

        <PanelLoader
          label="CYBERDECK"
          stages={stages}
          activeHint={activeHint}
          showElapsed
        />

        <div className="mt-4 border-t border-[#1c1c1c] pt-3 font-mono text-[9px] tracking-[0.08em] text-[#666]">
          <div>TIP :: THE STARTUP VIEW SHARES THE SAME LOADER LANGUAGE AS PANES.</div>
          <div className="mt-1 text-[#535353]">STATUS :: {activeHint}</div>
        </div>
      </div>
    </div>
  );
}