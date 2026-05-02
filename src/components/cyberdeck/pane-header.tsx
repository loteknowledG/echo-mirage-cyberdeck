'use client';

import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

type PaneHeaderProps = {
  left: ReactNode;
  right?: ReactNode;
  className?: string;
  leftClassName?: string;
  rightClassName?: string;
};

type LabelProps = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
};

export function CyberdeckPaneHeader({
  left,
  right,
  className,
  leftClassName,
  rightClassName,
}: PaneHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between border-b border-[#141414] px-3 py-2", className)}>
      <div className={cn("min-w-0 flex-1 pr-3", leftClassName)}>{left}</div>
      {right ? <div className={cn("min-w-0 pt-[1px]", rightClassName)}>{right}</div> : null}
    </div>
  );
}

export function CyberdeckPaneHeaderTitle({ children, className, style }: LabelProps) {
  return (
    <div
      className={cn("truncate font-mono text-[10px] tracking-[0.04em] text-[#8a8a8a]", className)}
      style={style}
    >
      {children}
    </div>
  );
}

export function CyberdeckPaneHeaderSubtitle({ children, className, style }: LabelProps) {
  return (
    <div className={cn("mt-1 font-mono text-[9px] tracking-[0.04em] text-[#6f6f6f]", className)} style={style}>
      {children}
    </div>
  );
}

export function CyberdeckPaneHeaderValue({ children, className, style }: LabelProps) {
  return (
    <div className={cn("font-mono text-[9px] tracking-[0.08em] text-[#8a8a8a]", className)} style={style}>
      {children}
    </div>
  );
}
