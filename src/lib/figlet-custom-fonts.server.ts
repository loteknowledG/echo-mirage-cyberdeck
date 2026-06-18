import fs from "fs";
import path from "path";
import figlet from "figlet";

const CUSTOM_FONT_DIR = path.join(process.cwd(), "assets", "figlet-fonts");

figlet.defaults({ fontPath: CUSTOM_FONT_DIR });

let customFontNames: string[] | null = null;
let customFontsLoaded = false;

function resolveFigletPackageFontFile(fontName: string): string | null {
  try {
    const fontPath = figlet.defaults().fontPath;
    if (!fontPath || !fs.existsSync(fontPath)) return null;
    const direct = path.join(fontPath, `${fontName}.flf`);
    if (fs.existsSync(direct)) return direct;
    const target = fontName.toLowerCase();
    let entries: string[];
    try {
      entries = fs.readdirSync(fontPath);
    } catch {
      return null;
    }
    const match = entries.find(
      (file) => file.endsWith(".flf") && file.replace(/\.flf$/i, "").toLowerCase() === target,
    );
    return match ? path.join(fontPath, match) : null;
  } catch {
    return null;
  }
}

function parseFigletFontFile(filePath: string, fontName: string): boolean {
  try {
    const data = fs.readFileSync(filePath, "utf8");
    const parsedName = path.basename(filePath, ".flf");
    figlet.parseFont(parsedName, data);
    return Boolean(figlet.figFonts[parsedName] ?? figlet.figFonts[fontName]);
  } catch {
    return false;
  }
}

/** Load a .flf from assets/figlet-fonts or the figlet npm fonts directory. */
export function loadFigletFont(fontName: string): boolean {
  if (figlet.figFonts[fontName]) return true;

  const customPath = resolveCustomFontFile(fontName);
  if (customPath && parseFigletFontFile(customPath, fontName)) return true;

  const packagePath = resolveFigletPackageFontFile(fontName);
  if (packagePath && parseFigletFontFile(packagePath, fontName)) return true;

  return false;
}
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

/** Absolute path to assets/figlet-fonts/{name}.flf when present. */
export function resolveCustomFigletFontFile(fontName: string): string | null {
  return resolveCustomFontFile(fontName);
}

/** Parse one custom font into figlet.js when needed for render. */
export function loadCustomFigletFont(fontName: string): boolean {
  return loadFigletFont(fontName);
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
