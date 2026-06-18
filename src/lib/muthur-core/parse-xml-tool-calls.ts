/** Cursor / Nemotron-style tool markup in message content instead of OpenAI tool_calls. */

export type ParsedXmlToolCall = {
  name: string;
  args: Record<string, unknown>;
};

const TOOL_CALL_BLOCK_RE = /<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/gi;
const FUNCTION_BLOCK_RE = /<function=([^>\s]+)>([\s\S]*?)<\/function>/i;
const PARAMETER_RE = /<parameter=([^>\s]+)>\s*([\s\S]*?)\s*<\/parameter>/gi;

function normalizeXmlInput(text: string): string {
  return text.replace(/^\[MUTHUR\]\s*/i, "").trim();
}

/** Remove inline XML tool blocks from assistant-visible text. */
export function stripXmlToolMarkup(text: string): string {
  const body = normalizeXmlInput(text);
  if (!body.includes("<tool_call>") && !body.includes("<function=")) {
    return text;
  }
  return body.replace(TOOL_CALL_BLOCK_RE, "").trim();
}

function parseFunctionBlock(block: string): ParsedXmlToolCall | null {
  const fnMatch = block.match(FUNCTION_BLOCK_RE);
  if (!fnMatch) return null;
  const name = fnMatch[1]?.trim();
  if (!name) return null;

  const args: Record<string, unknown> = {};
  const paramBody = fnMatch[2] ?? "";
  let match: RegExpExecArray | null;
  PARAMETER_RE.lastIndex = 0;
  while ((match = PARAMETER_RE.exec(paramBody)) !== null) {
    args[match[1]] = match[2].trim();
  }

  return { name, args };
}

/** Parse `<tool_call><function=…><parameter=…>` blocks from model content. */
export function parseXmlToolCalls(text: string): ParsedXmlToolCall[] {
  const body = normalizeXmlInput(text);
  if (!body.includes("<tool_call>") && !body.includes("<function=")) {
    return [];
  }

  const calls: ParsedXmlToolCall[] = [];
  let blockMatch: RegExpExecArray | null;
  TOOL_CALL_BLOCK_RE.lastIndex = 0;

  while ((blockMatch = TOOL_CALL_BLOCK_RE.exec(body)) !== null) {
    const parsed = parseFunctionBlock(blockMatch[1] ?? "");
    if (parsed) calls.push(parsed);
  }

  if (calls.length === 0 && body.includes("<function=")) {
    const parsed = parseFunctionBlock(body);
    if (parsed) calls.push(parsed);
  }

  return calls;
}

export function xmlCallsToOpenAiToolCalls(
  calls: ParsedXmlToolCall[],
  idPrefix = "xml",
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
