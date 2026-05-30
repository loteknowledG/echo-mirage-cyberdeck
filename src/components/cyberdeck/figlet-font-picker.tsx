'use client';

import { useEffect, useMemo } from 'react';
import { CyberdeckRollingPicker } from '@/components/cyberdeck/cyberdeck-rolling-picker';
import { FigletFontPreviewSlide } from '@/components/cyberdeck/figlet-font-preview-slide';
import { cn } from '@/lib/utils';
import {
  resolveFigletPickerValue,
  useFigletFontCatalog,
} from '@/lib/use-figlet-font-catalog';

type FigletFontPickerProps = {
  value: string;
  onChange: (font: string) => void;
  /** Called when the user finishes spinning the font wheel (snap settled). */
  onWheelSettled?: () => void;
  /** Compact glyph toolbar vs registry showroom with figlet previews in the wheel. */
  variant?: 'compact' | 'showroom';
};

/** Y-axis figlet font rolodex — neighbors visible while scrolling; figlet preview in showroom mode. */
export function FigletFontPicker({
  value,
  onChange,
  onWheelSettled,
  variant = 'compact',
}: FigletFontPickerProps) {
  const { pickerFonts } = useFigletFontCatalog();
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
              renderLabelSlide: (active: boolean) => (
                <span
                  className={cn(
                    'block max-w-full truncate px-1 font-mono text-[9px] leading-none tracking-[0.04em]',
                    active ? 'text-emerald-200/90' : 'text-[#4a524e]',
                  )}
                >
                  {font}
                </span>
              ),
            }
          : {
              slide: (
                <span className="block max-w-full truncate px-0.5 font-mono text-[8px] leading-none tracking-[0.04em]">
                  {font}
                </span>
              ),
            }),
      })),
    [isShowroom, pickerFonts],
  );

  const resolvedValue = resolveFigletPickerValue(value, pickerFonts);

  useEffect(() => {
    if (resolvedValue === value) return;
    onChange(resolvedValue);
  }, [resolvedValue, value, onChange]);

  return (
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
          ? 'w-full'
          : 'h-7 min-w-[5.25rem] w-auto max-w-[10rem] shrink-0'
      }
      wheelExpandOnScroll
      wheelPinnedOpen={isShowroom}
      wheelTransparent={!isShowroom}
      wheelNeighborCount={3}
      slideHeightPx={isShowroom ? 44 : 28}
      wheelScrollStep={1}
      showTextWhileScrolling
      wheelSettledShowsSlide={false}
    />
  );
}
