/** Client-safe memory atlas intent detection. No fs, no server imports. */

import { parseFoundationQuery } from "@/lib/muthur-foundation-intent";

export type MemoryAtlasQueryKind =
  | "work_order"
  | "verification"
  | "adr"
  | "active_threads"
  | "unfinished_threads";

export type MemoryAtlasQueryIntent = {
  kind: MemoryAtlasQueryKind;
  /** Topic phrase for lookup intents, e.g. "folder creation", "provider authentication" */
  topic?: string;
};

function extractTopic(match: RegExpMatchArray, group = 1): string {
  return match[group]?.trim().replace(/[?.!]+$/, "").trim() ?? "";
}

function isMemoryAtlasExclusion(trimmed: string): boolean {
  if (parseFoundationQuery(trimmed)) return true;
  if (/^(open|read|show|view)\s+/i.test(trimmed)) return true;
  return false;
}

/**
 * Detect continuity-oriented memory atlas queries.
 * Returns null for foundation queries and explicit document-open commands.
 */
export function parseMemoryAtlasQuery(input: string): MemoryAtlasQueryIntent | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (isMemoryAtlasExclusion(trimmed)) return null;

  const lower = trimmed.toLowerCase();

  if (
    /^what are (?:our )?active threads?\??$/i.test(trimmed) ||
    /^what are we working on\??$/i.test(trimmed) ||
    /^show active (?:work orders?|threads?)\??$/i.test(trimmed)
  ) {
    return { kind: "active_threads" };
  }

  if (
    /^what (?:remains )?unfinished\??$/i.test(trimmed) ||
    /^unfinished (?:memory )?tasks?\??$/i.test(trimmed) ||
    /^what (?:work )?remains\??$/i.test(trimmed) ||
    /^blocked threads?\??$/i.test(trimmed)
  ) {
    return { kind: "unfinished_threads" };
  }

  const workOrderMatch =
    trimmed.match(
      /\bwhat work order (?:created|owns|drove|is for|covers|implemented)\s+(.+)$/i,
    ) ??
    trimmed.match(/\bwhich work order (?:created|owns|covers)\s+(.+)$/i) ??
    trimmed.match(/\bshow (?:the )?work order (?:for|about)\s+(.+)$/i);
  if (workOrderMatch) {
    return { kind: "work_order", topic: extractTopic(workOrderMatch) };
  }

  const verificationMatch =
    trimmed.match(/\bwhat verified\s+(.+)$/i) ??
    trimmed.match(/\bwho approved\s+(.+)$/i) ??
    trimmed.match(/\bwhat (?:is the )?verif(?:y|ication) (?:for|of)\s+(.+)$/i) ??
    trimmed.match(/\bshow (?:the )?verif(?:ier|ication) (?:for|of|report for)\s+(.+)$/i);
  if (verificationMatch) {
    return { kind: "verification", topic: extractTopic(verificationMatch) };
  }

  const adrMatch =
    trimmed.match(/\bwhat adr (?:decided|governs|recorded)\s+(.+)$/i) ??
    trimmed.match(/\bwhich adr (?:decided|governs)\s+(.+)$/i) ??
    trimmed.match(/^why does\s+(.+?)\s+work this way\??$/i) ??
    trimmed.match(/\bshow (?:the )?decision (?:for|about|record for)\s+(.+)$/i) ??
    trimmed.match(/^why was\s+(.+?)\s+decided\??$/i);
  if (adrMatch) {
    return { kind: "adr", topic: extractTopic(adrMatch) };
  }

  return null;
}
