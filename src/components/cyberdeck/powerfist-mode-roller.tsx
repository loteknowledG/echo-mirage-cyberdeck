"use client";

import { useMemo, useState } from "react";
import { CyberdeckRollingPicker } from "@/components/cyberdeck/cyberdeck-rolling-picker";

const POWERFIST_MODES = [
  { id: "voice", label: "Voice", icon: "V" },
  { id: "logs", label: "Logs", icon: "L" },
  { id: "tools", label: "Tools", icon: "T" },
  { id: "power", label: "Power", icon: "P" },
  { id: "mode", label: "Mode", icon: "M" },
] as const;

export function PowerfistModeRoller() {
  const [mode, setMode] = useState<string>(POWERFIST_MODES[0].id);

  const items = useMemo(
    () =>
      POWERFIST_MODES.map((entry) => ({
        value: entry.id,
        label: entry.label,
        slide: (
          <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-cyan-200">
            <span className="rounded border border-cyan-400/30 bg-slate-950/80 px-1.5 py-0.5 text-cyan-300">
              {entry.icon}
            </span>
            {entry.label}
          </span>
        ),
      })),
    [],
  );

  const active = POWERFIST_MODES.find((m) => m.id === mode) ?? POWERFIST_MODES[0];

  return (
    <div className="flex flex-col items-center gap-3">
      <CyberdeckRollingPicker
        items={items}
        value={mode}
        onChange={setMode}
        ariaLabel="Powerfist mode roller"
        viewportClassName="h-28 w-40 overflow-hidden rounded-xl border border-cyan-400/20 bg-slate-950/80 [scrollbar-width:none]"
        slideHeightPx={28}
        wheelNeighborCount={3}
        alwaysShowLabel
        showTextWhileScrolling
        loop
      />
      <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-cyan-100/45">
        Vertical loop · {active.label}
      </p>
    </div>
  );
}
