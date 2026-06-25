import type { ParsedDsmlToolCall } from "@/lib/muthur-core/parse-dsml-tool-calls";

const FENCED_TOOL_CODE_RE = /```(?:tool_code|json|javascript|typescript|js|ts)?[^\n]*\n([\s\S]*?)```/gi;
const LOCALFS_CALL_RE = /localfs\.(mkdir|write|cat|ls|stat)\s*\(\s*(\{[\s\S]*?\})\s*\)/gi;

function tryParseJsonObject(raw: string): Record<string, unknown> | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    /* model JSON often malformed — skip */
  }
  return null;
}

function parseLocalFsCall(action: string, argsJson: string): ParsedDsmlToolCall | null {
  const args = tryParseJsonObject(argsJson);
  if (!args) return null;
  return {
    name: "localfs",
    args: { action, ...args },
  };
}

/** Parse prose / fenced-code localfs calls models emit instead of OpenAI tool_calls. */
export function parseProseToolCalls(text: string): ParsedDsmlToolCall[] {
  const calls: ParsedDsmlToolCall[] = [];
  const seen = new Set<string>();

  const pushCall = (call: ParsedDsmlToolCall | null) => {
    if (!call) return;
    const key = `${call.name}:${JSON.stringify(call.args)}`;
    if (seen.has(key)) return;
    seen.add(key);
    calls.push(call);
  };

  let fencedMatch: RegExpExecArray | null;
  FENCED_TOOL_CODE_RE.lastIndex = 0;
  while ((fencedMatch = FENCED_TOOL_CODE_RE.exec(text)) !== null) {
    const body = fencedMatch[1] ?? "";
    let localfsMatch: RegExpExecArray | null;
    LOCALFS_CALL_RE.lastIndex = 0;
    while ((localfsMatch = LOCALFS_CALL_RE.exec(body)) !== null) {
      pushCall(parseLocalFsCall(localfsMatch[1] ?? "", localfsMatch[2] ?? ""));
    }
  }

  let localfsMatch: RegExpExecArray | null;
  LOCALFS_CALL_RE.lastIndex = 0;
  while ((localfsMatch = LOCALFS_CALL_RE.exec(text)) !== null) {
    pushCall(parseLocalFsCall(localfsMatch[1] ?? "", localfsMatch[2] ?? ""));
  }

  return calls;
}

export function stripProseToolMarkup(text: string): string {
  let body = text.replace(FENCED_TOOL_CODE_RE, "").trim();
  body = body.replace(LOCALFS_CALL_RE, "").trim();
  return body;
}
