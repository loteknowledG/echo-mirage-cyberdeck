import fs from "fs";
import path from "path";
import figlet from "figlet";

const CUSTOM_FONT_DIR = path.join(process.cwd(), "assets", "figlet-fonts");

let customFontNames: string[] = [];
let customFontsLoaded = false;

/** Load xero/figlet-fonts extras shipped under assets/figlet-fonts. */
export function ensureCustomFigletFontsLoaded(): readonly string[] {
  if (customFontsLoaded) return customFontNames;
  customFontsLoaded = true;
  customFontNames = [];

  if (!fs.existsSync(CUSTOM_FONT_DIR)) return customFontNames;

  for (const file of fs.readdirSync(CUSTOM_FONT_DIR)) {
    if (!file.endsWith(".flf")) continue;
    const fontName = file.replace(/\.flf$/i, "");
    if (figlet.figFonts[fontName]) {
      customFontNames.push(fontName);
      continue;
    }
    try {
      const data = fs.readFileSync(path.join(CUSTOM_FONT_DIR, file), "utf8");
      figlet.parseFont(fontName, data);
      customFontNames.push(fontName);
    } catch {
      /* skip invalid font files */
    }
  }

  customFontNames.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  return customFontNames;
}

export function customFigletFontDir(): string {
  return CUSTOM_FONT_DIR;
}
