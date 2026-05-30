'use client';

import { useEffect, useMemo, useState } from 'react';
import { CyberdeckRollingPicker } from '@/components/cyberdeck/cyberdeck-rolling-picker';
import { DEFAULT_FIGLET_FONT, FIGLET_FONT_ALL, isFigletAllFonts } from '@/lib/figlet-fonts';

type FigletFontPickerProps = {
  value: string;
  onChange: (font: string) => void;
  /** Called when the user finishes spinning the font wheel (snap settled). */
  onWheelSettled?: () => void;
};

/** Compact Y-axis font rolodex — snaps to center on stop (operator doc-type picker pattern). */
export function FigletFontPicker({ value, onChange, onWheelSettled }: FigletFontPickerProps) {
  const [fonts, setFonts] = useState<string[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const applyFonts = (names: string[], error: string | null) => {
      if (!mounted) return;
      if (names.length > 0) {
        setFonts(names);
        setLoadError(error);
        return;
      }
      setFonts([DEFAULT_FIGLET_FONT]);
      setLoadError(error ?? 'Font list unavailable');
    };

    (async () => {
      try {
        const res = await fetch('/api/glyph/fonts');
        const payload = (await res.json()) as { ok?: boolean; fonts?: string[]; error?: string };
        if (payload.ok && Array.isArray(payload.fonts) && payload.fonts.length > 0) {
          applyFonts(payload.fonts, null);
          return;
        }
      } catch {
        /* try static manifest */
      }

      try {
        const res = await fetch('/glyph/figlet-fonts.json');
        if (res.ok) {
          const payload = (await res.json()) as { fonts?: string[] };
          if (Array.isArray(payload.fonts) && payload.fonts.length > 0) {
            applyFonts(payload.fonts, 'Using bundled font manifest');
            return;
          }
        }
      } catch {
        /* fall through */
      }

      applyFonts([], 'Font list unavailable — run pnpm fonts:manifest');
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const pickerFonts = useMemo(() => {
    if (fonts.length === 0) return fonts;
    if (fonts.some((font) => isFigletAllFonts(font))) return fonts;
    return [...fonts, FIGLET_FONT_ALL].sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: 'base' }),
    );
  }, [fonts]);

  const items = useMemo(
    () =>
      pickerFonts.map((font) => ({
        value: font,
        label: font,
        slide: (
          <span className="block max-w-full truncate px-0.5 font-mono text-[8px] leading-none tracking-[0.04em]">
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
        title={loadError ?? 'Loading fonts'}
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
      wheelExpandOnScroll
      wheelTransparent
      wheelNeighborCount={3}
      slideHeightPx={28}
      wheelScrollStep={1}
      showTextWhileScrolling
      showTooltipOnSnap={false}
      tooltipSide="top"
    />
  );
}
