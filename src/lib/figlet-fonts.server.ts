import figlet from "figlet";
import { promisify } from "util";
import { DEFAULT_FIGLET_FONT } from "@/lib/figlet-fonts";
import { ensureCustomFigletFontsLoaded } from "@/lib/figlet-custom-fonts.server";

const listFigletFontsAsync = promisify(figlet.fonts.bind(figlet)) as () => Promise<string[]>;

export { DEFAULT_FIGLET_FONT };

let cachedFonts: string[] | null = null;

function mergeFontLists(bundled: readonly string[], custom: readonly string[]): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const name of [...bundled, ...custom]) {
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(name);
  }
  return merged.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

/** Sorted figlet.js built-in font names plus assets/figlet-fonts extras. */
export async function listFigletFonts(): Promise<string[]> {
  if (cachedFonts) return cachedFonts;
  const custom = ensureCustomFigletFontsLoaded();
  const bundled = await listFigletFontsAsync();
  cachedFonts = mergeFontLists(bundled, custom);
  return cachedFonts;
}

export function resolveFigletFontName(font: string | undefined, fonts: readonly string[]): string {
  const trimmed = font?.trim();
  if (!trimmed) return DEFAULT_FIGLET_FONT;
  const match = fonts.find((name) => name.toLowerCase() === trimmed.toLowerCase());
  if (match) return match;
  if (fonts.includes(DEFAULT_FIGLET_FONT)) return DEFAULT_FIGLET_FONT;
  return fonts[0] ?? DEFAULT_FIGLET_FONT;
}

export function figletFontIndex(font: string, fonts: readonly string[]): number {
  const resolved = resolveFigletFontName(font, fonts);
  const idx = fonts.indexOf(resolved);
  return idx >= 0 ? idx : 0;
}
