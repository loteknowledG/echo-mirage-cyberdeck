"use client";

import { useMemo } from "react";
import { CyberdeckRollingPicker } from "@/components/cyberdeck/cyberdeck-rolling-picker";
import {
  CyberdeckPaneTooltip,
  CyberdeckPaneTooltipProvider,
} from "@/components/cyberdeck/cyberdeck-pane-tooltip";
import {
  MUTHUR_UPLINK_MODE_SELECTOR,
  MUTHUR_UPLINK_MODES,
  getMuthurUplinkModeMeta,
  normalizeMuthurUplinkMode,
  type MuthurUplinkMode,
} from "@/lib/muthur-uplink-mode";

const UPLINK_MODE_GLYPHS: Record<MuthurUplinkMode, string> = {
  plan: "P",
  agent: "A",
  commander: "C",
};

type MuthurUplinkModeRollerProps = {
  mode: MuthurUplinkMode;
  disabled?: boolean;
  onChange: (mode: MuthurUplinkMode) => void;
};

/** Y-axis rolodex — same compact roller as GlyphChannel TEXT / FIGLET / 1 LINE. */
export function MuthurUplinkModeRoller({
  mode,
  disabled = false,
  onChange,
}: MuthurUplinkModeRollerProps) {
  const resolvedMode = normalizeMuthurUplinkMode(mode);
  const activeMeta = getMuthurUplinkModeMeta(resolvedMode);

  const selectorMeta = useMemo(
    () =>
      MUTHUR_UPLINK_MODE_SELECTOR.map((id) => MUTHUR_UPLINK_MODES.find((entry) => entry.id === id)).filter(
        (entry): entry is (typeof MUTHUR_UPLINK_MODES)[number] => Boolean(entry),
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
            {UPLINK_MODE_GLYPHS[entry.id]}
          </span>
        ),
      })),
    [selectorMeta],
  );

  const pickerValue = resolvedMode;

  return (
    <CyberdeckPaneTooltipProvider delayDuration={300} disableHoverableContent>
      <CyberdeckPaneTooltip label={activeMeta.title} side="top">
        <div className={disabled ? "pointer-events-none opacity-40" : undefined}>
          <CyberdeckRollingPicker
            items={items}
            value={pickerValue}
            onChange={(next) => onChange(normalizeMuthurUplinkMode(next))}
            ariaLabel="MUTHUR uplink mode"
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
