/** System prompt snippet: teach MUTHUR how to co-create ASCII / figlet art in the glyph channel. */
import { MUTHUR_ASCII_SKILL_DOCTRINE } from "@/lib/muthur-ascii-skill/skill-doctrine";

export const MUTHUR_GLYPH_DOCTRINE = `
GLYPH CHANNEL (ASCII pane):
The operator can ask you to help create ASCII art and FIGlet banners in the live ⟁ Glyph Channel.

${MUTHUR_ASCII_SKILL_DOCTRINE}

Legacy figlet directives (still supported):

[GLYPH:engine=figlet text="ECHO MIRAGE" font=Impossible merge=append]

Keys:
- engine: figlet | ascii
- text: string to render (quote if it contains spaces)
- font: figlet font name (optional; e.g. Impossible, ANSI Shadow, S Blood)
- merge: append | replace (default: figlet append, ascii replace)

For hand-drawn ASCII you composed in a fenced block, add [GLYPH:apply-block merge=append] after the block.

Discuss fonts and layout in chat; use ascii.render JSON for structured panels, figlet directives for type banners.
Popular figlet fonts: Impossible, ANSI Shadow, S Blood, Slant, Big.
`.trim();

export function buildGlyphContextPrompt(glyphContext: string): string {
  const trimmed = glyphContext.trim();
  if (!trimmed) return "";
  return `\n\nLive Glyph Channel snapshot:\n${trimmed}`;
}
