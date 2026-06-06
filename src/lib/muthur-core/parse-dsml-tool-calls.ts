/** DeepSeek / Trinity-style DSML tool markup emitted in message content instead of OpenAI tool_calls. */

export type ParsedDsmlToolCall = {
  name: string;
  args: Record<string, unknown>;
};

const INVOKE_RE = /invoke\s+name="([^"]+)"/gi;
const PARAM_RE =
  /parameter\s+name="([^"]+)"(?:\s+string="[^"]*")?\s*>([\s\S]*?)(?:<\|?\|?DSML\|?\|?\/parameter>|<\uFF5C\uFF5CDSML\uFF5C\uFF5C\/parameter>)/gi;

/** Remove DSML tool blocks from assistant-visible text. */
export function stripDsmlToolMarkup(text: string): string {
  if (!text.includes("DSML") && !/invoke\s+name="/i.test(text)) {
    return text;
  }
  return text
    .replace(/<\|?\|?DSML\|?\|?tool_calls>\s*/gi, "")
    .replace(/<\|?\|?DSML\|?\|?\/tool_calls>\s*/gi, "")
    .replace(/<\|?\|?DSML\|?\|?invoke[^>]*>[\s\S]*?<\|?\|?DSML\|?\|?\/invoke>\s*/gi, "")
    .replace(/<\uFF5C\uFF5CDSML\uFF5C\uFF5Ctool_calls>\s*/g, "")
    .replace(/<\uFF5C\uFF5CDSML\uFF5C\uFF5C\/tool_calls>\s*/g, "")
    .replace(/<\uFF5C\uFF5CDSML\uFF5C\uFF5Cinvoke[^>]*>[\s\S]*?<\uFF5C\uFF5CDSML\uFF5C\uFF5C\/invoke>\s*/g, "")
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
  if (!text.includes("DSML") && !/invoke\s+name="/i.test(text)) {
    return [];
  }

  const calls: ParsedDsmlToolCall[] = [];
  let invokeMatch: RegExpExecArray | null;
  INVOKE_RE.lastIndex = 0;

  while ((invokeMatch = INVOKE_RE.exec(text)) !== null) {
    const name = invokeMatch[1]?.trim();
    if (!name) continue;

    const blockStart = invokeMatch.index + invokeMatch[0].length;
    const rest = text.slice(blockStart);
    const endMatch = rest.match(/<\|?\|?DSML\|?\|?\/invoke>|<\uFF5C\uFF5CDSML\uFF5C\uFF5C\/invoke>/i);
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
