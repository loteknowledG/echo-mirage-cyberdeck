export const DEFAULT_FIGLET_FONT = "ANSI Shadow";
export const FIGLET_FONT_ALL = "All";

export function isFigletAllFonts(font: string | undefined): boolean {
  return font?.trim().toLowerCase() === FIGLET_FONT_ALL.toLowerCase();
}
