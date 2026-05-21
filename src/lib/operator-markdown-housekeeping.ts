import { cleanOperatorPasteText } from "@/lib/operator-paste-cleaner";

/** Toggle state for standard ``` fenced blocks (outside = normalize). */
function isCodeFenceDelimiter(line: string): boolean {
  return /^`{3}(?:[a-zA-Z][a-zA-Z0-9_.+-]*)?\s*$/.test(line.trim());
}

function normalizeMarkdownLineOutsideFence(line: string): string {
  const withoutTrailing = line.replace(/[ \t]+$/, "");
  const heading = /^(#{1,6})\s*(.*)$/.exec(withoutTrailing);
  if (heading) {
    const content = heading[2].trimStart();
    return content ? `${heading[1]} ${content}` : heading[1];
  }
  if (/^[-*_]{3,}\s*$/.test(withoutTrailing.trim())) {
    return "---";
  }
  return withoutTrailing;
}

/**
 * Mechanical markdown normalization (L-7): spacing and blank lines only.
 * Does not rewrite meaning, reorder sections, or edit fenced code bodies.
 */
export function normalizeMarkdownMechanical(markdown: string): string {
  if (!markdown) return markdown;

  const normalizedEol = markdown.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalizedEol.split("\n");
  const out: string[] = [];
  let inCodeFence = false;

  for (const line of lines) {
    if (isCodeFenceDelimiter(line)) {
      inCodeFence = !inCodeFence;
      out.push(line);
      continue;
    }
    out.push(inCodeFence ? line : normalizeMarkdownLineOutsideFence(line));
  }

  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** L-7 bounded housekeeping: transport wrappers + mechanical markdown normalization. */
export function applyOperatorMarkdownHousekeeping(raw: string): string {
  if (!raw) return raw;
  return normalizeMarkdownMechanical(cleanOperatorPasteText(raw));
}

export function operatorMarkdownWasHousekept(before: string, after: string): boolean {
  const norm = (s: string) => s.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  return norm(before) !== norm(after);
}
