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
  "z-[100] rounded border border-[#2d2d2d] bg-black px-2 py-1 text-center font-mono text-[9px] tracking-[0.06em] text-emerald-200 shadow-md";

type CyberdeckPaneTooltipProps = {
  label: string;
  children: ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  contentClassName?: string;
};

/** Pane tooltip — prefers top so labels stay clear of the cursor. */
export function CyberdeckPaneTooltip({
  label,
  children,
  side = "top",
  align = "center",
  contentClassName,
}: CyberdeckPaneTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent
        side={side}
        align={align}
        sideOffset={8}
        collisionPadding={12}
        className={cn(CYBERDECK_PANE_TOOLTIP_CLASS, contentClassName)}
      >
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

type CyberdeckControlTooltipProps = {
  label: string;
  children: ReactNode;
  disabled?: boolean;
  side?: "top" | "right" | "bottom" | "left";
};

/** Icon/control tooltip — top by default; disabled controls skip pointer capture. */
export function CyberdeckControlTooltip({
  label,
  children,
  disabled = false,
  side = "top",
}: CyberdeckControlTooltipProps) {
  const trigger = disabled ? (
    <span className="ascii-morph-btn-tooltip-wrap">{children}</span>
  ) : (
    children
  );

  return (
    <CyberdeckPaneTooltip label={label} side={side}>
      {trigger}
    </CyberdeckPaneTooltip>
  );
}

export { TooltipProvider as CyberdeckPaneTooltipProvider };
