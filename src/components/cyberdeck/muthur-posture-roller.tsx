"use client";

import { useMemo } from "react";
import { CyberdeckRollingPicker } from "@/components/cyberdeck/cyberdeck-rolling-picker";
import {
  CyberdeckPaneTooltip,
  CyberdeckPaneTooltipProvider,
} from "@/components/cyberdeck/cyberdeck-pane-tooltip";
import { DepthPanel } from "@/components/realmorphism";
import { useDeckMode } from "@/lib/deck-mode";
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
  const deckMode = useDeckMode();
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

  const picker = (
    <CyberdeckRollingPicker
      items={items}
      value={resolvedPosture}
      onChange={(next) => onChange(normalizeMuthurPosture(next))}
      ariaLabel="MUTHUR posture"
      viewportClassName="h-8 min-w-[4.25rem] w-auto max-w-[5.5rem]"
      alwaysShowLabel
      showTextWhileScrolling
      loop
    />
  );

  const rollerBody =
    deckMode === "ascii" ? (
      <DepthPanel variant="inset" depth={4} className="muthur-posture-roller shrink-0">
        <div className="flex items-center justify-center px-1.5 py-0.5 font-mono text-[9px] tracking-[0.06em] text-[#bdbdbd]">
          {picker}
        </div>
      </DepthPanel>
    ) : (
      picker
    );

  return (
    <CyberdeckPaneTooltipProvider delayDuration={300} disableHoverableContent>
      <CyberdeckPaneTooltip label={activeMeta.title} side="top">
        <div className={disabled ? "pointer-events-none opacity-40" : undefined}>{rollerBody}</div>
      </CyberdeckPaneTooltip>
    </CyberdeckPaneTooltipProvider>
  );
}
