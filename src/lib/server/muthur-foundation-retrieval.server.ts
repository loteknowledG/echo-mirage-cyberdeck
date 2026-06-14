// SERVER ONLY: reads .muthur/foundations from disk. Do not import from client components.

import type { FoundationQueryIntent } from "@/lib/muthur-foundation-intent";
import { FOUNDATION_001_ID } from "@/lib/muthur-foundation-intent";
import {
  getFoundationById,
  loadFoundationManifest,
  readFoundationArtifactText,
  readFoundationExcerpt,
  verifyFoundationIntegrity,
  type FoundationManifestEntry,
} from "@/muthur/foundations/foundation-store";

export type { FoundationQueryIntent } from "@/lib/muthur-foundation-intent";
export { parseFoundationQuery } from "@/lib/muthur-foundation-intent";

function formatFoundationMeta(entry: FoundationManifestEntry, integrityOk: boolean): string {
  return `[MUTHUR // FOUNDATION RETRIEVAL // READ-ONLY]

ID: ${entry.id}
Name: ${entry.name}
Classification: ${entry.classification}
Role: ${entry.role}
Immutable: ${entry.immutable ? "yes" : "no"}
Lineage priority: ${entry.lineage_priority}
Source system: ${entry.source_system}
Source path: ${entry.source_path ?? "unknown"}
Preserved at: ${entry.preserved_at ?? "unknown"}
Destination: ${entry.destination_path ?? "unknown"}
SHA256: ${entry.sha256 ?? "unknown"}
Integrity check: ${integrityOk ? "PASS" : "FAIL"}

This artifact is not ordinary memory. It is not embedded, ranked, pruned, summarized, deduplicated, or garbage collected.

Lineage purpose: ${entry.lineage_purpose ?? "origin continuity"}`;
}

export async function buildFoundationResponse(
  intent: FoundationQueryIntent,
  workspaceRoot = process.cwd(),
): Promise<string> {
  const manifest = loadFoundationManifest(workspaceRoot);
  const entry =
    getFoundationById(intent.kind === "origin_lineage" ? FOUNDATION_001_ID : intent.id, workspaceRoot) ??
    manifest.foundations[0] ??
    null;

  if (!entry) {
    return "[MUTHUR // FOUNDATION RETRIEVAL]\n\nNo foundation artifacts are registered.";
  }

  const integrity = verifyFoundationIntegrity(entry.id, workspaceRoot);

  if (intent.kind === "origin_lineage") {
    return `[MUTHUR // FOUNDATION RETRIEVAL // ORIGIN LINEAGE]

I am MUTHUR on Echo Mirage. My continuity lineage includes Samus-Manus.

Foundation-001 (${entry.name}) is the registered origin artifact. It preserves the earliest surviving continuity record associated with memory persistence, identity, and agency — not as ranked knowledge, but as immutable foundation.

Artifact: ${entry.destination_path ?? entry.name}
Classification: FOUNDATION (immutable, read-only)
Source: ${entry.source_system} :: ${entry.source_path ?? "unknown"}
Integrity: ${integrity.ok ? "PASS" : "FAIL"}

Ask: "What is Foundation-001?" or "Tell me about lets-remember-something-ai" for manifest metadata and a verbatim excerpt. Full artifact retrieval: GET /api/muthur/foundations?id=${entry.id}&content=1`;
  }

  if (intent.kind === "foundation_meta") {
    return formatFoundationMeta(entry, integrity.ok);
  }

  const { text } = await readFoundationArtifactText(entry.id, workspaceRoot);
  const excerpt = readFoundationExcerpt(text, 40);
  const excerptBody = excerpt.lines.join("\n");

  return `${formatFoundationMeta(entry, integrity.ok)}

[VERBATIM EXCERPT — NOT SUMMARIZED]
Lines 1–${excerpt.lines.length} of ${excerpt.totalLines}:

${excerptBody}
${excerpt.truncated ? "\n… (excerpt truncated; full artifact unchanged at destination path)" : ""}

Full read-only artifact: GET /api/muthur/foundations?id=${entry.id}&content=1`;
}
