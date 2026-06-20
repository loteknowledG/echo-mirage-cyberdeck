"use client";

import { useMemo } from "react";
import { CyberdeckRollingPicker } from "@/components/cyberdeck/cyberdeck-rolling-picker";
import {
  CyberdeckPaneTooltip,
  CyberdeckPaneTooltipProvider,
} from "@/components/cyberdeck/cyberdeck-pane-tooltip";
import {
  MUTHUR_POSTURE_SELECTOR,
  MUTHUR_POSTURES,
  getMuthurPostureMeta,
  normalizeMuthurPosture,
  type MuthurPosture,
} from "@/lib/muthur/muthur-posture";

const POSTURE_GLYPHS: Record<MuthurPosture, string> = {
  plan: "P",
  agent: "A",
  commander: "C",
};

type MuthurPostureRollerProps = {
  posture: MuthurPosture;
  disabled?: boolean;
  onChange: (posture: MuthurPosture) => void;
};

/** Y-axis rolodex — Plan / Agent / Commander postures. */
export function MuthurPostureRoller({
  posture,
  disabled = false,
  onChange,
}: MuthurPostureRollerProps) {
  const resolvedPosture = normalizeMuthurPosture(posture);
  const activeMeta = getMuthurPostureMeta(resolvedPosture);

  const selectorMeta = useMemo(
    () =>
      MUTHUR_POSTURE_SELECTOR.map((id) => MUTHUR_POSTURES.find((entry) => entry.id === id)).filter(
        (entry): entry is (typeof MUTHUR_POSTURES)[number] => Boolean(entry),
      ),
    [],
  );

  const items = useMemo(
    () =>
      selectorMeta.map((entry) => ({
        value: entry.id,
        label: entry.label.toUpperCase(),
        slide: (
          <span className="font-mono text-[9px] leading-none tracking-[0.06em]">
            {POSTURE_GLYPHS[entry.id]}
          </span>
        ),
      })),
    [selectorMeta],
  );

  return (
    <CyberdeckPaneTooltipProvider delayDuration={300} disableHoverableContent>
      <CyberdeckPaneTooltip label={activeMeta.title} side="top">
        <div className={disabled ? "pointer-events-none opacity-40" : undefined}>
          <CyberdeckRollingPicker
            items={items}
            value={resolvedPosture}
            onChange={(next) => onChange(normalizeMuthurPosture(next))}
            ariaLabel="MUTHUR posture"
            viewportClassName="h-7 min-w-[3rem] w-auto max-w-[5.25rem]"
            alwaysShowLabel
            showTextWhileScrolling
            loop
          />
        </div>
      </CyberdeckPaneTooltip>
    </CyberdeckPaneTooltipProvider>
  );
}
