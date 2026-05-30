import { stripMuthurInvocationPrefix } from "@/lib/browser-intents";
import {
  extractAsciiRenderRequests,
  parseAsciiRenderOperatorInput,
} from "@/lib/muthur-ascii-skill/parse-request";
import type { AsciiRenderRequest } from "@/lib/muthur-ascii-skill/types";
import type { GlyphRenderEngine } from "@/lib/glyph-channel";

export type GlyphMergeMode = "append" | "replace";

export type GlyphCommand =
  | { kind: "mode-on" }
  | { kind: "mode-off" }
  | { kind: "clear" }
  | { kind: "copy" }
  | { kind: "edit-on" }
  | { kind: "edit-off" }
  | {
      kind: "render";
      engine: GlyphRenderEngine;
      text: string;
      font?: string;
      merge?: GlyphMergeMode;
      decorate?: boolean;
    }
  | { kind: "set"; text: string; merge?: GlyphMergeMode }
  | { kind: "ascii-skill"; request: AsciiRenderRequest };

export type GlyphApplyAction =
  | {
      kind: "render";
      engine: GlyphRenderEngine;
      text: string;
      font?: string;
      merge?: GlyphMergeMode;
      decorate?: boolean;
    }
  | { kind: "set"; text: string; merge?: GlyphMergeMode }
  | { kind: "ascii-skill"; request: AsciiRenderRequest };

const QUOTED_VALUE = /"([^"]*)"|'([^']*)'/;

function unquote(value: string): string {
  const trimmed = value.trim();
  const quoted = QUOTED_VALUE.exec(trimmed);
  if (quoted) return (quoted[1] ?? quoted[2] ?? "").trim();
  return trimmed;
}

function parseFigletFontArgs(trimmed: string): { font?: string; text?: string } | null {
  const leading = /^figlet\s+(?:--font|-f)\s+("([^"]+)"|'([^']+)'|(\S+))\s+([\s\S]+)$/i.exec(trimmed);
  if (leading) {
    const font = (leading[2] ?? leading[3] ?? leading[4] ?? "").trim();
    const text = leading[5]?.trim();
    if (font && text) return { font, text };
  }

  const trailing = /^figlet\s+([\s\S]+?)\s+(?:--font|-f)\s+("([^"]+)"|'([^']+)'|(\S+))\s*$/i.exec(trimmed);
  if (trailing) {
    const text = trailing[1]?.trim();
    const font = (trailing[3] ?? trailing[4] ?? trailing[5] ?? "").trim();
    if (font && text) return { font, text };
  }

  return null;
}

/** Strip optional MUTHUR / mother prefix before glyph parsing. */
export function normalizeGlyphCommandInput(input: string): string {
  return stripMuthurInvocationPrefix(input.trim());
}

/** Parse MUTHUR ascii / figlet operator commands (`glyph` aliases ascii for compatibility). */
export function parseGlyphCommand(input: string): GlyphCommand | null {
  const trimmed = normalizeGlyphCommandInput(input);
  if (!trimmed) return null;

  if (/^(?:ascii|glyph)\s+(?:mode|on)\s*$/i.test(trimmed)) return { kind: "mode-on" };
  if (/^(?:ascii|glyph)\s+off\s*$/i.test(trimmed)) return { kind: "mode-off" };
  if (/^(?:ascii|glyph)\s+clear\s*$/i.test(trimmed)) return { kind: "clear" };
  if (/^(?:ascii|glyph)\s+copy\s*$/i.test(trimmed)) return { kind: "copy" };
  if (/^(?:ascii|glyph)\s+edit\s*$/i.test(trimmed)) return { kind: "edit-on" };
  if (/^(?:ascii|glyph)\s+view\s*$/i.test(trimmed)) return { kind: "edit-off" };

  const asciiSkill = parseAsciiRenderOperatorInput(trimmed);
  if (asciiSkill) {
    return { kind: "ascii-skill", request: asciiSkill };
  }

  const figletWithFont = parseFigletFontArgs(trimmed);
  if (figletWithFont?.text) {
    return {
      kind: "render",
      engine: "figlet",
      text: figletWithFont.text,
      font: figletWithFont.font,
    };
  }

  const figlet = /^figlet\s+([\s\S]+)$/i.exec(trimmed);
  if (figlet?.[1]?.trim()) {
    return { kind: "render", engine: "figlet", text: figlet[1].trim() };
  }

  const oneline = /^1\s*line\s+ascii\s+([\s\S]+)$/i.exec(trimmed);
  if (oneline?.[1]?.trim()) {
    return { kind: "render", engine: "oneline", text: oneline[1].trim() };
  }

  const ascii = /^(?:ascii|glyph|text)\s+([\s\S]+)$/i.exec(trimmed);
  if (ascii?.[1]?.trim()) {
    return { kind: "render", engine: "ascii", text: ascii[1].trim() };
  }

  return null;
}

