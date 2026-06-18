import fs from "fs";
import path from "path";
import figlet from "figlet";

const CUSTOM_FONT_DIR = path.join(process.cwd(), "assets", "figlet-fonts");

type FigletNode = typeof figlet & {
  loadFont: (
    name: string,
    callback?: (err: Error | null, font?: unknown) => void,
  ) => Promise<unknown>;
  loadFontSync: (name: string) => unknown;
};

let customFontNames: string[] | null = null;
let customFontsLoaded = false;

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

/** figlet.text() calls loadFont internally — route disk reads to assets/figlet-fonts only. */
function patchFigletAssetLoader(): void {
  const nodeFiglet = figlet as FigletNode;

  nodeFiglet.loadFontSync = function loadFontSyncFromAssets(font: string) {
    const fontName = String(font);
    if (figlet.figFonts[fontName]) {
      return figlet.figFonts[fontName].options;
    }
    const fontFile = resolveCustomFontFile(fontName);
    if (!fontFile) {
      throw new Error(`Figlet font file not found: ${fontName}`);
    }
    const data = fs.readFileSync(fontFile, "utf8");
    const parsedName = path.basename(fontFile, ".flf");
    return figlet.parseFont(parsedName, data);
  };

  nodeFiglet.loadFont = function loadFontFromAssets(font: string, callback?) {
    return new Promise((resolve, reject) => {
      try {
        const options = nodeFiglet.loadFontSync(font);
        callback?.(null, options);
        resolve(options);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        callback?.(error);
        reject(error);
      }
    });
  } as FigletNode["loadFont"];
}

patchFigletAssetLoader();

/** Load a .flf from assets/figlet-fonts into figlet.js memory. */
export function loadFigletFont(fontName: string): boolean {
  if (figlet.figFonts[fontName]) return true;

  const customPath = resolveCustomFontFile(fontName);
  if (customPath && parseFigletFontFile(customPath, fontName)) return true;

  try {
    (figlet as FigletNode).loadFontSync(fontName);
    return Boolean(figlet.figFonts[fontName]);
  } catch {
    return false;
  }
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
