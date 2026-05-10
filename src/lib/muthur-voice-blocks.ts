/**
 * Split assistant text into speech blocks (paragraphs) and read the last block by default
 * for more context than a single sentence.
 */

function normalizeSpeechText(value: string): string {
  const raw = typeof value === "string" ? value : "";
  if (!raw.trim()) return "";
  return raw
    .replace(/#/g, "")
    .replace(/[*\/\\]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Split on blank lines; each block is flattened to a single spoken line. */
export function splitIntoSpeechBlocks(raw: string): string[] {
  const t = raw.trim();
  if (!t) return [];
  const chunks = t.split(/\n\s*\n+/);
  const out: string[] = [];
  for (const c of chunks) {
    const n = normalizeSpeechText(c);
    if (n) out.push(n);
  }
  return out.length ? out : normalizeSpeechText(t) ? [normalizeSpeechText(t)] : [];
}

export function lastSpeechBlock(raw: string): string {
  const blocks = splitIntoSpeechBlocks(raw);
  if (!blocks.length) return "";
  return blocks[blocks.length - 1] ?? "";
}
