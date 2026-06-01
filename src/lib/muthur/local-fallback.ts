import { getLatestMuthurObservation } from "@/lib/muthur/observation/observation-store.server";
import { recordIntentRouterHealth, recordFailure, type HealthCategory } from "@/lib/muthur/health";

const PATCH_KEYWORDS = ["patch", "fix", "suggest", "what should", "do next", "fix this", "change", "update"];
const INSPECT_KEYWORDS = ["what", "whats", "what's", "where", "show", "tell me", "read", "summarize", "inspect"];

export type CachedObservation = {
  fileName: string | null;
  filePath: string | null;
  language: string | null;
  dirty: boolean;
  contentExcerpt: string | null;
  fullContent: string | null;
  timestamp: number;
};

const cachedObservation: CachedObservation = {
  fileName: null,
  filePath: null,
  language: null,
  dirty: false,
  contentExcerpt: null,
  fullContent: null,
  timestamp: 0,
};

export function updateCachedObservation(): void {
  try {
    const obs = getLatestMuthurObservation("cyberdeck");
    if (!obs?.editor?.active) return;
    const e = obs.editor;
    cachedObservation.fileName = e.fileName ?? null;
    cachedObservation.filePath = e.filePath ?? null;
    cachedObservation.language = e.language ?? null;
    cachedObservation.dirty = e.dirty ?? false;
    cachedObservation.contentExcerpt = e.contentExcerpt ?? e.content?.slice(0, 300) ?? null;
    cachedObservation.fullContent = e.content ?? null;
    cachedObservation.timestamp = Date.now();
  } catch {
    /* ignore */
  }
}

export function getCachedObservation(): CachedObservation {
  return { ...cachedObservation };
}

export function isLocalOnlyIntent(message: string): boolean {
  const lower = message.toLowerCase().trim();
  if (lower.includes("operator pane") || lower.includes("editor pane") || lower.includes("current file") || lower.includes("active document") || lower.includes("monaco") || lower.includes("workspace")) {
    return true;
  }
  return false;
}

export function isPatchSuggestionIntent(message: string): boolean {
  const lower = message.toLowerCase().trim();
  return PATCH_KEYWORDS.some((kw) => lower.includes(kw));
}

export function buildLocalObservationResponse(): string {
  const obs = getCachedObservation();
  if (!obs.fileName) {
    return "Operator pane observation unavailable. No file is currently open in the editor.";
  }
  const lines = [
    `Operator pane observation:`,
    `File: ${obs.fileName}`,
    `Language: ${obs.language ?? "unknown"}`,
    `Dirty: ${obs.dirty ? "true" : "false"}`,
    obs.contentExcerpt ? `Content excerpt: ${obs.contentExcerpt}` : null,
    `\nNote: Provider unavailable. This is a local deterministic response.`,
  ].filter(Boolean);
  return lines.join("\n");
}

export function buildLocalPatchSuggestionResponse(): string {
  const obs = getCachedObservation();
  if (!obs.fileName) {
    return "Cannot suggest patch: no active file in operator pane.";
  }
  const excerpt = obs.contentExcerpt ?? obs.fullContent?.slice(0, 500) ?? "";
  const baseSuggestion = obs.fileName.includes("intent") || obs.fileName.includes("routing") || obs.fileName.includes("browser") ?
    `Based on active file "${obs.fileName}" (${obs.language ?? "unknown"}), inspect the intent router, command registry, and observe_operator_pane tool for routing issues. Add a guard so local keywords like "operator pane" block browser search before route dispatch.` :
    `Based on active file "${obs.fileName}" (${obs.language ?? "unknown"}), identify the relevant code section and propose a targeted fix.`;
  return [
    `[LOCAL FALLBACK] Provider unavailable — patch suggestion based on last editor observation.`,
    ``,
    `Active file: ${obs.fileName}`,
    `Language: ${obs.language ?? "unknown"}`,
    `Dirty: ${obs.dirty ? "true" : "false"}`,
    ``,
    excerpt ? `Content excerpt:\n${excerpt.slice(0, 300)}${excerpt.length > 300 ? "..." : ""}` : null,
    ``,
    `Suggested direction:`,
    baseSuggestion,
    ``,
    `To apply a full patch, restore provider connectivity and retry.`,
  ].filter(Boolean).join("\n");
}

export function handleLocalFallback(message: string): string | null {
  const lower = message.toLowerCase().trim();
  const isObserve = lower.includes("whats in the operator") || lower.includes("what's in the operator") || lower.includes("what do you see") || lower.includes("what are you looking at") || lower.includes("tell me what's on") || lower.includes("read the active document") || lower.includes("summarize the current editor");
  const isPatch = isPatchSuggestionIntent(message);
  if (isObserve || isPatch) {
    recordIntentRouterHealth({
      status: isPatch ? "degraded" : "healthy",
      lastPrompt: message,
      chosenAction: isObserve ? "observe_operator_pane" : "patch_suggestion",
      confidence: 0.95,
      fallbackUsed: true,
    });
  }
  if (isObserve) {
    updateCachedObservation();
    return buildLocalObservationResponse();
  }
  if (isPatch) {
    updateCachedObservation();
    const obs = getCachedObservation();
    if (obs.fileName) {
      return buildLocalPatchSuggestionResponse();
    }
  }
  return null;
}