/** Decorative ASCII separator lines made of repeated + / - / = only. */
const ASCII_SEPARATOR_LINE_RE = /^[\s+\-=]+$/;

/**
 * Turn lines like `+++++++++++++++-----------------` into speakable phrases.
 * Returns null when the line is normal prose.
 */
export function verbalizeAsciiSeparatorLine(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed || !ASCII_SEPARATOR_LINE_RE.test(trimmed)) return null;
  const hasPlus = trimmed.includes("+");
  const hasDash = trimmed.includes("-");
  if (hasPlus && hasDash) return "plus plus plus, dash dash dash";
  if (hasPlus) return "plus plus plus";
  if (hasDash) return "dash dash dash";
  return null;
}

/** Apply separator verbalization line-by-line before other speech cleanup. */
export function verbalizeAsciiSeparatorsInText(text: string): string {
  return text
    .split("\n")
    .map((line) => verbalizeAsciiSeparatorLine(line) ?? line)
    .join("\n");
}

/** Normalize assistant text for MUTHUR voice playback. */
export function textForMuthurSpeech(value: string): string {
  const raw = typeof value === "string" ? value : "";
  if (!raw.trim()) return "";
  return verbalizeAsciiSeparatorsInText(raw)
    .replace(/[#*\/\\]+/g, " ")
    .replace(/[\u2500-\u257F\u2590-\u259F\u25A0-\u25FF\u2600-\u26FF\u2700-\u27BF\u2B50\u25C6\u25C7\u25B2\u25B3\u2B1A-\u2B1C]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
