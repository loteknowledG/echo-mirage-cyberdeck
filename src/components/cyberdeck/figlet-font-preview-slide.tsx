'use client';

import { useEffect, useState } from 'react';
import { FIGLET_FONT_ALL, isFigletAllFonts } from '@/lib/figlet-fonts';
import { cn } from '@/lib/utils';

const PREVIEW_TEXT = 'EM';
const previewCache = new Map<string, string>();

async function fetchFigletPreview(font: string): Promise<string> {
  if (isFigletAllFonts(font)) return 'ALL FONTS';
  const cached = previewCache.get(font);
  if (cached) return cached;

  const res = await fetch('/api/glyph/render', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      engine: 'figlet',
      text: PREVIEW_TEXT,
      font,
      decorate: false,
    }),
  });
  const payload = (await res.json()) as { ok?: boolean; output?: string };
  const output = payload.ok && payload.output ? payload.output.trimEnd() : font;
  previewCache.set(font, output);
  return output;
}

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
    previewCache.get(font) ?? null,
  );

  useEffect(() => {
    if (!loadPreview) return;
    if (isFigletAllFonts(font)) {
      setPreview('ALL FONTS');
      return;
    }
    let cancelled = false;
    void fetchFigletPreview(font).then((text) => {
      if (!cancelled) setPreview(text);
    });
    return () => {
      cancelled = true;
    };
  }, [font, loadPreview]);

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
