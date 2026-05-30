'use client';

import { useEffect, useState } from 'react';
import { isFigletAllFonts } from '@/lib/figlet-fonts';
import {
  fetchFigletPreviewText,
  getCachedFigletPreview,
} from '@/lib/figlet-preview-fetch';
import { cn } from '@/lib/utils';

type FigletFontPreviewPanelProps = {
  font: string;
  text?: string;
  className?: string;
};

export function FigletFontPreviewPanel({
  font,
  text = 'ECHO',
  className,
}: FigletFontPreviewPanelProps) {
  const [output, setOutput] = useState<string | null>(() =>
    getCachedFigletPreview(font, text) ?? null,
  );
  const [loading, setLoading] = useState(!output);

  useEffect(() => {
    if (isFigletAllFonts(font)) {
      setOutput('Pick a single font to preview.\n(All Fonts cycles every face on render.)');
      setLoading(false);
      return;
    }

    const cached = getCachedFigletPreview(font, text);
    if (cached) {
      setOutput(cached);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    void fetchFigletPreviewText(font, text).then((rendered) => {
      if (!cancelled) {
        setOutput(rendered);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [font, text]);

  return (
    <div
      className={cn(
        'realmorphism-panel flex min-h-[12rem] flex-col justify-center overflow-x-auto overflow-y-hidden p-4',
        className,
      )}
    >
      <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-[#6f7a75]">
        Preview
      </div>
      {loading ? (
        <div className="font-mono text-xs text-[#6f7a75]">Rendering…</div>
      ) : (
        <pre className="overflow-x-auto overflow-y-hidden font-mono text-[10px] leading-[0.72] text-[#7dffb4] whitespace-pre">
          {output ?? text}
        </pre>
      )}
    </div>
  );
}
