import figlet from "figlet";
import { DEFAULT_FIGLET_FONT } from "@/lib/figlet-fonts";
import { BUNDLED_FIGLET_FONTS } from "@/lib/figlet-font-manifest";
import { listCustomFigletFontNamesFromDisk } from "@/lib/figlet-custom-fonts.server";
import { isPyfigletAvailable, listPyfigletFonts } from "@/lib/pyfiglet.server";

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

async function readBundledFigletFontNames(): Promise<string[]> {
  try {
    const names = await new Promise<string[]>((resolve, reject) => {
      figlet.fonts((err, fonts) => {
        if (err) reject(err);
        else resolve(fonts ?? []);
      });
    });
    if (names.length > 0) return names;
  } catch {
    /* Vercel/serverless: figlet npm fonts/ dir is often missing from the trace */
  }
  return [...BUNDLED_FIGLET_FONTS];
}

/** Sorted fonts: figlet.js bundled + assets/figlet-fonts + pyfiglet (when installed). */
export async function listFigletFonts(): Promise<string[]> {
  if (cachedFonts) return cachedFonts;
  const custom = listCustomFigletFontNamesFromDisk();
  const bundled = await readBundledFigletFontNames();
  let merged = mergeFontLists(bundled, custom);
  if (await isPyfigletAvailable()) {
    merged = mergeFontLists(merged, await listPyfigletFonts());
  }
  cachedFonts = merged;
  return cachedFonts;
}

export function invalidateFigletFontCache(): void {
  cachedFonts = null;
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
