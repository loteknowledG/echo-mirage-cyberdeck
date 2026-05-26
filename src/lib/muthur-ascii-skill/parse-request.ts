import type { AsciiRenderRequest } from "@/lib/muthur-ascii-skill/types";
import { validateAsciiRenderRequest } from "@/lib/muthur-ascii-skill/validate";

function tryParseJsonObject(text: string): unknown | null {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function normalizeAsciiRenderObject(obj: Record<string, unknown>): Record<string, unknown> {
  if (obj.tool === "ascii.render") return obj;
  const nested = obj.ascii;
  if (nested && typeof nested === "object") {
    const inner = nested as Record<string, unknown>;
    if (inner.render && typeof inner.render === "object") {
      return { tool: "ascii.render", ...(inner.render as Record<string, unknown>) };
    }
  }
  if (typeof obj.template === "string") {
    return { tool: "ascii.render", ...obj };
  }
  return obj;
}

export function parseAsciiRenderJson(text: string): AsciiRenderRequest | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const parsed = tryParseJsonObject(trimmed);
  if (!parsed || typeof parsed !== "object") return null;

  const normalized = normalizeAsciiRenderObject(parsed as Record<string, unknown>);
  const validated = validateAsciiRenderRequest(normalized);
  return validated.ok ? validated.request : null;
}

const ASCII_RENDER_FENCE =
  /```(?:ascii-render|json|ascii)\s*\n([\s\S]*?)```/i;
const INLINE_ASCII_RENDER =
  /\{[\s\S]*?"tool"\s*:\s*"ascii\.render"[\s\S]*?\}/;

export function extractAsciiRenderRequests(text: string): {
  requests: AsciiRenderRequest[];
  strippedText: string;
} {
  const requests: AsciiRenderRequest[] = [];
  let strippedText = text;

  strippedText = strippedText.replace(new RegExp(ASCII_RENDER_FENCE.source, "gi"), (block, body: string) => {
    const parsed = parseAsciiRenderJson(body);
    if (parsed) requests.push(parsed);
    return "";
  });

  const inlineMatches = [...strippedText.matchAll(new RegExp(INLINE_ASCII_RENDER.source, "g"))];
  for (const match of inlineMatches) {
    const parsed = parseAsciiRenderJson(match[0] ?? "");
    if (parsed) {
      requests.push(parsed);
      strippedText = strippedText.replace(match[0] ?? "", "");
    }
  }

  strippedText = strippedText
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { requests, strippedText };
}

export function parseAsciiRenderOperatorInput(input: string): AsciiRenderRequest | null {
  const trimmed = input.trim();
  const jsonPrefix = /^(?:ascii\s+render|ascii\.render|render\s+ascii)\s+([\s\S]+)$/i.exec(trimmed);
  if (jsonPrefix?.[1]) {
    return parseAsciiRenderJson(jsonPrefix[1]);
  }
  if (trimmed.startsWith("{") && trimmed.includes('"ascii.render"')) {
    return parseAsciiRenderJson(trimmed);
  }
  return null;
}
