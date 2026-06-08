// src/TerminalArt.js

const GLYPH_RAIL_CHARS = new Set(["\u27C1", "⟁", "\u25B3"]);
const SHADOW_CHAR = "▓";

/**
 * One character that fits the 3-column rail ASCII frame (⟁ is too wide for the box).
 */
export function railTabSymbol(symbol = "") {
  const raw = String(symbol).trim();
  if (!raw) return "?";
  const first = Array.from(raw)[0] ?? "?";
  if (GLYPH_RAIL_CHARS.has(first)) return "^";
  return first;
}

/** 3-column rail box width (`┌───┐`). */
const RAIL_BOX_WIDTH = 5;

/**
 * Bottom ▓ row: shift right and trim width by the same amount so the
 * bottom/right shadow corner stays fixed (wall meets at one point).
 */
const RAIL_BOTTOM_SHADOW_SHIFT = 1;

function railBottomShadow() {
  return (
    " ".repeat(RAIL_BOTTOM_SHADOW_SHIFT) +
    SHADOW_CHAR.repeat(RAIL_BOX_WIDTH - RAIL_BOTTOM_SHADOW_SHIFT)
  );
}

function railFaceRows(symbol) {
  const s = railTabSymbol(symbol);
  return [`┌───┐`, `│ ${s} │`, `└───┘`];
}

export const art = {
  poppedFace: (symbol) => railFaceRows(symbol).join("\n"),
  poppedShadow: (symbol) => {
    const rows = railFaceRows(symbol);
    return [
      " ".repeat(rows[0].length),
      `${" ".repeat(rows[1].length)}${SHADOW_CHAR}`,
      `${" ".repeat(rows[2].length)}${SHADOW_CHAR}`,
      railBottomShadow(),
    ].join("\n");
  },
  popped: (symbol) => {
    const rows = railFaceRows(symbol);
    return [
      rows[0],
      `${rows[1]}${SHADOW_CHAR}`,
      `${rows[2]}${SHADOW_CHAR}`,
      railBottomShadow(),
    ].join("\n");
  },
  pushed: (symbol) => {
    const s = railTabSymbol(symbol);
    return `┌───┐\n│ ${s} │\n└───┘`;
  },
};

export const BOOT_LOGO = `
[ WAYLAND-YUTANI CYBERDEC ]
[ MU/TH/UR 6000 ]

>> INITIALIZE UPLINK <<
`;

export const SYSTEM_HEADER = (provider, channel, model) =>
  `STATION: ${provider.toUpperCase()} // ${channel.toUpperCase()} // ${model}`;
