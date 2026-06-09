/** DeepSeek / Trinity-style DSML tool markup emitted in message content instead of OpenAI tool_calls. */

export type ParsedDsmlToolCall = {
  name: string;
  args: Record<string, unknown>;
};

const INVOKE_RE = /invoke\s+name="([^"]+)"/gi;

/** `</|DSML|parameter>` or `</｜｜DSML｜｜parameter>` — slash immediately after `<`. */
const DSML_TAG =
  "(?:\\|+\\|*DSML\\|+\\|*|\\uFF5C\\uFF5CDSML\\uFF5C\\uFF5C)";

const PARAM_RE = new RegExp(
  `parameter\\s+name="([^"]+)"(?:\\s+string="[^"]*")?\\s*>([\\s\\S]*?)</${DSML_TAG}parameter>`,
  "gi",
);

const INVOKE_CLOSE = new RegExp(`</${DSML_TAG}invoke>`, "i");

const INVOKE_BLOCK_RE = new RegExp(
  `<${DSML_TAG}invoke[^>]*>[\\s\\S]*?</${DSML_TAG}invoke>\\s*`,
  "gi",
);

function normalizeDsmlInput(text: string): string {
  return text.replace(/^\[MUTHUR\]\s*/i, "").trim();
}

/** Remove DSML tool blocks from assistant-visible text. */
export function stripDsmlToolMarkup(text: string): string {
  const body = normalizeDsmlInput(text);
  if (!body.includes("DSML") && !/invoke\s+name="/i.test(body)) {
    return text;
  }
  return body
    .replace(new RegExp(`</?${DSML_TAG}\\/?tool_calls>?\\s*`, "gi"), "")
    .replace(new RegExp(`^${DSML_TAG}tool_calls\\s*$`, "gim"), "")
    .replace(INVOKE_BLOCK_RE, "")
    .trim();
}

function parseInvokeBlock(block: string): Record<string, unknown> {
  const args: Record<string, unknown> = {};
  let match: RegExpExecArray | null;
  PARAM_RE.lastIndex = 0;
  while ((match = PARAM_RE.exec(block)) !== null) {
    args[match[1]] = match[2].trim();
  }
  return args;
}

/** Parse DSML invoke blocks from model content into executable tool calls. */
export function parseDsmlToolCalls(text: string): ParsedDsmlToolCall[] {
  const body = normalizeDsmlInput(text);
  if (!body.includes("DSML") && !/invoke\s+name="/i.test(body)) {
    return [];
  }

  const calls: ParsedDsmlToolCall[] = [];
  let invokeMatch: RegExpExecArray | null;
  INVOKE_RE.lastIndex = 0;

  while ((invokeMatch = INVOKE_RE.exec(body)) !== null) {
    const name = invokeMatch[1]?.trim();
    if (!name) continue;

    const blockStart = invokeMatch.index + invokeMatch[0].length;
    const rest = body.slice(blockStart);
    const endMatch = rest.match(INVOKE_CLOSE);
    const block = endMatch?.index != null ? rest.slice(0, endMatch.index) : rest;

    calls.push({
      name,
      args: parseInvokeBlock(block),
    });
  }

  return calls;
}

export function dsmlCallsToOpenAiToolCalls(
  calls: ParsedDsmlToolCall[],
  idPrefix = "dsml",
): Array<{ id: string; type: "function"; function: { name: string; arguments: string } }> {
  const stamp = Date.now();
  return calls.map((call, index) => ({
    id: `${idPrefix}_${stamp}_${index}`,
    type: "function" as const,
    function: {
      name: call.name,
      arguments: JSON.stringify(call.args),
    },
  }));
}
