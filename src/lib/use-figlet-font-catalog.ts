'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { BUNDLED_FIGLET_FONTS } from '@/lib/figlet-font-manifest';
import { DEFAULT_FIGLET_FONT, FIGLET_FONT_ALL, isFigletAllFonts } from '@/lib/figlet-fonts';
import { queryFigletFontCatalog } from '@/lib/glyph-catalog-queries';
import { queryKeys } from '@/lib/query-client';

function sortPickerFonts(fonts: readonly string[]): string[] {
  const list = [...fonts];
  if (!list.some((font) => isFigletAllFonts(font))) {
    list.push(FIGLET_FONT_ALL);
  }
  return list.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

export function useFigletFontCatalog() {
  const query = useQuery({
    queryKey: queryKeys.figletFontCatalog,
    queryFn: queryFigletFontCatalog,
    placeholderData: () => [...BUNDLED_FIGLET_FONTS],
  });

  const fonts = query.data ?? BUNDLED_FIGLET_FONTS;
  const pickerFonts = useMemo(() => sortPickerFonts(fonts), [fonts]);
  const loadError =
    query.error instanceof Error
      ? query.error.message
      : query.error
        ? String(query.error)
        : null;

  return { pickerFonts, loadError, isLoading: query.isLoading, isPending: query.isPending };
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
