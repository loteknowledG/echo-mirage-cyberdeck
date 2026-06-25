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
  variant?: 'panel' | 'toolbar';
};

export function FigletFontPreviewPanel({
  font,
  text = 'ECHO',
  className,
  variant = 'panel',
}: FigletFontPreviewPanelProps) {
  const [previewText, setPreviewText] = useState(text);
  const [output, setOutput] = useState<string | null>(() =>
    getCachedFigletPreview(font, text) ?? null,
  );
  const [loading, setLoading] = useState(!output);

  useEffect(() => {
    if (variant !== 'toolbar') {
      setPreviewText(text);
      return;
    }

    const timer = window.setTimeout(() => setPreviewText(text), 180);
    return () => window.clearTimeout(timer);
  }, [text, variant]);

  useEffect(() => {
    if (isFigletAllFonts(font)) {
      setOutput('Pick a single font to preview.\n(All Fonts cycles every face on render.)');
      setLoading(false);
      return;
    }

    const cached = getCachedFigletPreview(font, previewText);
    if (cached) {
      setOutput(cached);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    void fetchFigletPreviewText(font, previewText)
      .then((rendered) => {
        if (!cancelled) {
          setOutput(rendered);
          setLoading(false);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          const reason = error instanceof Error ? error.message : 'Preview failed';
          setOutput(`⟁ preview failed\n${reason}`);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [font, previewText]);

  return (
    <div
      className={cn(
        variant === 'toolbar'
          ? 'realmorphism-panel flex h-full min-h-0 min-w-0 flex-col overflow-hidden p-2'
          : 'realmorphism-panel flex min-h-[12rem] flex-col justify-center overflow-x-auto overflow-y-hidden p-4',
        className,
      )}
    >
      {loading ? (
        <div className="font-mono text-xs text-[#6f7a75]">Rendering…</div>
      ) : (
        <pre
          className={cn(
            'font-mono text-[#7dffb4] whitespace-pre',
            variant === 'toolbar'
              ? 'min-h-0 flex-1 overflow-x-auto overflow-y-auto pb-1 text-[7px] leading-[0.95]'
              : 'overflow-x-auto overflow-y-hidden text-[10px] leading-[0.72]',
          )}
        >
          {output ?? previewText}
        </pre>
      )}
    </div>
  );
}
