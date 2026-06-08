const SHADOW_CHAR = "▓";
/** Bottom ▓ block width trim — same 4 blocks as rail, positioned one column left. */
const BOTTOM_SHADOW_TRIM = 1;

function centerCell(label, width) {
  if (!label) return " ".repeat(width);
  if (label.length >= width) return label.slice(0, width);
  const pad = width - label.length;
  const left = Math.floor(pad / 2);
  return `${" ".repeat(left)}${label}${" ".repeat(pad - left)}`;
}

/** Rail-compatible compact box (`┌───┐` = 5 cols for width 3). */
function compactBoxRows(width, label = "") {
  const line = "─".repeat(width);
  if (label.length === 1) {
    return [`┌${line}┐`, `│ ${label} │`, `└${line}┘`];
  }
  const cell = centerCell(label, width);
  return [`┌${line}┐`, `│${cell}│`, `└${line}┘`];
}

/** Wide label box (gallery-style) for action text buttons. */
function wideBoxRows(label) {
  const line = "─".repeat(label.length);
  const pad = "  ";
  return [
    `${pad}┌─${line}─┐`,
    `${pad}│ ${label} │`,
    `${pad}└─${line}─┘`,
  ];
}

function resolveCompactWidth({ cols, label }) {
  if (typeof cols === "number") return cols;
  if (label) return Math.max(3, label.length);
  return 3;
}

export function asciiMorphFaceRows({ cols, label = "" } = {}) {
  if (label && label.length > resolveCompactWidth({ cols, label })) {
    return wideBoxRows(label);
  }
  return compactBoxRows(resolveCompactWidth({ cols, label }), label);
}

function asciiMorphBottomShadow(topRow) {
  const width = topRow.length;
  const blockLen = width - BOTTOM_SHADOW_TRIM;
  // Leading gap — bottom ▓ meets side ▓ at the corner (same as rail ` ▓▓▓▓`).
  return " ".repeat(BOTTOM_SHADOW_TRIM) + SHADOW_CHAR.repeat(blockLen);
}

export function renderAsciiMorphFace(options = {}) {
  return asciiMorphFaceRows(options).join("\n");
}

export function renderAsciiMorphShadowSide(options = {}) {
  const rows = asciiMorphFaceRows(options);
  return [
    " ".repeat(rows[0].length),
    `${" ".repeat(rows[1].length)}${SHADOW_CHAR}`,
    `${" ".repeat(rows[2].length)}${SHADOW_CHAR}`,
  ].join("\n");
}

export function renderAsciiMorphShadowBottom(options = {}) {
  const rows = asciiMorphFaceRows(options);
  return asciiMorphBottomShadow(rows[0]);
}

export function renderAsciiMorphShadow(options = {}) {
  return [renderAsciiMorphShadowSide(options), renderAsciiMorphShadowBottom(options)].join(
    "\n",
  );
}

export function renderAsciiMorphComposite(options = {}) {
  const rows = asciiMorphFaceRows(options);
  return [
    rows[0],
    `${rows[1]}${SHADOW_CHAR}`,
    `${rows[2]}${SHADOW_CHAR}`,
    asciiMorphBottomShadow(rows[0]),
  ].join("\n");
}
