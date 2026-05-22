// src/TerminalArt.js

const GLYPH_RAIL_CHARS = new Set(["\u27C1", "⟁", "\u25B3"]);

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

export const art = {
  popped: (symbol) => {
    const s = railTabSymbol(symbol);
    return `┌───┐\n│ ${s} │▓\n└───┘▓\n▓▓▓▓▓`;
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
