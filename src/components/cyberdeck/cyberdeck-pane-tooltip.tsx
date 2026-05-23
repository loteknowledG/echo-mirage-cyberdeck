'use client';

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export const CYBERDECK_PANE_TOOLTIP_CLASS =
  "z-50 rounded border border-[#2d2d2d] bg-black px-2 py-1 text-right font-mono text-[9px] tracking-[0.06em] text-emerald-200 shadow-md";

type CyberdeckPaneTooltipProps = {
  label: string;
  children: ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  contentClassName?: string;
};

/** Side-positioned pane tooltip — matches operator type picker styling. */
export function CyberdeckPaneTooltip({
  label,
  children,
  side = "right",
  align = "end",
  contentClassName,
}: CyberdeckPaneTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent
        side={side}
        align={align}
        sideOffset={6}
        className={cn(CYBERDECK_PANE_TOOLTIP_CLASS, contentClassName)}
      >
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

export { TooltipProvider as CyberdeckPaneTooltipProvider };
