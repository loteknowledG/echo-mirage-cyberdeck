/** Language tags used on chat transport fences (not document code blocks). */
const TRANSPORT_FENCE_LANGS = new Set(["md", "markdown", "text", "txt", "plain"]);

/**
 * Normalize transport escaping: \\` → `, trim, strip zero-width spaces.
 */
function normalizeWrapperLine(line: string): string {
  return line
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\\(`+)/g, "$1")
    .trim();
}

function parseTransportFenceLine(line: string): { backticks: number; lang: string; hasId: boolean } | null {
  const trimmed = normalizeWrapperLine(line);
  const match = /^(`{3,12})([a-zA-Z][a-zA-Z0-9_.+-]*)?(?:\s+id="[^"]*")?\s*$/i.exec(trimmed);
  if (!match) return null;
  return {
    backticks: match[1].length,
    lang: (match[2] || "").toLowerCase(),
    hasId: /\bid="[^"]*"/i.test(trimmed),
  };
}

/** Standard markdown code-fence opener: ```js (exactly three backticks + language). */
function isInternalCodeFenceOpenerLine(line: string): boolean {
  const parsed = parseTransportFenceLine(line);
  if (!parsed || parsed.backticks !== 3 || !parsed.lang) return false;
  return !TRANSPORT_FENCE_LANGS.has(parsed.lang) && !parsed.hasId;
}

function isStandaloneTripleBacktickLine(line: string): boolean {
  return /^`{3}\s*$/.test(normalizeWrapperLine(line));
}

/**
 * True when the line is a chat/LLM transport fence (not a document ```lang code block).
 */
export function isOperatorPasteWrapperFenceLine(line: string): boolean {
  const trimmed = normalizeWrapperLine(line);
  if (!trimmed) return false;

  // Lone high-backtick run (4–12): transport padding/closers
  if (/^`{4,12}\s*$/.test(trimmed)) return true;

  const parsed = parseTransportFenceLine(line);
  if (!parsed) return false;

  // ``````text, `````md — more than three backticks
  if (parsed.backticks >= 4) return true;

  // Chat id= attribute is always transport
  if (parsed.hasId) return true;

  // ```md, ```text, ```markdown at document edge
  if (parsed.lang && TRANSPORT_FENCE_LANGS.has(parsed.lang)) return true;

  // Bare ``` or ```` with no lang at edge
  if (!parsed.lang && parsed.backticks >= 3) return true;

  return false;
}

/** Trailing ``` is transport only when it does not close an internal ```lang block. */
function isTrailingTransportTripleFence(line: string, remainingLines: string[]): boolean {
  if (!isStandaloneTripleBacktickLine(line)) return false;

  const openers = remainingLines.filter(isInternalCodeFenceOpenerLine).length;
  const standaloneClosers = remainingLines.filter(isStandaloneTripleBacktickLine).length;

  return standaloneClosers + 1 > openers;
}

function isTrailingTransportLine(line: string, remainingLines: string[]): boolean {
  if (line.trim() === "") return true;
  // Balance internal ```lang … ``` before treating a lone ``` as transport.
  if (isStandaloneTripleBacktickLine(line)) {
    return isTrailingTransportTripleFence(line, remainingLines);
  }
  const trimmed = normalizeWrapperLine(line);
  if (/^`{4,12}\s*$/.test(trimmed)) return true;
  return isOperatorPasteWrapperFenceLine(line);
}

function stripLeadingTransportLines(lines: string[]): void {
  while (lines.length > 0) {
    const head = lines[0];
    if (head.trim() === "" || isOperatorPasteWrapperFenceLine(head)) {
      lines.shift();
      continue;
    }
    break;
  }
}

function stripTrailingTransportLines(lines: string[]): void {
  while (lines.length > 0) {
    const tail = lines[lines.length - 1];
    if (isTrailingTransportLine(tail, lines.slice(0, -1))) {
      lines.pop();
      continue;
    }
    break;
  }
}

/**
 * Strip leading/trailing chat transport wrappers before operator render/save.
 * Preserves internal markdown code fences (only trims document edges).
 */
export function cleanOperatorPasteText(raw: string): string {
  if (!raw) return raw;

  const lines = raw.replace(/\r\n/g, "\n").split("\n");

  stripLeadingTransportLines(lines);
  stripTrailingTransportLines(lines);

  return lines.join("\n").trim();
}

export function operatorPasteWasCleaned(before: string, after: string): boolean {
  return before.replace(/\r\n/g, "\n").trim() !== after;
}
