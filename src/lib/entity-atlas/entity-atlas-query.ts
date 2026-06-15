/** Client-safe entity atlas intent detection. No fs, no server imports. */

import { parseFoundationQuery } from "@/lib/muthur-foundation-intent";
import { parseMemoryAtlasQuery } from "@/lib/memory-atlas/memory-atlas-query";

export type EntityAtlasQueryKind =
  | "relationship"
  | "governs"
  | "verifies"
  | "depends_on"
  | "belongs_to";

export type EntityAtlasQueryIntent = {
  kind: EntityAtlasQueryKind;
  /** Entity id (L-FS-001) or topic phrase (folder creation, provider authentication) */
  subject: string;
};

const ENTITY_ID_RE =
  /\b(L-(?:[A-Z]+-)*\d+[A-Z]?|JP-[A-Z0-9-]+|JF-[A-Z0-9-]+|ADR-[A-Z]+-\d+|foundation-\d+)\b/i;

function extractSubject(match: RegExpMatchArray, group = 1): string {
  return match[group]?.trim().replace(/[?.!]+$/, "").trim() ?? "";
}

function isEntityAtlasExclusion(trimmed: string): boolean {
  if (parseFoundationQuery(trimmed)) return true;
  if (/^(open|read|show|view)\s+/i.test(trimmed)) return true;
  const memory = parseMemoryAtlasQuery(trimmed);
  if (
    memory &&
    (memory.kind === "active_threads" ||
      memory.kind === "unfinished_threads" ||
      memory.kind === "work_order")
  ) {
    return true;
  }
  return false;
}

/**
 * Detect continuity graph queries (relationships, governance, verification linkage).
 * Returns null for foundation, document-open, and memory-atlas thread/work-order lookups.
 */
export function parseEntityAtlasQuery(input: string): EntityAtlasQueryIntent | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (isEntityAtlasExclusion(trimmed)) return null;

  const lower = trimmed.toLowerCase();

  const relatedMatch =
    trimmed.match(/\bwhat(?:'s| is) related to\s+(.+)$/i) ??
    trimmed.match(/\bwhat(?:'s| is) connected to\s+(.+)$/i) ??
    trimmed.match(/\bshow (?:the )?continuity (?:for|around)\s+(.+)$/i);
  if (relatedMatch) {
    return { kind: "relationship", subject: extractSubject(relatedMatch) };
  }

  const governsMatch =
    trimmed.match(/\bwhat governs\s+(.+)$/i) ??
    trimmed.match(/\bwhich (?:decision|adr) governs\s+(.+)$/i);
  if (governsMatch && !/\bwhat adr governs\b/i.test(lower)) {
    return { kind: "governs", subject: extractSubject(governsMatch) };
  }

  const verifiesMatch =
    trimmed.match(/\bwhat verifies\s+(.+)$/i) ??
    trimmed.match(/\bwhat (?:is the )?verif(?:ier|ication) for\s+(.+)$/i) ??
    trimmed.match(/\bwho verified\s+(.+)$/i);
  if (verifiesMatch) {
    return { kind: "verifies", subject: extractSubject(verifiesMatch) };
  }

  const dependsMatch =
    trimmed.match(/\bwhat depends on\s+(.+)$/i) ??
    trimmed.match(/\bwhat (?:work orders? )?depend on\s+(.+)$/i);
  if (dependsMatch) {
    return { kind: "depends_on", subject: extractSubject(dependsMatch) };
  }

  const belongsMatch =
    trimmed.match(/\bwhat subsystem (?:owns|contains)\s+(.+)$/i) ??
    trimmed.match(/\bwhat does\s+(.+?)\s+belong to\??$/i) ??
    trimmed.match(/\bwhich subsystem (?:is|owns)\s+(.+)$/i);
  if (belongsMatch) {
    return { kind: "belongs_to", subject: extractSubject(belongsMatch) };
  }

  return null;
}

export { ENTITY_ID_RE };
