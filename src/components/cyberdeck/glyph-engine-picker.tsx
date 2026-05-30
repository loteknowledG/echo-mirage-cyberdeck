"use client";

import { useMemo } from "react";
import { CyberdeckRollingPicker } from "@/components/cyberdeck/cyberdeck-rolling-picker";
import type { GlyphPaneEngine } from "@/lib/glyph-channel";

const GLYPH_ENGINE_ENTRIES: Array<{ value: GlyphPaneEngine; label: string; glyph: string }> = [
  { value: "ascii", label: "TEXT", glyph: "T" },
  { value: "figlet", label: "FIGLET", glyph: "F" },
  { value: "oneline", label: "1 LINE", glyph: "1" },
];

type GlyphEnginePickerProps = {
  value: GlyphPaneEngine;
  onChange: (engine: GlyphPaneEngine) => void;
};

/** Y-axis rolodex picker for ASCII vs Figlet render engine. */
export function GlyphEnginePicker({ value, onChange }: GlyphEnginePickerProps) {
  const items = useMemo(
    () =>
      GLYPH_ENGINE_ENTRIES.map((entry) => ({
        value: entry.value,
        label: entry.label,
        slide: (
          <span className="font-mono text-[9px] leading-none tracking-[0.06em]">{entry.glyph}</span>
        ),
      })),
    [],
  );

  const resolvedValue = GLYPH_ENGINE_ENTRIES.some((entry) => entry.value === value)
    ? value
    : "ascii";

  return (
    <CyberdeckRollingPicker
      items={items}
      value={resolvedValue}
      onChange={(next) => onChange(next as GlyphPaneEngine)}
      ariaLabel="Render engine"
      viewportClassName="h-7 min-w-[3rem] w-auto max-w-[4.75rem]"
      alwaysShowLabel
      showTextWhileScrolling
    />
  );
}
