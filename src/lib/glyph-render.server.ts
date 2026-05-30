import { isFigletAllFonts } from "@/lib/figlet-fonts";
import { renderFigletText } from "@/lib/glyph-figlet.server";
import { listFigletFonts, resolveFigletFontName } from "@/lib/figlet-fonts.server";

const ALL_FONTS_BATCH_SIZE = 16;
export type GlyphRenderRequest = {
  engine: "ascii" | "figlet" | "oneline";
  text: string;
  font?: string;
  /** When true, wrap output with channel header / divider. Default false — raw art only. */
  decorate?: boolean;
};

function collapseToSingleLine(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ");
}

function formatGlyphOutput(header: string, body: string): string {
  const divider = "─".repeat(Math.min(56, Math.max(header.length + 8, 36)));
  return `${header}\n${divider}\n\n${body.trimEnd()}\n`;
}

async function renderFigletAllFonts(text: string, decorate: boolean): Promise<string> {
  const fonts = await listFigletFonts();
  const blocks: string[] = [];

  for (let i = 0; i < fonts.length; i += ALL_FONTS_BATCH_SIZE) {
    const batch = fonts.slice(i, i + ALL_FONTS_BATCH_SIZE);
    const results = await Promise.all(
      batch.map(async (fontName) => {
        try {
          const banner = (await renderFigletText(text, fontName)).trimEnd();
          if (!banner) return null;
          if (decorate) {
            return formatGlyphOutput(`⟁ FIGLET // ${fontName}`, banner);
          }
          return `${fontName}\n${banner}`;
        } catch {
          return null;
        }
      }),
    );
    blocks.push(...results.filter((block): block is string => block != null));
  }

  return blocks.join("\n\n").trimEnd();
}

/** Server-side ascii / figlet rendering for the Glyph Channel API. */
export async function renderGlyph(request: GlyphRenderRequest): Promise<string> {
  const text = request.text.replace(/\r\n/g, "\n").trim();
  if (!text) return "⟁ // EMPTY SIGNAL";
  const decorate = request.decorate === true;

  if (request.engine === "figlet") {
    if (isFigletAllFonts(request.font)) {
      return renderFigletAllFonts(text, decorate);
    }
    const fonts = await listFigletFonts();
    const fontName = resolveFigletFontName(request.font, fonts);
    const banner = await renderFigletText(text, fontName);
    if (!decorate) return banner.trimEnd();
    return formatGlyphOutput(`⟁ FIGLET // ${fontName}`, banner);
  }

  if (request.engine === "oneline") {
    const line = collapseToSingleLine(text);
    if (!line) return "⟁ // EMPTY SIGNAL";
    if (!decorate) return line;
    return formatGlyphOutput("⟁ 1 LINE ASCII", `⟁ ${line}`);
  }

  if (!decorate) return text;

  const lines = text.split("\n").map((line) => `⟁ ${line}`);
  return formatGlyphOutput("⟁ TEXT SIGNAL", lines.join("\n"));
}
