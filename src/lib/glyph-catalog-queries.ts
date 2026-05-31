import type { QueryClient } from '@tanstack/react-query';

import { BUNDLED_FIGLET_FONTS } from '@/lib/figlet-font-manifest';
import { fetchOnelineArtCatalog, type OnelineArtCatalogEntry } from '@/lib/oneline-art';
import { queryKeys } from '@/lib/query-client';

export async function queryOnelineArtCatalog(): Promise<OnelineArtCatalogEntry[]> {
  return fetchOnelineArtCatalog();
}

export async function queryFigletFontCatalog(): Promise<string[]> {
  let names = [...BUNDLED_FIGLET_FONTS];

  try {
    const res = await fetch('/api/glyph/fonts');
    const payload = (await res.json()) as { ok?: boolean; fonts?: string[]; error?: string };
    if (payload.ok && Array.isArray(payload.fonts) && payload.fonts.length > 0) {
      return payload.fonts;
    }
  } catch {
    /* try static fallback */
  }

  try {
    const res = await fetch('/glyph/figlet-fonts.json');
    if (res.ok) {
      const payload = (await res.json()) as { fonts?: string[] };
      if (Array.isArray(payload.fonts) && payload.fonts.length > 0) {
        return payload.fonts;
      }
    }
  } catch {
    /* keep bundled list */
  }

  return names;
}

export function prefetchOnelineArtCatalog(client: QueryClient) {
  return client.prefetchQuery({
    queryKey: queryKeys.onelineArtCatalog,
    queryFn: queryOnelineArtCatalog,
  });
}

export function prefetchFigletFontCatalog(client: QueryClient) {
  return client.prefetchQuery({
    queryKey: queryKeys.figletFontCatalog,
    queryFn: queryFigletFontCatalog,
  });
}

export function prefetchGlyphCatalogs(client: QueryClient) {
  return Promise.all([
    prefetchOnelineArtCatalog(client),
    prefetchFigletFontCatalog(client),
  ]);
}
