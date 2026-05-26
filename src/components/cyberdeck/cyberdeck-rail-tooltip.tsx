"use client";

import type { ReactNode } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/** ASCII box frame for rail hover labels — matches TerminalArt rail tab language. */
export function formatAsciiRailTooltipFrame(label: string): string {
  const text = label.toUpperCase().trim() || "PANE";
  const maxLen = 16;
  const clipped = text.length > maxLen ? `${text.slice(0, maxLen - 1)}…` : text;
  const inner = clipped.padEnd(Math.max(clipped.length, 4), " ");
  const bar = "─".repeat(inner.length + 2);
  return `┌${bar}┐\n│ ${inner} │\n└${bar}┘`;
}

export const CYBERDECK_RAIL_TOOLTIP_CONTENT_CLASS =
  "z-[60] border-0 bg-transparent p-0 text-transparent shadow-none animate-in fade-in-0 zoom-in-95";

type CyberdeckRailTabTooltipProps = {
  label: string;
  children: ReactNode;
};

/** Asciimorphism tooltip — opens to the right of the server rail tab. */
export function CyberdeckRailTabTooltip({ label, children }: CyberdeckRailTabTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="relative h-[52px] w-12 shrink-0 max-md:mr-2 max-md:snap-start">{children}</div>
      </TooltipTrigger>
      <TooltipContent
        side="right"
        align="center"
        sideOffset={10}
        collisionPadding={16}
        className={CYBERDECK_RAIL_TOOLTIP_CONTENT_CLASS}
      >
        <pre
          className={cn(
            "m-0 whitespace-pre font-mono text-[10px] leading-tight tracking-[0.04em]",
            "text-emerald-300/95 shadow-[2px_2px_0_0_#222]",
          )}
        >
          {formatAsciiRailTooltipFrame(label)}
        </pre>
      </TooltipContent>
    </Tooltip>
  );
}

export function CyberdeckRailTooltipProvider({ children }: { children: ReactNode }) {
  return (
    <TooltipProvider delayDuration={400} disableHoverableContent>
      {children}
    </TooltipProvider>
  );
}
