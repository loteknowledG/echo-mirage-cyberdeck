"use client";

import { ShineBorder } from "@/components/ui/shine-border";
import { cn } from "@/lib/utils";

const CYBERDECK_RESIZE_SHINE = [
  "transparent",
  "rgba(52, 211, 153, 0.35)",
  "rgba(52, 211, 153, 0.95)",
  "rgba(34, 211, 238, 0.55)",
  "transparent",
];

type ShineResizeEdgeProps = {
  orientation?: "vertical" | "horizontal";
  className?: string;
  duration?: number;
};

/** Animated shine on draggable split edges — helps users spot resize handles. */
export function ShineResizeEdge({
  orientation = "vertical",
  className,
  duration = 8,
}: ShineResizeEdgeProps) {
  return (
    <>
      <ShineBorder
        aria-hidden
        borderWidth={1}
        duration={duration}
        shineColor={CYBERDECK_RESIZE_SHINE}
        className={cn("cyberdeck-resize-edge-shine rounded-none opacity-80", className)}
      />
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute z-[1]",
          orientation === "vertical"
            ? "cyberdeck-resize-edge-travel-vertical inset-y-1 left-1/2 w-px -translate-x-1/2"
            : "cyberdeck-resize-edge-travel-horizontal inset-x-1 top-1/2 h-px -translate-y-1/2",
        )}
      />
    </>
  );
}
