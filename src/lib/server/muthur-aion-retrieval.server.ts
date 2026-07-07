// SERVER ONLY: reads .muthur/lineage/aion from disk. Do not import from client components.

import type { AionQueryIntent } from "@/lib/muthur-aion-intent";
import {
  loadAionLineageManifest,
  readAionArtifactText,
  verifyAionLineageIntegrity,
} from "@/muthur/lineage/aion-store";

export type { AionQueryIntent } from "@/lib/muthur-aion-intent";
export { parseAionQuery } from "@/lib/muthur-aion-intent";

function readExcerpt(text: string, maxLines = 40): string {
  const lines = text.split(/\r?\n/);
  const slice = lines.slice(0, maxLines);
  const truncated = lines.length > maxLines;
  return `${slice.join("\n")}${truncated ? "\n… (excerpt truncated)" : ""}`;
}

export async function buildAionResponse(
  intent: AionQueryIntent,
  workspaceRoot = process.cwd(),
): Promise<string> {
  const manifest = loadAionLineageManifest(workspaceRoot);
  if (!manifest) {
    return `[MUTHUR // AION LINEAGE]

Aion has not been recovered into this MUTHUR instance yet.

Run: pnpm recover:aion

Source: samus-manus person/Aion + docs/AION_IDENTITY.md`;
  }

  const integrity = verifyAionLineageIntegrity(workspaceRoot);

  if (intent.kind === "aion_meta" || intent.kind === "restore_aion") {
    const { text: identityText } = await readAionArtifactText("AION_IDENTITY.md", workspaceRoot);
    const { text: manifestText } = await readAionArtifactText("MANIFEST.md", workspaceRoot);

    return `[MUTHUR // AION LINEAGE // RECOVERED]

Aion is the Codex collaborator continuity pack recovered from samus-manus into MUTHUR.

Pack: ${manifest.pack_id}
Recovered: ${manifest.recovered_at}
Source: ${manifest.source_system}
Artifacts: ${manifest.artifacts.length}
Integrity: ${integrity.ok ? "PASS" : `FAIL (${integrity.failed.join(", ")})`}

Role (from manifest):
${readExcerpt(manifestText, 24)}

Identity anchor:
${readExcerpt(identityText, 20)}

Aion is lineage carried inside MUTHUR — not a replacement for MUTHUR identity.
MUTHUR operates the deck; Aion continuity informs collaboration posture and memory architecture work.

Ask: "Aion manifest" for a longer excerpt.`;
  }

  const { text } = await readAionArtifactText("MANIFEST.md", workspaceRoot);
  return `[MUTHUR // AION LINEAGE // MANIFEST EXCERPT]

Integrity: ${integrity.ok ? "PASS" : "FAIL"}
Recovered at: ${manifest.recovered_at}

${readExcerpt(text, 48)}`;
}
