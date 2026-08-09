"use client";

import { useEffect, useState } from "react";
import {
  resolveCyberdeckRuntimeBadge,
  type CyberdeckRuntimeBadge,
} from "@/lib/cyberdeck/cyberdeck-runtime-badge.client";
import { cn } from "@/lib/utils";

type CyberdeckRuntimeBadgeProps = {
  className?: string;
};

export function CyberdeckRuntimeBadge({ className }: CyberdeckRuntimeBadgeProps) {
  const [badge, setBadge] = useState<CyberdeckRuntimeBadge>(() => resolveCyberdeckRuntimeBadge());

  useEffect(() => {
    setBadge(resolveCyberdeckRuntimeBadge());
  }, []);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 font-mono text-[9px] tracking-[0.08em]",
        className,
      )}
      style={{
        borderColor: `${badge.accent}66`,
        color: badge.accent,
        backgroundColor: `${badge.accent}14`,
      }}
      title={`Runtime: ${badge.label}`}
      data-testid="cyberdeck-runtime-badge"
    >
      <span aria-hidden="true">{badge.shortLabel}</span>
      <span>{badge.label}</span>
    </span>
  );
}
