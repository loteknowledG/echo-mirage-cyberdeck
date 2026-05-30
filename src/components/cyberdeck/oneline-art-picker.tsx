'use client';

import { useEffect, useMemo, useState } from 'react';
import { CyberdeckRollingPicker } from '@/components/cyberdeck/cyberdeck-rolling-picker';
import {
  fetchOnelineArtCatalog,
  onelineArtPickerLabel,
  type OnelineArtCatalogEntry,
} from '@/lib/oneline-art';

type OnelineArtPickerProps = {
  value: string;
  onChange: (art: string) => void;
  onWheelSettled?: () => void;
};

function asciiSlide(content: string) {
  return (
    <span
      className="block max-w-full truncate px-0.5 font-mono text-[8px] leading-none tracking-[0.02em] text-emerald-200/95"
      title={content}
    >
      {onelineArtPickerLabel(content, 18)}
    </span>
  );
}

/** Rotary: ww9 + asky.lol + 1lineart.kulaone.com — title while spinning, ascii when snapped. */
export function OnelineArtPicker({ value, onChange, onWheelSettled }: OnelineArtPickerProps) {
  const [catalog, setCatalog] = useState<OnelineArtCatalogEntry[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const entries = await fetchOnelineArtCatalog();
        if (!mounted) return;
        setCatalog(entries);
        setLoadError(null);
      } catch (err) {
        if (!mounted) return;
        setCatalog([]);
        setLoadError(err instanceof Error ? err.message : 'Failed to load one-line art');
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const items = useMemo(
    () =>
      catalog.map((entry) => ({
        value: entry.id,
        label: entry.title,
        slide: asciiSlide(entry.content),
        labelSlide: (
          <span
            className="block max-w-full truncate px-0.5 font-mono text-[8px] leading-none tracking-[0.02em] text-[#b8c4be]"
            title={entry.title}
          >
            {onelineArtPickerLabel(entry.title, 20)}
          </span>
        ),
      })),
    [catalog],
  );

  const resolvedEntry = catalog.find((entry) => entry.content === value);
  const resolvedValue = resolvedEntry?.id ?? catalog[0]?.id ?? '';

  const pickById = (id: string) => {
    const entry = catalog.find((item) => item.id === id);
    if (entry) onChange(entry.content);
  };

  if (catalog.length === 0) {
    return (
      <div
        className="flex h-7 min-w-[5.25rem] shrink-0 items-center justify-center rounded border border-[#2d2d2d] bg-black px-1 font-mono text-[8px] text-[#6a6a6a]"
        title={loadError ?? 'Loading one-line art'}
      >
        …
      </div>
    );
  }

  return (
    <CyberdeckRollingPicker
      items={items}
      value={resolvedValue}
      onChange={pickById}
      onUserSelect={(id) => {
        pickById(id);
        onWheelSettled?.();
      }}
      ariaLabel="One-line ASCII art"
      viewportClassName="h-7 min-w-[5.25rem] w-auto max-w-[10rem]"
      wheelExpandOnScroll
      wheelTransparent
      wheelSettledShowsSlide
      wheelNeighborCount={3}
      slideHeightPx={28}
      wheelScrollStep={1}
      showTextWhileScrolling
    />
  );
}
