import figlet from "figlet";
import {
  DEFAULT_FIGLET_FONT,
  listFigletFonts,
  resolveFigletFontName,
} from "@/lib/figlet-fonts.server";

export { DEFAULT_FIGLET_FONT, resolveFigletFontName };

export async function renderFigletText(text: string, font?: string): Promise<string> {
  const fonts = await listFigletFonts();
  const fontName = resolveFigletFontName(font, fonts);
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
