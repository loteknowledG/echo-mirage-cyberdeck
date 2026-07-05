"use client";

import { useMemo } from "react";
import { CyberdeckRollingPicker } from "@/components/cyberdeck/cyberdeck-rolling-picker";
import {
  CyberdeckPaneTooltip,
  CyberdeckPaneTooltipProvider,
} from "@/components/cyberdeck/cyberdeck-pane-tooltip";
import { RollerDialFlanks } from "@/components/cyberdeck/roller-dial-flanks";
import { useDeckMode } from "@/lib/deck-mode";
import {
  MUTHUR_INHABITANT_SELECTOR,
  MUTHUR_INHABITANTS,
  getMuthurInhabitantMeta,
  normalizeMuthurInhabitant,
  type MuthurInhabitant,
} from "@/lib/muthur/muthur-inhabitant";

const INHABITANT_GLYPHS: Record<MuthurInhabitant, string> = {
  muthur: "M",
  codex: "X",
  pi: "π",
};

type MuthurInhabitantRollerProps = {
  inhabitant: MuthurInhabitant;
  disabled?: boolean;
  onChange: (inhabitant: MuthurInhabitant) => void;
};

/** Y-axis rolodex — MUTHUR / Codex / Pi pane inhabitant. */
export function MuthurInhabitantRoller({
  inhabitant,
  disabled = false,
  onChange,
}: MuthurInhabitantRollerProps) {
  const deckMode = useDeckMode();
  const resolved = normalizeMuthurInhabitant(inhabitant);
  const activeMeta = getMuthurInhabitantMeta(resolved);

  const selectorMeta = useMemo(
    () =>
      MUTHUR_INHABITANT_SELECTOR.map((id) =>
        MUTHUR_INHABITANTS.find((entry) => entry.id === id),
      ).filter((entry): entry is (typeof MUTHUR_INHABITANTS)[number] => Boolean(entry)),
    [],
  );

  const items = useMemo(
    () =>
      selectorMeta.map((entry) => ({
        value: entry.id,
        label: entry.label.toUpperCase(),
        slide: (
          <span className="font-mono text-[9px] leading-none tracking-[0.06em]">
            {INHABITANT_GLYPHS[entry.id]}
          </span>
        ),
      })),
    [selectorMeta],
  );

  const picker = (
    <CyberdeckRollingPicker
      items={items}
      value={resolved}
      onChange={(next) => onChange(normalizeMuthurInhabitant(next))}
      ariaLabel="MUTHUR pane inhabitant"
      viewportClassName="h-8 min-w-[4.25rem] w-auto max-w-[5.5rem]"
      alwaysShowLabel
      showTextWhileScrolling
      loop
    />
  );

  const rollerBody =
    deckMode === "ascii" ? (
      <RollerDialFlanks className="muthur-inhabitant-roller font-mono text-[9px] tracking-[0.06em] text-[#bdbdbd]">
        {picker}
      </RollerDialFlanks>
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
