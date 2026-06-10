"use client";

import { useMemo } from "react";
import { CyberdeckRollingPicker } from "@/components/cyberdeck/cyberdeck-rolling-picker";
import {
  CyberdeckPaneTooltip,
  CyberdeckPaneTooltipProvider,
} from "@/components/cyberdeck/cyberdeck-pane-tooltip";
import {
  MUTHUR_UPLINK_MODES,
  getMuthurUplinkModeMeta,
  normalizeMuthurUplinkMode,
  type MuthurUplinkMode,
} from "@/lib/muthur-uplink-mode";

const UPLINK_MODE_GLYPHS: Record<MuthurUplinkMode, string> = {
  ask: "?",
  plan: "P",
  agent: "E",
  debug: "D",
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

  const items = useMemo(
    () =>
      MUTHUR_UPLINK_MODES.map((entry) => ({
        value: entry.id,
        label: entry.label.toUpperCase(),
        slide: (
          <span className="font-mono text-[9px] leading-none tracking-[0.06em]">
            {UPLINK_MODE_GLYPHS[entry.id]}
          </span>
        ),
      })),
    [],
  );

  return (
    <CyberdeckPaneTooltipProvider delayDuration={300} disableHoverableContent>
      <CyberdeckPaneTooltip label={activeMeta.title} side="top">
        <div className={disabled ? "pointer-events-none opacity-40" : undefined}>
          <CyberdeckRollingPicker
            items={items}
            value={resolvedMode}
            onChange={(next) => onChange(normalizeMuthurUplinkMode(next))}
            ariaLabel="MUTHUR uplink mode"
            viewportClassName="h-7 min-w-[3rem] w-auto max-w-[4.75rem]"
            alwaysShowLabel
            showTextWhileScrolling
            loop
          />
        </div>
      </CyberdeckPaneTooltip>
    </CyberdeckPaneTooltipProvider>
  );
}
