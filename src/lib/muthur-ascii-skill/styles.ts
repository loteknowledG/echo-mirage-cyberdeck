import type { AsciiStyleProfile } from "@/lib/muthur-ascii-skill/types";

export type BoxChars = {
  tl: string;
  tr: string;
  bl: string;
  br: string;
  h: string;
  v: string;
  cross?: string;
};

export type StyleConfig = {
  id: AsciiStyleProfile;
  label: string;
  box: BoxChars;
  divider: string;
  /** Padding inside boxed panels (no side border — box() adds borders). */
  innerPad: string;
  innerPrefix: string;
  accent: string;
  titleTransform: (text: string) => string;
  statusGlyph: Record<"ok" | "warn" | "fail" | "pending", string>;
};

function spacedUpper(text: string): string {
  return text
    .trim()
    .toUpperCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.split("").join(" "))
    .join("   ");
}

export const STYLE_PROFILES: Record<AsciiStyleProfile, StyleConfig> = {
  weyland: {
    id: "weyland",
    label: "Weyland-Yutani corporate",
    box: { tl: "┌", tr: "┐", bl: "└", br: "┘", h: "─", v: "│", cross: "┼" },
    divider: "═",
    innerPad: "  ",
    innerPrefix: "│ ",
    accent: "WY-CLASS // ",
    titleTransform: (text) => text.toUpperCase(),
    statusGlyph: { ok: "[OK]", warn: "[!!]", fail: "[XX]", pending: "[..]" },
  },
  muthur: {
    id: "muthur",
    label: "MU/TH/UR ship computer",
    box: { tl: "╔", tr: "╗", bl: "╚", br: "╝", h: "═", v: "║", cross: "╬" },
    divider: "─",
    innerPad: "  ",
    innerPrefix: "║ ",
    accent: "MU/TH/UR // ",
    titleTransform: spacedUpper,
    statusGlyph: { ok: "▸ OK", warn: "▸ !!", fail: "▸ XX", pending: "▸ .." },
  },
  echo_mirage: {
    id: "echo_mirage",
    label: "Echo Mirage cyberdeck",
    box: { tl: "╭", tr: "╮", bl: "╰", br: "╯", h: "─", v: "│", cross: "┼" },
    divider: "═",
    innerPad: "  ",
    innerPrefix: "│  ",
    accent: "⟁ ",
    titleTransform: spacedUpper,
    statusGlyph: { ok: "● LIVE", warn: "◐ WARN", fail: "○ FAIL", pending: "… WAIT" },
  },
  retro_terminal: {
    id: "retro_terminal",
    label: "Retro green terminal",
    box: { tl: "+", tr: "+", bl: "+", br: "+", h: "-", v: "|", cross: "+" },
    divider: "=",
    innerPad: "  ",
    innerPrefix: "| ",
    accent: "> ",
    titleTransform: (text) => text.toUpperCase(),
    statusGlyph: { ok: "+ OK", warn: "! WARN", fail: "x FAIL", pending: "? WAIT" },
  },
  alarm: {
    id: "alarm",
    label: "Alarm / breach",
    box: { tl: "▛", tr: "▜", bl: "▙", br: "▟", h: "▀", v: "▌", cross: "▒" },
    divider: "!",
    innerPad: "  ",
    innerPrefix: "▌ ",
    accent: "!!! ",
    titleTransform: (text) => text.toUpperCase(),
    statusGlyph: { ok: "! OK", warn: "!! ALERT", fail: "!!! BREACH", pending: "! HOLD" },
  },
  stealth: {
    id: "stealth",
    label: "Stealth / minimal",
    box: { tl: " ", tr: " ", bl: " ", br: " ", h: "─", v: " ", cross: " " },
    divider: "·",
    innerPad: "  ",
    innerPrefix: "  ",
    accent: "· ",
    titleTransform: (text) => text,
    statusGlyph: { ok: "· ok", warn: "· warn", fail: "· fail", pending: "· wait" },
  },
};

export function resolveStyleProfile(style?: string): StyleConfig {
  const key = (style ?? "echo_mirage") as AsciiStyleProfile;
  return STYLE_PROFILES[key] ?? STYLE_PROFILES.echo_mirage;
}
