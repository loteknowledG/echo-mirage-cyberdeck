import figlet from "figlet";
import {
  DEFAULT_FIGLET_FONT,
  listFigletFonts,
  resolveFigletFontName,
} from "@/lib/figlet-fonts.server";
import {
  loadFigletFont,
  resolveCustomFigletFontFile,
} from "@/lib/figlet-custom-fonts.server";
import { isPyfigletAvailable, renderPyfigletText } from "@/lib/pyfiglet.server";

export { DEFAULT_FIGLET_FONT, resolveFigletFontName };

function renderWithFigletJs(text: string, fontName: string): Promise<string> {
  return new Promise((resolve, reject) => {
    figlet.text(
      text,
      {
        font: fontName,
        whitespaceBreak: true,
      },
      (error, data) => {
        if (error) {
          reject(error);
          return;
        }
        resolve((data ?? "").replace(/\r\n/g, "\n"));
      },
    );
  });
}

/** figlet.js lists many fonts before they are parsed into memory — load from disk when needed. */
function ensureFigletJsFontLoaded(fontName: string): boolean {
  return loadFigletFont(fontName) || Boolean(figlet.figFonts[fontName]);
}

export async function renderFigletText(text: string, font?: string): Promise<string> {
  const fonts = await listFigletFonts();
  const fontName = resolveFigletFontName(font, fonts);
  const customFile = resolveCustomFigletFontFile(fontName);
  const figletJsReady = ensureFigletJsFontLoaded(fontName);

  if (customFile && !figletJsReady) {
    if (await isPyfigletAvailable()) {
      return renderPyfigletText(text, fontName);
    }
    throw new Error(
      `Font "${fontName}" needs pyfiglet (Commodore/custom). Works in compiled Echo Mirage; installed PWA cannot run Python on the server.`,
    );
  }

  if (!figletJsReady) {
    throw new Error(`Figlet font "${fontName}" is not loaded — rebuild to copy npm fonts into assets/figlet-fonts.`);
  }

  try {
    return await renderWithFigletJs(text, fontName);
  } catch (figletError) {
    if (!(await isPyfigletAvailable())) {
      const message =
        figletError instanceof Error ? figletError.message : String(figletError);
      throw new Error(`Figlet render failed for "${fontName}": ${message}`);
    }

    try {
      return await renderPyfigletText(text, fontName);
    } catch (pyError) {
      const pyMessage = pyError instanceof Error ? pyError.message : String(pyError);
      const figletMessage =
        figletError instanceof Error ? figletError.message : String(figletError);
      throw new Error(
        `Figlet render failed for "${fontName}" (figlet.js: ${figletMessage}; pyfiglet: ${pyMessage})`,
      );
    }
  }
}
