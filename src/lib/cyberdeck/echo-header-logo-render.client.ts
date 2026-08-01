import { fetchFigletPreviewText } from "@/lib/figlet-preview-fetch";
import { isFigletAllFonts } from "@/lib/figlet-fonts";
import { ECHO_MIRAGE_LOGO_ASCII } from "@/lib/cyberdeck/echo-logo-art";
import {
  ECHO_HEADER_CLASSIC_FIGLET_FONT,
  ECHO_HEADER_LOGO_TEXT,
} from "@/lib/cyberdeck/echo-header-logo-preference.client";

export type EchoHeaderLogoSource = "classic-static" | "figlet";

export type EchoHeaderLogoRender = {
  ascii: string;
  font: string;
  source: EchoHeaderLogoSource;
};

export function pickRandomFigletFont(fonts: readonly string[]): string {
  const pool = fonts.filter((font) => !isFigletAllFonts(font));
  if (pool.length === 0) return ECHO_HEADER_CLASSIC_FIGLET_FONT;
  return pool[Math.floor(Math.random() * pool.length)] ?? ECHO_HEADER_CLASSIC_FIGLET_FONT;
}

export function classicEchoHeaderLogo(): EchoHeaderLogoRender {
  return {
    ascii: ECHO_MIRAGE_LOGO_ASCII,
    font: ECHO_HEADER_CLASSIC_FIGLET_FONT,
    source: "classic-static",
  };
}

async function tryFigletHeader(font: string): Promise<EchoHeaderLogoRender | null> {
  try {
    const ascii = await fetchFigletPreviewText(font, ECHO_HEADER_LOGO_TEXT);
    if (!ascii.trim()) return null;
    return { ascii, font, source: "figlet" };
  } catch {
    return null;
  }
}

/** Random figlet first, then Impossible figlet, then the hand-tuned static art. */
export async function resolveDynamicEchoHeaderLogo(
  fonts: readonly string[],
  options?: { fontOverride?: string },
): Promise<EchoHeaderLogoRender> {
  const candidates = options?.fontOverride
    ? [options.fontOverride]
    : [pickRandomFigletFont(fonts), ECHO_HEADER_CLASSIC_FIGLET_FONT];

  for (const font of candidates) {
    const rendered = await tryFigletHeader(font);
    if (rendered) return rendered;
  }

  return classicEchoHeaderLogo();
}
