'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { prefetchGlyphCatalogs } from '@/lib/glyph-catalog-queries';

/** Warm glyph picker catalogs when the cyberdeck mounts (deduped by TanStack Query). */
export function GlyphCatalogPrefetch() {
  const queryClient = useQueryClient();

  useEffect(() => {
    void prefetchGlyphCatalogs(queryClient);
  }, [queryClient]);

  return null;
}
