import { renderFigletText } from "@/lib/glyph-figlet.server";
import { listFigletFonts, resolveFigletFontName } from "@/lib/figlet-fonts.server";
export type GlyphRenderRequest = {
  engine: "ascii" | "figlet";
  text: string;
  font?: string;
};

function formatGlyphOutput(header: string, body: string): string {
  const divider = "─".repeat(Math.min(56, Math.max(header.length + 8, 36)));
  return `${header}\n${divider}\n\n${body.trimEnd()}\n`;
}

/** Server-side ascii / figlet rendering for the Glyph Channel API. */
export async function renderGlyph(request: GlyphRenderRequest): Promise<string> {
  const text = request.text.replace(/\r\n/g, "\n").trim();
  if (!text) return "⟁ // EMPTY SIGNAL";

  if (request.engine === "figlet") {
    const fonts = await listFigletFonts();
    const fontName = resolveFigletFontName(request.font, fonts);
    const banner = await renderFigletText(text, fontName);
    return formatGlyphOutput(`⟁ FIGLET // ${fontName}`, banner);
  }

  const lines = text.split("\n").map((line) => `⟁ ${line}`);
  return formatGlyphOutput("⟁ ASCII SIGNAL", lines.join("\n"));
}
