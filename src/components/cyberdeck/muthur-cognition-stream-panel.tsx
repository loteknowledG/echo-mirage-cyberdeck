"use client";

import type {
  MuthurCognitionMode,
  MuthurCognitionStreamEntry,
} from "@/lib/muthur/cognition/muthur-cognition-types";
import { shouldShowMuthurCognitionStream } from "@/lib/muthur/cognition/muthur-cognition-channel";
import { cn } from "@/lib/utils";

type MuthurCognitionStreamPanelProps = {
  mode: MuthurCognitionMode;
  stream: MuthurCognitionStreamEntry[];
  className?: string;
};

export function MuthurCognitionStreamPanel({
  mode,
  stream,
  className,
}: MuthurCognitionStreamPanelProps) {
  if (!shouldShowMuthurCognitionStream(mode)) {
    return null;
  }

  const visible = [...stream].reverse();

  return (
    <div
      className={cn(
        "rounded border border-[#1c1c1c] bg-black/80 px-2 py-1.5 font-mono text-[9px] leading-relaxed tracking-[0.04em]",
        className,
      )}
    >
      <div className="mb-1 flex items-center justify-between gap-2 text-[#707070]">
        <span>COGNITION STREAM</span>
        <span className="text-[#555]">{mode.toUpperCase()}</span>
      </div>
      {visible.length === 0 ? (
        <p className="text-[#666]">Waiting for cognition events…</p>
      ) : (
        <ul className="max-h-40 space-y-1.5 overflow-y-auto">
          {visible.map((entry) => (
            <li
              key={entry.id}
              className={cn(
                "whitespace-pre-wrap rounded border px-1.5 py-1",
                entry.kind === "summary"
                  ? "border-[#243024] bg-[#071407]/80 text-[#9a9a9a]"
                  : "border-[#1f1f1f] bg-black/60 text-[#8a8a8a]",
              )}
            >
              {entry.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
