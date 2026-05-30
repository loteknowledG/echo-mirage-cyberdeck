'use client';

import { useEffect, useMemo, useState } from 'react';
import { BUNDLED_FIGLET_FONTS } from '@/lib/figlet-font-manifest';
import { DEFAULT_FIGLET_FONT, FIGLET_FONT_ALL, isFigletAllFonts } from '@/lib/figlet-fonts';

function sortPickerFonts(fonts: readonly string[]): string[] {
  const list = [...fonts];
  if (!list.some((font) => isFigletAllFonts(font))) {
    list.push(FIGLET_FONT_ALL);
  }
  return list.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

export function useFigletFontCatalog() {
  const [fonts, setFonts] = useState<string[]>(() => [...BUNDLED_FIGLET_FONTS]);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const applyFonts = (names: string[], error: string | null) => {
      if (!mounted || names.length === 0) return;
      setFonts(names);
      setLoadError(error);
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
        /* keep bundled list */
      }

      try {
        const res = await fetch('/glyph/figlet-fonts.json');
        if (res.ok) {
          const payload = (await res.json()) as { fonts?: string[] };
          if (Array.isArray(payload.fonts) && payload.fonts.length > 0) {
            applyFonts(payload.fonts, null);
            return;
          }
        }
      } catch {
        /* keep bundled list */
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const pickerFonts = useMemo(() => sortPickerFonts(fonts), [fonts]);

  return { pickerFonts, loadError };
}

export function resolveFigletPickerValue(value: string, pickerFonts: readonly string[]) {
  if (pickerFonts.length === 0) return value.trim() || DEFAULT_FIGLET_FONT;
  if (isFigletAllFonts(value)) return FIGLET_FONT_ALL;
  const match = pickerFonts.find((font) => font.toLowerCase() === value.trim().toLowerCase());
  if (match) return match;
  const defaultMatch = pickerFonts.find(
    (font) => font.toLowerCase() === DEFAULT_FIGLET_FONT.toLowerCase(),
  );
  return defaultMatch ?? pickerFonts[0] ?? DEFAULT_FIGLET_FONT;
}
