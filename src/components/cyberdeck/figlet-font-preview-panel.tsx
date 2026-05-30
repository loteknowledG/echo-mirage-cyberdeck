'use client';

import { useEffect, useState } from 'react';
import { isFigletAllFonts } from '@/lib/figlet-fonts';
import { cn } from '@/lib/utils';

const panelCache = new Map<string, string>();

async function fetchFigletPanel(font: string, text: string): Promise<string> {
  const key = `${font}\0${text}`;
  const cached = panelCache.get(key);
  if (cached) return cached;

  const res = await fetch('/api/glyph/render', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      engine: 'figlet',
      text,
      font,
      decorate: false,
    }),
  });
  const payload = (await res.json()) as { ok?: boolean; output?: string };
  const output = payload.ok && payload.output ? payload.output.trimEnd() : text;
  panelCache.set(key, output);
  return output;
}

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
  const [output, setOutput] = useState<string | null>(() => panelCache.get(`${font}\0${text}`) ?? null);
  const [loading, setLoading] = useState(!output);

  useEffect(() => {
    if (isFigletAllFonts(font)) {
      setOutput('Pick a single font to preview.\n(All Fonts cycles every face on render.)');
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    void fetchFigletPanel(font, text).then((rendered) => {
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