function hasGlyphArtIntent(input: string): boolean {
  if (/\b(?:figlet|ascii|glyph|banner|ascii\s+art|glyph\s+channel|ascii\s+pane)\b/i.test(input)) {
    return true;
  }
  return /\b(?:render|make|show|design)\s+.+\s+in\s+(?:the\s+)?(?:font\s+)?\S+/i.test(input);
}

/** Natural-language glyph requests from MUTHUR chat (e.g. "render ECHO in Impossible font"). */
export function parseGlyphNaturalLanguageIntent(input: string): GlyphCommand | null {
  const text = normalizeGlyphCommandInput(input);
  if (!text || !hasGlyphArtIntent(text)) return null;

  const renderInFont = text.match(
    /^(?:render|make|show|try)\s+["']?(.+?)["']?\s+in\s+(?:the\s+)?(?:font\s+)?["']?([^"'\n.?!]+?)["']?\s*(?:font)?\s*[.?!]?\s*$/i,
  );
  if (renderInFont?.[1] && renderInFont?.[2]) {
    return {
      kind: "render",
      engine: "figlet",
      text: renderInFont[1].trim(),
      font: renderInFont[2].trim().replace(/\s+font$/i, ""),
    };
  }

  const figletFontMatch = text.match(
    /^(?:render|make|create|show|generate|put|add|try|do|give\s+me)\s+(?:a\s+)?(?:figlet|banner)\s+(?:of|for|with|saying)?\s*["']?(.+?)["']?\s+(?:in|with|using)\s+(?:the\s+)?(?:font\s+)?["']?([^"'\n.?!]+?)["']?\s*[.?!]?\s*$/i,
  );
  if (figletFontMatch?.[1] && figletFontMatch?.[2]) {
    return {
      kind: "render",
      engine: "figlet",
      text: figletFontMatch[1].trim(),
      font: figletFontMatch[2].trim(),
    };
  }

  const renderFiglet = text.match(
    /^(?:render|make|create|show|generate|put)\s+["']?(.+?)["']?\s+(?:in|as|to)\s+(?:figlet|the\s+ascii\s+pane|glyph\s+channel|ascii)\s*[.?!]?\s*$/i,
  );
  if (renderFiglet?.[1]) {
    return { kind: "render", engine: "figlet", text: renderFiglet[1].trim() };
  }

  const bannerFor = text.match(
    /^(?:make|create|render)\s+(?:a\s+)?(?:figlet\s+)?banner\s+(?:for|of|with|saying)\s+["']?(.+?)["']?\s*[.?!]?\s*$/i,
  );
  if (bannerFor?.[1]) {
    return { kind: "render", engine: "figlet", text: bannerFor[1].trim() };
  }

  const putInPane = text.match(
    /^(?:put|send|add|render)\s+["']?(.+?)["']?\s+(?:in|to)\s+(?:the\s+)?(?:ascii|glyph)\s+(?:pane|channel)\s*[.?!]?\s*$/i,
  );
  if (putInPane?.[1]) {
    return { kind: "render", engine: "figlet", text: putInPane[1].trim() };
  }

  const helpCreate = text.match(
    /^(?:help\s+(?:me\s+)?(?:create|make|design)|create|design)\s+(?:some\s+)?(?:ascii|figlet|glyph|banner)\s+(?:art\s+)?(?:for|of|with|saying)?\s*["']?(.+?)["']?\s*[.?!]?\s*$/i,
  );
  if (helpCreate?.[1]) {
    return null;
  }

  return null;
}

export function resolveGlyphCommand(input: string): GlyphCommand | null {
  return parseGlyphCommand(input) ?? parseGlyphNaturalLanguageIntent(input);
}

export function isGlyphCommand(input: string): boolean {
  return resolveGlyphCommand(input) !== null;
}

function parseDirectiveKeyValues(body: string): Record<string, string> {
  const args: Record<string, string> = {};
  const re = /(\w+)=("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|[^\s]+)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(body)) !== null) {
    const key = match[1]?.toLowerCase();
    if (!key) continue;
    args[key] = unquote(match[2] ?? "");
  }
  return args;
}

function parseGlyphDirectiveBody(body: string): GlyphApplyAction | null {
  const trimmed = body.trim();
  if (!trimmed) return null;

  if (/^apply-block\b/i.test(trimmed)) {
    const mergeMatch = /merge=(append|replace)/i.exec(trimmed);
    return {
      kind: "set",
      text: "",
      merge: mergeMatch?.[1]?.toLowerCase() === "replace" ? "replace" : "append",
    };
  }

  const pipeParts = trimmed.split("|").map((part) => part.trim());
  if (pipeParts.length >= 2 && /^(figlet|ascii)$/i.test(pipeParts[0] ?? "")) {
    const engine = pipeParts[0]!.toLowerCase() as GlyphRenderEngine;
    const text = pipeParts[1] ?? "";
    if (!text) return null;
    const font = pipeParts[2] || undefined;
    const mergeRaw = pipeParts[3]?.toLowerCase();
    const merge = mergeRaw === "append" || mergeRaw === "replace" ? mergeRaw : undefined;
    return { kind: "render", engine, text, font, merge };
  }

  const args = parseDirectiveKeyValues(trimmed);
  if (args.apply === "block" || args.kind === "apply-block") {
    return { kind: "set", text: "", merge: args.merge === "replace" ? "replace" : "append" };
  }

  const engineRaw = (args.engine ?? "").toLowerCase();
  if (engineRaw === "set" || engineRaw === "raw" || engineRaw === "paste") {
    const text = args.text ?? "";
    if (!text) return null;
    return {
      kind: "set",
      text: text.replace(/\\n/g, "\n"),
      merge: args.merge === "append" ? "append" : "replace",
    };
  }

  const engine =
    engineRaw === "ascii" || engineRaw === "figlet" || engineRaw === "oneline"
      ? engineRaw
      : engineRaw === "1line" || engineRaw === "1-line" || engineRaw === "1 line"
        ? "oneline"
        : null;
  const text = args.text ?? "";
  if (!engine || !text) return null;

  return {
    kind: "render",
    engine,
    text: text.replace(/\\n/g, "\n"),
    font: args.font || undefined,
    merge: args.merge === "append" || args.merge === "replace" ? args.merge : undefined,
    decorate: args.decorate === "false" ? false : args.decorate === "true" ? true : undefined,
  };
}

export function extractFirstAsciiCodeBlock(text: string): string | null {
  const fence =
    /```(?:ascii|text|art)?\s*\n([\s\S]*?)```/i.exec(text) ??
    /```\s*\n([\s\S]*?)```/i.exec(text);
  const block = fence?.[1]?.replace(/\s+$/, "");
  return block?.trim() ? block : null;
}

/** Parse [GLYPH:…] directives and ascii.render JSON from a MUTHUR reply. */
export function parseGlyphResponseActions(responseText: string): {
  actions: GlyphApplyAction[];
  displayText: string;
} {
  const actions: GlyphApplyAction[] = [];
  const directiveRe = /\[GLYPH:([^\]]+)\]/gi;
  let match: RegExpExecArray | null;

  while ((match = directiveRe.exec(responseText)) !== null) {
    const parsed = parseGlyphDirectiveBody(match[1] ?? "");
    if (!parsed) continue;

    if (parsed.kind === "set" && !parsed.text) {
      const block = extractFirstAsciiCodeBlock(responseText);
      if (block) {
        actions.push({ kind: "set", text: block, merge: parsed.merge ?? "append" });
      }
      continue;
    }

    actions.push(parsed);
  }

  const asciiExtract = extractAsciiRenderRequests(responseText);
  for (const request of asciiExtract.requests) {
    actions.push({ kind: "ascii-skill", request });
  }

  let displayText = responseText.replace(directiveRe, "");
  if (asciiExtract.requests.length > 0) {
    displayText = asciiExtract.strippedText;
  }

  displayText = displayText
    .replace(/^=+\s*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { actions, displayText };
}
