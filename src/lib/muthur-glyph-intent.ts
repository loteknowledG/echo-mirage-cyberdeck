export type GlyphRenderEngine = "ascii" | "figlet";

export type GlyphCommand =
  | { kind: "mode-on" }
  | { kind: "mode-off" }
  | { kind: "clear" }
  | { kind: "copy" }
  | { kind: "render"; engine: GlyphRenderEngine; text: string };

/** Parse MUTHUR ascii / figlet operator commands (`glyph` aliases ascii for compatibility). */
export function parseGlyphCommand(input: string): GlyphCommand | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (/^(?:ascii|glyph)\s+(?:mode|on)\s*$/i.test(trimmed)) return { kind: "mode-on" };
  if (/^(?:ascii|glyph)\s+off\s*$/i.test(trimmed)) return { kind: "mode-off" };
  if (/^(?:ascii|glyph)\s+clear\s*$/i.test(trimmed)) return { kind: "clear" };
  if (/^(?:ascii|glyph)\s+copy\s*$/i.test(trimmed)) return { kind: "copy" };

  const figlet = /^figlet\s+([\s\S]+)$/i.exec(trimmed);
  if (figlet?.[1]?.trim()) {
    return { kind: "render", engine: "figlet", text: figlet[1].trim() };
  }

  const ascii = /^(?:ascii|glyph)\s+([\s\S]+)$/i.exec(trimmed);
  if (ascii?.[1]?.trim()) {
    return { kind: "render", engine: "ascii", text: ascii[1].trim() };
  }

  return null;
}

export function isGlyphCommand(input: string): boolean {
  return parseGlyphCommand(input) !== null;
}
