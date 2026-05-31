'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { queryKeys } from '@/lib/query-client';
import { queryOnelineArtCatalog } from '@/lib/glyph-catalog-queries';
import type { OnelineArtCatalogEntry } from '@/lib/oneline-art';

export function resolveOnelinePickerValue(
  value: string,
  catalog: readonly OnelineArtCatalogEntry[],
): string {
  if (catalog.length === 0) return value;
  if (catalog.some((entry) => entry.id === value)) return value;
  return catalog[0]!.id;
}

export function findOnelineArtEntry(
  catalog: readonly OnelineArtCatalogEntry[],
  id: string,
): OnelineArtCatalogEntry | undefined {
  return catalog.find((entry) => entry.id === id);
}

export function useOnelineArtCatalog() {
  const query = useQuery({
    queryKey: queryKeys.onelineArtCatalog,
    queryFn: queryOnelineArtCatalog,
  });

  const catalog = query.data ?? [];
  const byId = useMemo(() => new Map(catalog.map((entry) => [entry.id, entry])), [catalog]);
  const loadError =
    query.error instanceof Error
      ? query.error.message
      : query.error
        ? String(query.error)
        : null;

  return {
    catalog,
    byId,
    loadError,
    isLoading: query.isLoading,
    isPending: query.isPending,
  };
}
