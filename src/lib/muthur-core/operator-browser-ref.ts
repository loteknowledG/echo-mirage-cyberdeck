import type { BrowserCommand } from "@/lib/browser-intents";
import type { MuthurOperatorBrowserRef } from "@/lib/muthur-core/types";

export function extractOperatorBrowserRef(output: unknown): MuthurOperatorBrowserRef | null {
  if (!output || typeof output !== "object") return null;
  const record = output as Record<string, unknown>;
  const kind = record.kind;

  if (kind === "goto") {
    const url = typeof record.url === "string" ? record.url.trim() : "";
    if (!url) return null;
    return { kind: "goto", url };
  }
  if (kind === "click") {
    const selector = typeof record.selector === "string" ? record.selector.trim() : "";
    if (!selector) return null;
    return { kind: "click", selector };
  }
  if (kind === "type") {
    const selector = typeof record.selector === "string" ? record.selector.trim() : "";
    const value = typeof record.value === "string" ? record.value : "";
    if (!selector) return null;
    return { kind: "type", selector, value };
  }
  if (kind === "submit") {
    const selector = typeof record.selector === "string" ? record.selector.trim() : "";
    if (!selector) return null;
    return { kind: "submit", selector };
  }
  if (kind === "snapshot") return { kind: "snapshot" };
  if (kind === "back") return { kind: "back" };
  if (kind === "forward") return { kind: "forward" };
  if (kind === "reload") return { kind: "reload" };

  return null;
}

export function parseOperatorBrowserJson(raw: string | null | undefined): BrowserCommand | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return extractOperatorBrowserRef(parsed);
  } catch {
    return null;
  }
}
