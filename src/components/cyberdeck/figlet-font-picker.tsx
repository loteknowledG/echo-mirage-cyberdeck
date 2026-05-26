"use client";

import { useEffect, useMemo, useState } from "react";
import { CyberdeckRollingPicker } from "@/components/cyberdeck/cyberdeck-rolling-picker";
import { DEFAULT_FIGLET_FONT, FIGLET_FONT_ALL, isFigletAllFonts } from "@/lib/figlet-fonts";

type FigletFontPickerProps = {
  value: string;
  onChange: (font: string) => void;
  /** Called when the user finishes spinning the font wheel (snap settled). */
  onWheelSettled?: () => void;
};

/** Figlet font rolodex — same Y-axis picker as operator document type. */
export function FigletFontPicker({ value, onChange, onWheelSettled }: FigletFontPickerProps) {
  const [fonts, setFonts] = useState<string[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/glyph/fonts");
        const payload = (await res.json()) as { ok?: boolean; fonts?: string[]; error?: string };
        if (!mounted) return;
        if (!payload.ok || !Array.isArray(payload.fonts)) {
          setLoadError(payload.error || "Font list unavailable");
          setFonts([DEFAULT_FIGLET_FONT]);
          return;
        }
        setFonts(payload.fonts);
        setLoadError(null);
      } catch (err) {
        if (!mounted) return;
        setLoadError(err instanceof Error ? err.message : "Font list failed");
        setFonts([DEFAULT_FIGLET_FONT]);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const pickerFonts = useMemo(() => {
    if (fonts.length === 0) return fonts;
    if (fonts.some((font) => isFigletAllFonts(font))) return fonts;
    return [...fonts, FIGLET_FONT_ALL].sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" }),
    );
  }, [fonts]);

  const items = useMemo(
    () =>
      pickerFonts.map((font) => ({
        value: font,
        label: font,
        slide: (
          <span className="block whitespace-nowrap px-0.5 font-mono text-[8px] leading-none tracking-[0.04em]">
            {font}
          </span>
        ),
      })),
    [pickerFonts],
  );

  const resolvedValue = isFigletAllFonts(value)
    ? FIGLET_FONT_ALL
    : pickerFonts.find((font) => font.toLowerCase() === value.toLowerCase()) ??
      pickerFonts[0] ??
      value;

  if (pickerFonts.length === 0) {
    return (
      <div
        className="flex h-7 min-w-[5.25rem] shrink-0 items-center justify-center rounded border border-[#2d2d2d] bg-black px-1 font-mono text-[8px] text-[#6a6a6a]"
        title={loadError ?? "Loading fonts"}
      >
        …
      </div>
    );
  }

  return (
    <CyberdeckRollingPicker
      items={items}
      value={resolvedValue}
      onChange={onChange}
      onUserSelect={() => {
        onWheelSettled?.();
      }}
      ariaLabel="Figlet font"
      viewportClassName="h-7 min-w-[5.25rem] w-auto max-w-[10rem]"
      alwaysShowLabel
      showTextWhileScrolling
      showTooltipOnSnap={false}
      tooltipSide="top"
    />
  );
}
