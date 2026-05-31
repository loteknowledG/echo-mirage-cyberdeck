'use client';

import { useEffect, useMemo } from 'react';
import { CyberdeckRollingPicker } from '@/components/cyberdeck/cyberdeck-rolling-picker';
import { cn } from '@/lib/utils';
import type { OnelineArtCatalogEntry } from '@/lib/oneline-art';
import {
  resolveOnelinePickerValue,
  useOnelineArtCatalog,
} from '@/lib/use-oneline-art-catalog';

/** Match figlet toolbar roller row height. */
const ROW_PX = 28;

const TITLE_SLIDE_CLASS =
  'flex w-full min-w-0 items-center justify-center overflow-hidden whitespace-nowrap px-1 font-mono text-[8px] leading-none tracking-[0.02em]';

type OnelineArtPickerProps = {
  value: string;
  onChange: (artId: string) => void;
  /** Fires when the user spins and the wheel snap settles. */
  onWheelSettled?: (entry: OnelineArtCatalogEntry) => void;
};

function titleSlide(title: string) {
  return (
    <span
      data-oneline-title
      className={cn(TITLE_SLIDE_CLASS, 'text-emerald-200/95')}
      title={title}
    >
      {title}
    </span>
  );
}

/** Kula One 1-line rolodex — title in picker; ascii goes to composer on settle. */
export function OnelineArtPicker({ value, onChange, onWheelSettled }: OnelineArtPickerProps) {
  const { catalog, byId, loadError } = useOnelineArtCatalog();

  const items = useMemo(
    () =>
      catalog.map((entry) => ({
        value: entry.id,
        label: entry.title,
        slide: titleSlide(entry.title),
        labelSlide: titleSlide(entry.title),
      })),
    [catalog],
  );

  const resolvedValue = resolveOnelinePickerValue(value, catalog);

  useEffect(() => {
    if (resolvedValue === value) return;
    onChange(resolvedValue);
  }, [resolvedValue, value, onChange]);

  if (catalog.length === 0) {
    return (
      <div
        className="flex h-7 w-full min-w-0 flex-1 items-center justify-center rounded border border-[#2d2d2d] bg-black px-1 font-mono text-[8px] text-[#6a6a6a]"
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
      onChange={onChange}
      onUserSelect={(artId) => {
        const entry = byId.get(artId);
        if (entry) onWheelSettled?.(entry);
      }}
      ariaLabel="One-line ASCII art"
      viewportClassName="h-7 min-w-0 w-full max-w-none overflow-hidden [scrollbar-width:none]"
      wheelExpandOnScroll
      wheelFullWidth
      wheelTransparent
      slideHeightPx={ROW_PX}
      wheelScrollStep={1}
      showTextWhileScrolling={false}
      loop
    />
  );
}
