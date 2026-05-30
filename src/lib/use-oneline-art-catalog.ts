'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  fetchOnelineArtCatalog,
  type OnelineArtCatalogEntry,
} from '@/lib/oneline-art';

let sharedCatalog: OnelineArtCatalogEntry[] | null = null;
let sharedLoadError: string | null = null;
let catalogPromise: Promise<OnelineArtCatalogEntry[]> | null = null;
const catalogListeners = new Set<() => void>();

function notifyCatalogListeners() {
  catalogListeners.forEach((listener) => listener());
}

async function loadOnelineArtCatalog(): Promise<OnelineArtCatalogEntry[]> {
  if (sharedCatalog) return sharedCatalog;
  if (catalogPromise) return catalogPromise;

  catalogPromise = (async () => {
    try {
      sharedCatalog = await fetchOnelineArtCatalog();
      sharedLoadError = null;
    } catch (err) {
      sharedLoadError = err instanceof Error ? err.message : 'Failed to load one-line art';
      sharedCatalog = [];
    }
    notifyCatalogListeners();
    return sharedCatalog;
  })();

  return catalogPromise;
}

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
  const [catalog, setCatalog] = useState<OnelineArtCatalogEntry[]>(() => sharedCatalog ?? []);
  const [loadError, setLoadError] = useState<string | null>(() => sharedLoadError);

  useEffect(() => {
    const sync = () => {
      if (sharedCatalog) setCatalog([...sharedCatalog]);
      setLoadError(sharedLoadError);
    };

    catalogListeners.add(sync);
    void loadOnelineArtCatalog().then(sync);

    return () => {
      catalogListeners.delete(sync);
    };
  }, []);

  const byId = useMemo(() => new Map(catalog.map((entry) => [entry.id, entry])), [catalog]);

  return { catalog, byId, loadError };
}
