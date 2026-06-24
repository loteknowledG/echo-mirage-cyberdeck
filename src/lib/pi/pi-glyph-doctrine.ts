import {
  buildGlyphContextPrompt,
  MUTHUR_GLYPH_DOCTRINE,
} from "@/lib/muthur-glyph-doctrine";

export const PI_GLYPH_DOCTRINE =
  "\n\nPI GLYPH CHANNEL:" +
  "\n- The ⟁ Glyph Channel (ASCII pane) is writable. The deck applies your art when you emit glyph directives." +
  "\n- For hand-drawn ASCII (cats, diagrams, banners you compose yourself): put the art in a fenced ```ascii block, then add [GLYPH:apply-block merge=append] on the next line. The deck switches the pane to edit mode and pastes it." +
  "\n- For figlet/type banners use [GLYPH:engine=figlet text=\"…\" font=Impossible merge=append] or ascii.render JSON." +
  "\n- Do NOT treat the glyph channel as read-only output. Do NOT open Notepad, Paint, or other desktop apps for glyph-pane requests unless the operator explicitly asks for a desktop app." +
  "\n- pi_computer_use is for Windows desktop embodiment only (screenshot, mouse, keyboard) — not for drawing on the glyph channel." +
  `\n\n${MUTHUR_GLYPH_DOCTRINE}`;

export function buildPiGlyphContextPrompt(glyphContext: string): string {
  return buildGlyphContextPrompt(glyphContext);
}
