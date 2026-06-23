'use client';

import { useEffect, useMemo, useState } from 'react';
import { CyberdeckRollingPicker } from '@/components/cyberdeck/cyberdeck-rolling-picker';
import { FigletFontPreviewSlide } from '@/components/cyberdeck/figlet-font-preview-slide';
import { ShowroomTickPointerRail } from '@/components/cyberdeck/showroom-tick-pointer-rail';
import { cn } from '@/lib/utils';
import {
  resolveFigletPickerValue,
  useFigletFontCatalog,
} from '@/lib/use-figlet-font-catalog';

const FONT_SLIDE_CLASS =
  'flex w-full min-w-0 items-center justify-center overflow-hidden whitespace-nowrap px-1 font-mono text-[8px] leading-none tracking-[0.04em]';

const FILTER_INPUT_CLASS =
  'w-full border-0 bg-transparent font-mono text-[9px] tracking-[0.04em] text-emerald-200 placeholder:text-[#5a6a62] focus:outline-none';

type FigletFontPickerProps = {
  value: string;
  onChange: (font: string) => void;
  /** Called when the user finishes spinning the font wheel (snap settled). */
  onWheelSettled?: () => void;
  /** Compact glyph toolbar vs Price Is Right pinned wheel with figlet previews. */
  variant?: 'compact' | 'price-is-right';
  className?: string;
};

function fontSlide(font: string) {
  return (
    <span className={FONT_SLIDE_CLASS} title={font}>
      {font}
    </span>
  );
}

function fontLabelSlide(font: string, active: boolean) {
  return (
    <span
      className={cn(
        'block max-w-full truncate px-1 font-mono text-[10px] leading-none tracking-[0.04em]',
        active ? 'text-emerald-200' : 'text-[#8ca39a]',
      )}
      title={font}
    >
      {font}
    </span>
  );
}

function filterFigletFonts(fonts: readonly string[], filter: string): string[] {
  const query = filter.trim().toLowerCase();
  if (!query) return [...fonts];
  return fonts.filter((font) => font.toLowerCase().includes(query));
}

/** Y-axis figlet font rolodex — compact strip or Price Is Right pinned preview wheel. */
export function FigletFontPicker({
  value,
  onChange,
  onWheelSettled,
  variant = 'compact',
  className,
}: FigletFontPickerProps) {
  const { pickerFonts, loadError } = useFigletFontCatalog();
  const isPriceIsRight = variant === 'price-is-right';
  const [filter, setFilter] = useState('');

  const filteredFonts = useMemo(
    () => filterFigletFonts(pickerFonts, filter),
    [filter, pickerFonts],
  );

  const wheelFonts = filter.trim() ? filteredFonts : pickerFonts;

  const items = useMemo(
    () =>
      wheelFonts.map((font) => ({
        value: font,
        label: font,
        ...(isPriceIsRight
          ? {
              renderSlide: (active: boolean) => (
                <FigletFontPreviewSlide
                  font={font}
                  active={active}
                  size="wheel"
                  loadPreview={active}
                />
              ),
              renderLabelSlide: (active: boolean) => fontLabelSlide(font, active),
            }
          : {
              slide: fontSlide(font),
              labelSlide: fontSlide(font),
            }),
      })),
    [isPriceIsRight, wheelFonts],
  );

  const resolvedValue = resolveFigletPickerValue(
    value,
    wheelFonts.length > 0 ? wheelFonts : pickerFonts,
  );

  useEffect(() => {
    if (resolvedValue === value) return;
    onChange(resolvedValue);
  }, [resolvedValue, value, onChange]);

  if (pickerFonts.length === 0) {
    return (
      <div
        className={cn(
          'flex h-7 w-full min-w-0 items-center justify-center rounded border border-[#2d2d2d] bg-black px-1 font-mono text-[8px] text-[#6a6a6a]',
          className,
        )}
      >
        …
      </div>
    );
  }

  if (loadError) {
    return (
      <div
        className={cn(
          'flex min-w-0 items-center justify-center rounded border border-[#2d2d2d] bg-black px-2 py-1 font-mono text-[8px] text-amber-300/90',
          isPriceIsRight ? 'h-[10rem] w-[10.5rem] shrink-0' : 'h-7',
          className,
        )}
      >
        {loadError}
      </div>
    );
  }

  const roller = (
    <CyberdeckRollingPicker
      items={items}
      value={resolvedValue}
      onChange={onChange}
      onUserSelect={() => {
        onWheelSettled?.();
      }}
      ariaLabel="Figlet font"
      viewportClassName={
        isPriceIsRight
          ? 'w-full max-w-none touch-pan-y select-none'
          : 'h-7 min-w-0 w-full max-w-none overflow-hidden rounded border border-[#2d2d2d] bg-black [scrollbar-width:none]'
      }
      wheelTransparent={false}
      wheelExpandOnScroll={isPriceIsRight}
      wheelPinnedOpen={isPriceIsRight}
      wheelNeighborCount={3}
      slideHeightPx={isPriceIsRight ? 44 : 28}
      wheelScrollStep={1}
      alwaysShowLabel={isPriceIsRight}
      showTextWhileScrolling={false}
      wheelSettledShowsSlide={false}
      loop
      rollerType={isPriceIsRight ? 'figlet-price-is-right' : 'figlet-compact'}
    />
  );

  if (!isPriceIsRight) {
    return <div className={className}>{roller}</div>;
  }

  return (
    <div
      className={cn(
        'flex h-[10rem] w-[10.5rem] shrink-0 flex-col overflow-hidden rounded-sm border border-[#2d2d2d] bg-black',
        className,
      )}
      data-figlet-price-is-right-roller
      role="group"
      aria-label="Figlet font wheel"
    >
      <div className="shrink-0 border-b border-[#1c1c1c] px-2 py-1">
        <input
          type="search"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Filter fonts…"
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          aria-label="Filter figlet fonts"
          className={FILTER_INPUT_CLASS}
        />
      </div>

      <div className="flex min-h-0 flex-1 items-stretch justify-center overflow-hidden">
        {wheelFonts.length === 0 ? (
          <p className="flex flex-1 items-center justify-center px-2 font-mono text-[9px] text-[#6a6a6a]">
            No fonts match.
          </p>
        ) : (
          <ShowroomTickPointerRail slideHeightPx={44}>
            {roller}
          </ShowroomTickPointerRail>
        )}
      </div>
    </div>
  );
}
