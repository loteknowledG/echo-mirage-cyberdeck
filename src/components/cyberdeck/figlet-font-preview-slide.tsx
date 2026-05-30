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
};

export function FigletFontPreviewSlide({
  font,
  active,
  loadPreview = true,
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
  const lines = (preview ?? label).split('\n').slice(0, 3);

  return (
    <div className="flex w-full min-w-0 flex-col items-center justify-center gap-0.5">
      <pre
        className={cn(
          'max-h-[2.1rem] w-full overflow-hidden text-center font-mono text-[5px] leading-[0.62] whitespace-pre',
          active ? 'text-emerald-200/95' : 'text-[#7a7a7a]',
        )}
        aria-hidden
      >
        {lines.join('\n')}
      </pre>
      <span
        className={cn(
          'max-w-full truncate px-0.5 font-mono text-[7px] leading-none tracking-[0.03em]',
          active ? 'text-emerald-200' : 'text-[#6a6a6a]',
        )}
      >
        {label}
      </span>
    </div>
  );
}
