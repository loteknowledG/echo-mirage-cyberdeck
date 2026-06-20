"use client";

import type { MuthurCognitionMode } from "@/lib/muthur/cognition/muthur-cognition-types";
import { cn } from "@/lib/utils";

const COGNITION_MODE_OPTIONS: Array<{
  id: MuthurCognitionMode;
  label: string;
  glyph: string;
  title: string;
}> = [
  { id: "off", label: "OFF", glyph: "○", title: "No cognition output" },
  { id: "summary", label: "SUMMARY", glyph: "◐", title: "Periodic summarized insights" },
  { id: "live", label: "LIVE", glyph: "●", title: "Stream cognition events as they occur" },
];

type MuthurCognitionModeControlProps = {
  mode: MuthurCognitionMode;
  disabled?: boolean;
  onChange: (mode: MuthurCognitionMode) => void;
  className?: string;
};

export function MuthurCognitionModeControl({
  mode,
  disabled = false,
  onChange,
  className,
}: MuthurCognitionModeControlProps) {
  return (
    <div
      className={cn(
        "rounded border border-[#1c1c1c] bg-black/80 px-2 py-1.5 font-mono text-[9px] tracking-[0.04em]",
        className,
      )}
    >
      <div className="mb-1 text-[#707070]">MUTHUR COGNITION</div>
      <div className="flex flex-wrap gap-1">
        {COGNITION_MODE_OPTIONS.map((option) => {
          const active = mode === option.id;
          return (
            <button
              key={option.id}
              type="button"
              disabled={disabled}
              title={option.title}
              aria-pressed={active}
              onClick={() => onChange(option.id)}
              className={cn(
                "rounded border px-1.5 py-0.5 transition-colors",
                active
                  ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300/90"
                  : "border-[#2a2a2a] bg-black text-[#8a8a8a] hover:border-[#3a3a3a] hover:text-[#bdbdbd]",
                disabled && "pointer-events-none opacity-40",
              )}
            >
              <span className="mr-1">{option.glyph}</span>
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
