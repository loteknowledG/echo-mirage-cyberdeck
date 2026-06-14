/** Client-safe document command intent detection. No fs, no server imports. */

import { parseFoundationQuery } from "@/lib/muthur-foundation-intent";
import { parseMemoryAtlasQuery } from "@/lib/memory-atlas/memory-atlas-query";

export type DocumentOpenVerb = "open" | "read" | "show" | "view";

export type DocumentOpenIntent = {
  kind: "DOCUMENT_OPEN";
  verb: DocumentOpenVerb;
  /** Raw target after verb, e.g. L-ARCH-001.md */
  target: string;
};

const DOCUMENT_VERB_RE = /^(open|read|show|view)\s+(.+)$/i;
const DOCUMENT_EXTENSION_RE = /\.(md|markdown|txt|pdf|docx)$/i;
const KNOWN_DOCUMENT_ID_RE =
  /^(?:L-ARCH-\d+(?:\.md)?|foundation-\d+(?:\.md|\.txt)?|operator-doc(?:\.md)?)$/i;

/** Operator viewport / visibility questions — route to observe_operator_pane via provider. */
export function parseOperatorObservationQuery(input: string): boolean {
  const trimmed = input.trim();
  if (!trimmed) return false;
  const lower = trimmed.toLowerCase();

  if (
    /\bwhat(?:'s| is) (?:currently )?(?:visible|open|in the operator pane)\b/.test(lower) ||
    /\bwhat document is (?:currently )?(?:open|visible)\b/.test(lower) ||
    /\bdescribe the operator pane\b/.test(lower) ||
    /\bwhat(?:'s| is) in the operator pane\b/.test(lower) ||
    /\bwhich (?:file|document) is (?:open|visible)\b/.test(lower)
  ) {
    return true;
  }

  return false;
}

function normalizeDocumentTarget(raw: string): string {
  return raw.trim().replace(/^["']|["']$/g, "").replace(/[?.!]+$/, "").trim();
}

function isDocumentTarget(target: string): boolean {
  if (!target) return false;
  if (DOCUMENT_EXTENSION_RE.test(target)) return true;
  if (KNOWN_DOCUMENT_ID_RE.test(target)) return true;
  if (/^L-ARCH-\d+$/i.test(target)) return true;
  if (/^foundation-\d+$/i.test(target)) return true;
  return false;
}

/**
 * Detect explicit document open/read/show/view commands.
 * Returns null for observation queries and foundation queries.
 */
export function parseDocumentOpenIntent(input: string): DocumentOpenIntent | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (parseOperatorObservationQuery(trimmed)) return null;
  if (parseFoundationQuery(trimmed)) return null;
  if (parseMemoryAtlasQuery(trimmed)) return null;

  const match = trimmed.match(DOCUMENT_VERB_RE);
  if (!match) return null;

  const verb = match[1].toLowerCase() as DocumentOpenVerb;
  const target = normalizeDocumentTarget(match[2]);
  if (!isDocumentTarget(target)) return null;

  return { kind: "DOCUMENT_OPEN", verb, target };
}

export function documentTargetToBasename(target: string): string {
  const normalized = normalizeDocumentTarget(target);
  if (DOCUMENT_EXTENSION_RE.test(normalized)) {
    return normalized.split(/[/\\]/).pop() ?? normalized;
  }
  if (/^L-ARCH-\d+$/i.test(normalized)) {
    return `${normalized}.md`;
  }
  if (/^foundation-\d+$/i.test(normalized)) {
    return normalized;
  }
  return normalized.split(/[/\\]/).pop() ?? normalized;
}
