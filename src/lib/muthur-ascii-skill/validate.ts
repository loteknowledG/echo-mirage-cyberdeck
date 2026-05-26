import {
  ASCII_DEFAULT_WIDTH,
  ASCII_MAX_WIDTH,
  ASCII_MIN_WIDTH,
  ASCII_STYLE_PROFILES,
  ASCII_TEMPLATES,
  type AsciiRenderRequest,
  type AsciiStyleProfile,
  type AsciiTemplate,
} from "@/lib/muthur-ascii-skill/types";
import { visibleLength } from "@/lib/muthur-ascii-skill/primitives";

const CONTROL_CHAR_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export function sanitizeAsciiInput(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(CONTROL_CHAR_RE, "").replace(/\t/g, "  ");
}

export function normalizeAsciiWidth(width?: number): number {
  if (typeof width !== "number" || !Number.isFinite(width)) return ASCII_DEFAULT_WIDTH;
  return Math.max(ASCII_MIN_WIDTH, Math.min(ASCII_MAX_WIDTH, Math.round(width)));
}

export function isAsciiTemplate(value: string): value is AsciiTemplate {
  return (ASCII_TEMPLATES as readonly string[]).includes(value);
}

export function isAsciiStyleProfile(value: string): value is AsciiStyleProfile {
  return (ASCII_STYLE_PROFILES as readonly string[]).includes(value);
}

function mapStatusItem(item: Record<string, unknown>, index: number) {
  const label = typeof item.label === "string" ? sanitizeAsciiInput(item.label) : "";
  const value = typeof item.value === "string" ? sanitizeAsciiInput(item.value) : "";
  const status = item.status;
  if (status != null && status !== "ok" && status !== "warn" && status !== "fail" && status !== "pending") {
    throw new Error(`items[${index}].status invalid`);
  }
  return {
    label,
    value,
    status: status as "ok" | "warn" | "fail" | "pending" | undefined,
  };
}

export function validateAsciiRenderRequest(raw: unknown): { ok: true; request: AsciiRenderRequest } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "ascii.render request must be a JSON object" };
  }

  const obj = raw as Record<string, unknown>;
  const tool = obj.tool;
  if (tool !== "ascii.render") {
    return { ok: false, error: 'tool must be "ascii.render"' };
  }

  const templateRaw = obj.template;
  if (typeof templateRaw !== "string" || !isAsciiTemplate(templateRaw)) {
    return {
      ok: false,
      error: `template must be one of: ${ASCII_TEMPLATES.join(", ")}`,
    };
  }

  const styleRaw = obj.style;
  if (styleRaw != null && (typeof styleRaw !== "string" || !isAsciiStyleProfile(styleRaw))) {
    return {
      ok: false,
      error: `style must be one of: ${ASCII_STYLE_PROFILES.join(", ")}`,
    };
  }

  const mergeRaw = obj.merge;
  if (mergeRaw != null && mergeRaw !== "append" && mergeRaw !== "replace") {
    return { ok: false, error: 'merge must be "append" or "replace"' };
  }

  const request: AsciiRenderRequest = {
    tool: "ascii.render",
    template: templateRaw,
    style: typeof styleRaw === "string" ? styleRaw : undefined,
    width: normalizeAsciiWidth(typeof obj.width === "number" ? obj.width : undefined),
    merge: mergeRaw === "append" || mergeRaw === "replace" ? mergeRaw : undefined,
  };

  for (const key of ["text", "title", "subtitle"] as const) {
    const value = obj[key];
    if (value != null) {
      if (typeof value !== "string") return { ok: false, error: `${key} must be a string` };
      request[key] = sanitizeAsciiInput(value);
    }
  }

  if (obj.body != null) {
    if (typeof obj.body === "string") {
      request.body = sanitizeAsciiInput(obj.body);
    } else if (Array.isArray(obj.body)) {
      request.body = obj.body.map((line) => sanitizeAsciiInput(String(line)));
    } else {
      return { ok: false, error: "body must be a string or string array" };
    }
  }

  if (obj.lines != null) {
    if (!Array.isArray(obj.lines)) return { ok: false, error: "lines must be a string array" };
    request.lines = obj.lines.map((line) => sanitizeAsciiInput(String(line)));
  }

  if (obj.items != null) {
    if (!Array.isArray(obj.items)) return { ok: false, error: "items must be an array" };
    try {
      request.items = obj.items.map((item, index) => {
        if (!item || typeof item !== "object") {
          throw new Error(`items[${index}] must be an object`);
        }
        return mapStatusItem(item as Record<string, unknown>, index);
      });
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "items invalid" };
    }
  }

  return { ok: true, request };
}

export function validateAsciiOutput(output: string, width: number): string {
  const lines = sanitizeAsciiInput(output)
    .split("\n")
    .map((row) => {
      if (visibleLength(row) <= width) return row;
      return [...row].slice(0, width).join("");
    });

  while (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }

  return lines.join("\n");
}

export const ASCII_RENDER_RULES = [
  "Use fixed-width monospace output only.",
  "Keep width at or below pane width (default 72, max 120).",
  "Do not hand-count spaces — request ascii.render with template/style/intent.",
  "Prefer evidence and status phrases over decorative noise.",
  "Avoid random character soup; preserve readability.",
] as const;
