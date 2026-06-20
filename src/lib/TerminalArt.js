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

/** Empty interior — icon overlay sits in the middle row. */
function railIconFaceRows() {
  return [`┌───┐`, `│   │`, `└───┘`];
}

function railIconShadowRows() {
  const rows = railIconFaceRows();
  return [
    " ".repeat(rows[0].length),
    `${" ".repeat(rows[1].length)}${SHADOW_CHAR}`,
    `${" ".repeat(rows[2].length)}${SHADOW_CHAR}`,
    railBottomShadow(),
  ];
}

/** Dialer keypad interior width — digit + letter row inside one ASCII box. */
const DIALER_KEY_INTERIOR = 5;

function centerDialerCell(label, width = DIALER_KEY_INTERIOR) {
  if (!label) return " ".repeat(width);
  if (label.length >= width) return label.slice(0, width);
  const pad = width - label.length;
  const left = Math.floor(pad / 2);
  return `${" ".repeat(left)}${label}${" ".repeat(pad - left)}`;
}

/** Face rows: digit + letter row (blank when none) — uniform height like a real dialpad. */
export function dialerKeyFaceRows(digit, subLabel = "") {
  const line = "─".repeat(DIALER_KEY_INTERIOR);
  const glyph = String(digit).slice(0, 1);
  const sub = String(subLabel).trim();
  return [
    `┌${line}┐`,
    `│${centerDialerCell(glyph)}│`,
    `│${centerDialerCell(sub)}│`,
    `└${line}┘`,
  ];
}

/** Floor ▓ row — inset left, clipped right so the L-corner pocket stays an open square. */
function dialerBottomShadow(width) {
  const shift = RAIL_BOTTOM_SHADOW_SHIFT;
  const blockLen = width - shift - 1;
  return `${" ".repeat(shift)}${SHADOW_CHAR.repeat(blockLen)} `;
}

/** Shadow rows — side ▓ on each face row, floor ▓ bridges the corner (tab-rail pattern). */
export function dialerKeyShadowRows(digit, subLabel = "") {
  const faceRows = dialerKeyFaceRows(digit, subLabel);
  const width = faceRows[0].length;
  const lines = [" ".repeat(width)];
  for (let i = 1; i < faceRows.length; i += 1) {
    lines.push(`${" ".repeat(faceRows[i].length)}${SHADOW_CHAR}`);
  }
  lines.push(dialerBottomShadow(width));
  return lines;
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
  /** Rail tab with react-icon overlay — blank cell, same box metrics as glyph tabs. */
  iconFace: () => railIconFaceRows().join("\n"),
  iconShadow: () => railIconShadowRows().join("\n"),
  dialerKeyFace: (digit, subLabel = "") => dialerKeyFaceRows(digit, subLabel).join("\n"),
  dialerKeyShadow: (digit, subLabel = "") => dialerKeyShadowRows(digit, subLabel).join("\n"),
};

export const BOOT_LOGO = `
[ WAYLAND-YUTANI CYBERDEC ]
[ MU/TH/UR 6000 ]

>> INITIALIZE UPLINK <<
`;

export const SYSTEM_HEADER = (provider, channel, model) =>
  `STATION: ${provider.toUpperCase()} // ${channel.toUpperCase()} // ${model}`;
