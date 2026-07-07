import { existsSync } from "fs";
import { readFile } from "fs/promises";
import path from "path";
import type { getMemory } from "../memory/core";
import {
  aionLineageDir,
  loadAionLineageManifest,
  resolveAionArtifactPath,
  verifyAionLineageIntegrity,
} from "./aion-store";

async function readPackText(
  workspaceRoot: string,
  relativeName: string,
): Promise<string | null> {
  const manifest = loadAionLineageManifest(workspaceRoot);
  if (!manifest) return null;
  const artifact = manifest.artifacts.find((entry) => entry.name === relativeName);
  if (!artifact) return null;
  const artifactPath = resolveAionArtifactPath(artifact, workspaceRoot);
  if (!existsSync(artifactPath)) return null;
  const text = await readFile(artifactPath, "utf8");
  return text.trim() || null;
}

/** Seed recovered Aion lineage into ship memory (once per pack). */
export async function ensureAionLineageMemory(
  memory: ReturnType<typeof getMemory>,
  workspaceRoot: string,
): Promise<{ loaded: boolean; integrityOk: boolean }> {
  const manifest = loadAionLineageManifest(workspaceRoot);
  if (!manifest) {
    return { loaded: false, integrityOk: false };
  }

  const integrity = verifyAionLineageIntegrity(workspaceRoot);
  const existing = memory.all(500);
  if (existing.some((row) => row.type === "lineage_pack" && row.metadata?.pack === "aion")) {
    return { loaded: true, integrityOk: integrity.ok };
  }

  const manifestText = await readPackText(workspaceRoot, "MANIFEST.md");
  const identityText = await readPackText(workspaceRoot, "AION_IDENTITY.md");
  const restoreText = await readPackText(workspaceRoot, "RESTORE_INSTRUCTIONS.md");

  const packBody = [
    manifestText ? `# Aion Manifest\n${manifestText}` : null,
    identityText ? `# Aion Identity\n${identityText}` : null,
    restoreText ? `# Restore Instructions\n${restoreText}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  if (packBody) {
    memory.add("lineage_pack", packBody, {
      source: "aion_lineage_recovery",
      pack: "aion",
      topic: "identity",
      canonical: true,
      recovered_at: manifest.recovered_at,
      source_system: manifest.source_system,
    });
  }

  const archiveNames = manifest.artifacts
    .map((entry) => entry.name)
    .filter((name) => name.startsWith("archive/"));

  for (const archiveName of archiveNames) {
    const text = await readPackText(workspaceRoot, archiveName);
    if (!text) continue;
    memory.add("lineage_archive", text, {
      source: "aion_lineage_recovery",
      pack: "aion",
      topic: "continuity",
      artifact: archiveName,
      recovered_at: manifest.recovered_at,
    });
  }

  memory.flush();
  return { loaded: true, integrityOk: integrity.ok };
}

export function aionLineagePackPresent(workspaceRoot = process.cwd()): boolean {
  return existsSync(path.join(aionLineageDir(workspaceRoot), "lineage-manifest.json"));
}
