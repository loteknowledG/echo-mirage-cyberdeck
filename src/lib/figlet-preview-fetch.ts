import { isFigletAllFonts } from '@/lib/figlet-fonts';

const cache = new Map<string, string>();
const inFlight = new Map<string, Promise<string>>();

function cacheKey(font: string, text: string): string {
  return `${font}\0${text}`;
}

export function getCachedFigletPreview(font: string, text: string): string | undefined {
  return cache.get(cacheKey(font, text));
}

/** Deduped figlet render for wheel/panel previews (avoids POST storms while scrolling). */
export async function fetchFigletPreviewText(font: string, text: string): Promise<string> {
  if (isFigletAllFonts(font)) return 'ALL FONTS';

  const key = cacheKey(font, text);
  const cached = cache.get(key);
  if (cached) return cached;

  const pending = inFlight.get(key);
  if (pending) return pending;

  const request = (async () => {
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
    const payload = (await res.json()) as { ok?: boolean; output?: string; error?: string };
    if (!payload.ok || typeof payload.output !== 'string' || !payload.output.trim()) {
      throw new Error(payload.error?.trim() || `Figlet preview failed (HTTP ${res.status})`);
    }
    const output = payload.output.trimEnd();
    cache.set(key, output);
    return output;
  })();

  inFlight.set(key, request);
  try {
    return await request;
  } finally {
    inFlight.delete(key);
  }
}
