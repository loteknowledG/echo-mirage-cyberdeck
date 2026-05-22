import figlet from "figlet";
import { promisify } from "util";
import { DEFAULT_FIGLET_FONT } from "@/lib/figlet-fonts";

const listFigletFontsAsync = promisify(figlet.fonts.bind(figlet)) as () => Promise<string[]>;

export { DEFAULT_FIGLET_FONT };

let cachedFonts: string[] | null = null;

/** Sorted figlet.js built-in font names (328). */
export async function listFigletFonts(): Promise<string[]> {
  if (cachedFonts) return cachedFonts;
  const fonts = await listFigletFontsAsync();
  cachedFonts = fonts.slice().sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
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
