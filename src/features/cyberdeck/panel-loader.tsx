"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export type PanelLoadStageStatus = "pending" | "active" | "done";

export type PanelLoadStage = {
  id: string;
  label: string;
  status: PanelLoadStageStatus;
};

type PanelLoaderProps = {
  label?: string;
  stages?: PanelLoadStage[];
  /** Sub-status while the main chunk is compiling (e.g. MARKDOWN RENDERER). */
  activeHint?: string;
  showElapsed?: boolean;
};

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}m ${remainder.toString().padStart(2, "0")}s`;
}

function stageGlyph(status: PanelLoadStageStatus): string {
  switch (status) {
    case "done":
      return "[✓]";
    case "active":
      return "[▸]";
    default:
      return "[ ]";
  }
}

/** Placeholder while a deferred cyberdeck subsystem chunk loads. */
export function PanelLoader({
  label = "SUBSYSTEM",
  stages,
  activeHint,
  showElapsed = true,
}: PanelLoaderProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [pulseOn, setPulseOn] = useState(true);

  useEffect(() => {
    if (!showElapsed) return;
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [showElapsed]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setPulseOn((prev) => !prev);
    }, 520);
    return () => window.clearInterval(timer);
  }, []);

  const hasStages = stages && stages.length > 0;
  const activeStage = stages?.find((stage) => stage.status === "active");

  return (
    <div
      className="flex min-h-[8rem] flex-1 flex-col items-center justify-center gap-3 bg-black p-6 font-mono text-[10px] tracking-[0.08em] text-[#6a6a6a]"
      aria-busy="true"
      aria-live="polite"
      aria-label={`${label} loading`}
    >
      <div className="panel-loader-bar" aria-hidden />

      <div className="flex flex-col items-center gap-1 text-center">
        <span className="panel-loader-wave text-[11px] tracking-[0.12em] text-emerald-300/90">
          {label} // LOADING
        </span>
        {activeStage ? (
          <span className="text-[9px] tracking-[0.1em] text-[#8a8a8a]">
            STAGE :: {activeStage.label}
          </span>
        ) : null}
        {activeHint ? (
          <span className="text-[9px] tracking-[0.08em] text-emerald-500/75">
            LINKING :: {activeHint}
            <span className={pulseOn ? "opacity-100" : "opacity-20"}> ▮</span>
          </span>
        ) : null}
      </div>

      {hasStages ? (
        <ul className="w-full max-w-xs space-y-1 border border-[#1a1a1a] bg-black/80 px-3 py-2 text-[9px] tracking-[0.06em]">
          {stages.map((stage) => (
            <li
              key={stage.id}
              className={cn(
                "flex items-center gap-2 transition-colors duration-300",
                stage.status === "done" && "text-emerald-400/85",
                stage.status === "active" && "text-emerald-200",
                stage.status === "pending" && "text-[#505050]",
              )}
            >
              <span aria-hidden>{stageGlyph(stage.status)}</span>
              <span className="truncate">{stage.label}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex items-center gap-2 text-[9px] tracking-[0.1em] text-[#707070]">
          <span className="panel-loader-wave">COMPILING MODULE</span>
          <span className={pulseOn ? "text-emerald-400/90" : "text-emerald-400/20"}>█</span>
        </div>
      )}

      {showElapsed ? (
        <div className="text-[9px] tracking-[0.08em] text-[#555]">
          ELAPSED :: {formatElapsed(elapsedSeconds)}
          {elapsedSeconds >= 8 ? (
            <span className="mt-1 block text-[8px] tracking-[0.06em] text-[#666]">
              COLD COMPILE — STILL NOMINAL
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="h-px w-16 bg-emerald-500/35" aria-hidden />
    </div>
  );
}
