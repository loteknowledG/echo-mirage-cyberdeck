'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { prefetchGlyphCatalogs } from '@/lib/glyph-catalog-queries';

/** Warm glyph picker catalogs when the cyberdeck mounts (deduped by TanStack Query). */
export function GlyphCatalogPrefetch() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const run = () => void prefetchGlyphCatalogs(queryClient);
    const idle = window.requestIdleCallback?.(run, { timeout: 4000 });
    const fallback = window.setTimeout(run, 1500);
    return () => {
      if (idle != null) window.cancelIdleCallback(idle);
      window.clearTimeout(fallback);
    };
  }, [queryClient]);

  return null;
}
