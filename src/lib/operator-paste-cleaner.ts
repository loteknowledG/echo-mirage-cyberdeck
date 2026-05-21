/** True when the line is only a markdown/code fence (ChatGPT paste wrappers). */
export function isOperatorPasteWrapperFenceLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  return /^`{3,4}(?:[a-zA-Z0-9_.+-]+)?(?:\s+id="[^"]*")?\s*$/.test(trimmed);
}

/**
 * Strip leading/trailing chat fences such as:
 * ````text id="…"`
 * ```md id="…"`
 * trailing lone ```
 */
export function cleanOperatorPasteText(raw: string): string {
  if (!raw) return raw;

  const lines = raw.replace(/\r\n/g, "\n").split("\n");

  while (lines.length > 0 && isOperatorPasteWrapperFenceLine(lines[0])) {
    lines.shift();
  }

  while (lines.length > 0 && isOperatorPasteWrapperFenceLine(lines[lines.length - 1])) {
    lines.pop();
  }

  return lines.join("\n").trim();
}

export function operatorPasteWasCleaned(before: string, after: string): boolean {
  return before.replace(/\r\n/g, "\n").trim() !== after;
}
