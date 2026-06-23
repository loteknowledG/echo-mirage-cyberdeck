'use client';

import { useEffect, useMemo } from 'react';
import { CyberdeckRollingPicker } from '@/components/cyberdeck/cyberdeck-rolling-picker';
import { FigletFontPreviewSlide } from '@/components/cyberdeck/figlet-font-preview-slide';
import { cn } from '@/lib/utils';
import {
  resolveFigletPickerValue,
  useFigletFontCatalog,
} from '@/lib/use-figlet-font-catalog';

const FONT_SLIDE_CLASS =
  'flex w-full min-w-0 items-center justify-center overflow-hidden whitespace-nowrap px-1 font-mono text-[8px] leading-none tracking-[0.04em]';

type FigletFontPickerProps = {
  value: string;
  onChange: (font: string) => void;
  /** Called when the user finishes spinning the font wheel (snap settled). */
  onWheelSettled?: () => void;
  /** Compact glyph toolbar vs registry showroom with figlet previews in the wheel. */
  variant?: 'compact' | 'showroom';
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

/** Y-axis figlet font rolodex — neighbors visible while scrolling; figlet preview in showroom mode. */
export function FigletFontPicker({
  value,
  onChange,
  onWheelSettled,
  variant = 'compact',
  className,
}: FigletFontPickerProps) {
  const { pickerFonts, loadError } = useFigletFontCatalog();
  const isShowroom = variant === 'showroom';

  const items = useMemo(
    () =>
      pickerFonts.map((font) => ({
        value: font,
        label: font,
        ...(isShowroom
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
    [isShowroom, pickerFonts],
  );

  const resolvedValue = resolveFigletPickerValue(value, pickerFonts);

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
          isShowroom ? 'h-[8.25rem] w-[10.5rem] shrink-0' : 'h-7',
          className,
        )}
      >
        {loadError}
      </div>
    );
  }

  return (
    <div className={cn(isShowroom && 'shrink-0', className)}>
      <CyberdeckRollingPicker
        items={items}
        value={resolvedValue}
        onChange={onChange}
        onUserSelect={() => {
          onWheelSettled?.();
        }}
        ariaLabel="Figlet font"
        viewportClassName={
          isShowroom
            ? 'w-[10.5rem] max-w-[10.5rem]'
            : 'h-7 min-w-0 w-full max-w-none overflow-hidden rounded border border-[#2d2d2d] bg-black [scrollbar-width:none]'
        }
        wheelTransparent={false}
        wheelExpandOnScroll={isShowroom}
        wheelPinnedOpen={isShowroom}
        wheelNeighborCount={3}
        slideHeightPx={isShowroom ? 44 : 28}
        wheelScrollStep={1}
        alwaysShowLabel={isShowroom}
        showTextWhileScrolling={false}
        wheelSettledShowsSlide={false}
        loop
        rollerType={isShowroom ? 'figlet-showroom' : 'figlet-compact'}
      />
    </div>
  );
}
