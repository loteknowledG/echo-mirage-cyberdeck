'use client';

import { useEffect, useState } from 'react';
import { FIGLET_FONT_ALL, isFigletAllFonts } from '@/lib/figlet-fonts';
import {
  fetchFigletPreviewText,
  getCachedFigletPreview,
} from '@/lib/figlet-preview-fetch';
import { cn } from '@/lib/utils';

const PREVIEW_TEXT = 'EM';
/** Wait for wheel to pause on a row before hitting /api/glyph/render. */
const WHEEL_PREVIEW_DEBOUNCE_MS = 160;

type FigletFontPreviewSlideProps = {
  font: string;
  active: boolean;
  /** When false, skip network fetch (slide off-screen). */
  loadPreview?: boolean;
  size?: 'wheel' | 'lg';
};

export function FigletFontPreviewSlide({
  font,
  active,
  loadPreview = true,
  size = 'wheel',
}: FigletFontPreviewSlideProps) {
  const [preview, setPreview] = useState<string | null>(() =>
    getCachedFigletPreview(font, PREVIEW_TEXT) ?? null,
  );

  useEffect(() => {
    if (!loadPreview || !active) return;
    if (isFigletAllFonts(font)) {
      setPreview('ALL FONTS');
      return;
    }

    const cached = getCachedFigletPreview(font, PREVIEW_TEXT);
    if (cached) {
      setPreview(cached);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      void fetchFigletPreviewText(font, PREVIEW_TEXT).then((text) => {
        if (!cancelled) setPreview(text);
      });
    }, WHEEL_PREVIEW_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [font, loadPreview, active]);

  const label = isFigletAllFonts(font) ? FIGLET_FONT_ALL : font;
  const lineLimit = size === 'lg' ? 12 : 3;
  const lines = (preview ?? label).split('\n').slice(0, lineLimit);
  const isLarge = size === 'lg';

  return (
    <div className="flex w-full min-w-0 flex-col items-center justify-center gap-0.5">
      <pre
        className={cn(
          'w-full overflow-hidden text-center font-mono whitespace-pre',
          isLarge
            ? 'max-h-[10rem] text-[9px] leading-[0.68]'
            : 'max-h-[1.35rem] text-[5px] leading-[0.58]',
          active
            ? 'text-emerald-200 drop-shadow-[0_0_6px_rgba(125,255,180,0.35)]'
            : 'text-[#4a524e]',
        )}
        aria-hidden
      >
        {lines.join('\n')}
      </pre>
      <span
        className={cn(
          'max-w-full truncate px-0.5 font-mono leading-none tracking-[0.03em]',
          isLarge ? 'text-[10px]' : 'text-[7px]',
          active ? 'text-emerald-200' : 'text-[#4a524e]',
        )}
      >
        {label}
      </span>
    </div>
  );
}
