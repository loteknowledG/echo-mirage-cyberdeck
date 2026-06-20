import type { DepthPanelPosture } from "@/components/realmorphism";
import type { RealmorphismControlOptions } from "@/lib/cyberdeck/realmorphism-control";
import { cn } from "@/lib/utils";

export function deckDepthPosture({
  signal,
  amber,
  critical,
  danger,
}: Pick<RealmorphismControlOptions, "signal" | "amber" | "critical" | "danger">): DepthPanelPosture {
  if (critical || danger) return "critical";
  if (amber) return "amber";
  if (signal) return "signal";
  return "neutral";
}

export function deckDepthFaceClass({
  size = "icon",
  menu,
}: Pick<RealmorphismControlOptions, "size" | "menu">): string {
  return cn(
    "inline-flex min-w-0 items-center justify-center font-mono shrink-0 border-0 bg-transparent p-0",
    size === "compact" && "h-8 min-w-[1.75rem] px-1 text-[11px]",
    size === "icon" && "h-8 w-8 text-[10px]",
    size === "toolbar" && "h-7 w-7 text-[10px]",
    size === "send" && "h-9 w-9 text-[10px]",
    size === "micro" && "h-5 w-5 text-[9px] tracking-[0.08em]",
    size === "action" && "px-2 py-1.5 text-[9px] tracking-[0.08em]",
    size === "filter" && "px-2 py-1.5 text-[9px] tracking-[0.08em]",
    size === "wide" && "w-full justify-start gap-1.5 px-3 py-1.5 text-[9px] tracking-[0.08em]",
    size === "tile" && "w-full justify-start px-2 py-2 text-left text-[9px] tracking-[0.06em]",
    (size === "menu" || menu) &&
      "w-full justify-start gap-1.5 px-3 py-1.5 text-left text-[10px] tracking-[0.08em]",
  );
}

export function muthurVoiceControlOptions(
  voiceEnabled: boolean,
  voiceHealth: "idle" | "backend" | "fallback" | "off",
): RealmorphismControlOptions {
  return {
    size: "icon",
    signal: voiceEnabled && voiceHealth !== "fallback" && voiceHealth !== "off",
    amber: voiceEnabled && voiceHealth === "fallback",
    off: !voiceEnabled || voiceHealth === "off",
  };
}

/** @deprecated Use deckDepthPosture */
export const muthurDepthPosture = deckDepthPosture;

/** @deprecated Use deckDepthFaceClass */
export const muthurDepthFaceClass = deckDepthFaceClass;
