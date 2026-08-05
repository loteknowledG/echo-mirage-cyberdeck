/** Preserve leading spaces; trim trailing whitespace per line. */
export function leftAlignAsciiBlock(text: string): string {
  return text.replace(/\r\n/g, "\n").split("\n").map((line) => line.trimEnd()).join("\n");
}

/** Pad each line so the block is right-aligned within its max width. */
export function rightAlignAsciiBlock(text: string): string {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const width = Math.max(0, ...lines.map((line) => line.length));
  return lines.map((line) => line.padStart(width)).join("\n");
}
