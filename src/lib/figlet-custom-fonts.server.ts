import fs from "fs";
import path from "path";
import figlet from "figlet";

const CUSTOM_FONT_DIR = path.join(process.cwd(), "assets", "figlet-fonts");

let customFontNames: string[] | null = null;
let customFontsLoaded = false;

/** Font names from assets/figlet-fonts/*.flf (no parsing — safe for /api/glyph/fonts). */
export function listCustomFigletFontNamesFromDisk(): string[] {
  if (customFontNames) return customFontNames;
  if (!fs.existsSync(CUSTOM_FONT_DIR)) {
    customFontNames = [];
    return customFontNames;
  }

  customFontNames = fs
    .readdirSync(CUSTOM_FONT_DIR)
    .filter((file) => file.endsWith(".flf"))
    .map((file) => file.replace(/\.flf$/i, ""))
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));

  return customFontNames;
}

function resolveCustomFontFile(fontName: string): string | null {
  if (!fs.existsSync(CUSTOM_FONT_DIR)) return null;
  const direct = path.join(CUSTOM_FONT_DIR, `${fontName}.flf`);
  if (fs.existsSync(direct)) return direct;
  const target = fontName.toLowerCase();
  const match = fs
    .readdirSync(CUSTOM_FONT_DIR)
    .find((file) => file.endsWith(".flf") && file.replace(/\.flf$/i, "").toLowerCase() === target);
  return match ? path.join(CUSTOM_FONT_DIR, match) : null;
}

/** Parse one custom font into figlet.js when needed for render. */
export function loadCustomFigletFont(fontName: string): boolean {
  if (figlet.figFonts[fontName]) return true;
  const filePath = resolveCustomFontFile(fontName);
  if (!filePath) return false;
  try {
    const data = fs.readFileSync(filePath, "utf8");
    const parsedName = path.basename(filePath, ".flf");
    figlet.parseFont(parsedName, data);
    return Boolean(figlet.figFonts[parsedName] ?? figlet.figFonts[fontName]);
  } catch {
    return false;
  }
}

/** Eager-load all custom fonts (legacy; avoid on font list API). */
export function ensureCustomFigletFontsLoaded(): readonly string[] {
  if (customFontsLoaded) return listCustomFigletFontNamesFromDisk();
  customFontsLoaded = true;
  for (const fontName of listCustomFigletFontNamesFromDisk()) {
    loadCustomFigletFont(fontName);
  }
  return listCustomFigletFontNamesFromDisk();
}

export function customFigletFontDir(): string {
  return CUSTOM_FONT_DIR;
}
