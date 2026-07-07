import { createHash } from "crypto";
import { existsSync, readFileSync } from "fs";
import { readFile } from "fs/promises";
import path from "path";

export const AION_LINEAGE_PACK_ID = "aion";

export type AionLineageArtifact = {
  name: string;
  source_path: string;
  destination_path: string;
  file_size_bytes: number;
  sha256: string;
};

export type AionLineageManifest = {
  schema_version: number;
  pack_id: typeof AION_LINEAGE_PACK_ID;
  name: string;
  source_system: string;
  source_root: string;
  recovered_at: string;
  artifacts: AionLineageArtifact[];
};

const MANIFEST_FILENAME = "lineage-manifest.json";

export function aionLineageDir(workspaceRoot = process.cwd()): string {
  return path.join(workspaceRoot, ".muthur", "lineage", "aion");
}

export function aionLineageManifestPath(workspaceRoot = process.cwd()): string {
  return path.join(aionLineageDir(workspaceRoot), MANIFEST_FILENAME);
}

export function loadAionLineageManifest(workspaceRoot = process.cwd()): AionLineageManifest | null {
  const manifestPath = aionLineageManifestPath(workspaceRoot);
  if (!existsSync(manifestPath)) return null;
  const parsed = JSON.parse(readFileSync(manifestPath, "utf8")) as AionLineageManifest;
  if (parsed.pack_id !== AION_LINEAGE_PACK_ID || !Array.isArray(parsed.artifacts)) {
    throw new Error("lineage-manifest.json: invalid Aion lineage pack");
  }
  return parsed;
}

export function resolveAionArtifactPath(
  artifact: AionLineageArtifact,
  workspaceRoot = process.cwd(),
): string {
  return path.join(workspaceRoot, artifact.destination_path.replace(/^\.\//, ""));
}

export async function readAionArtifactText(
  name: string,
  workspaceRoot = process.cwd(),
): Promise<{ artifact: AionLineageArtifact; text: string; artifactPath: string }> {
  const manifest = loadAionLineageManifest(workspaceRoot);
  if (!manifest) {
    throw new Error("Aion lineage pack not recovered");
  }
  const artifact = manifest.artifacts.find((entry) => entry.name === name);
  if (!artifact) {
    throw new Error(`Aion lineage artifact not found: ${name}`);
  }
  const artifactPath = resolveAionArtifactPath(artifact, workspaceRoot);
  if (!existsSync(artifactPath)) {
    throw new Error(`Aion lineage artifact missing: ${artifactPath}`);
  }
  const text = await readFile(artifactPath, "utf8");
  return { artifact, text, artifactPath };
}

export function verifyAionLineageIntegrity(workspaceRoot = process.cwd()): {
  ok: boolean;
  checked: number;
  failed: string[];
} {
  const manifest = loadAionLineageManifest(workspaceRoot);
  if (!manifest) {
    return { ok: false, checked: 0, failed: ["manifest"] };
  }

  const failed: string[] = [];
  for (const artifact of manifest.artifacts) {
    const artifactPath = resolveAionArtifactPath(artifact, workspaceRoot);
    if (!existsSync(artifactPath)) {
      failed.push(artifact.name);
      continue;
    }
    const actualSha256 = createHash("sha256").update(readFileSync(artifactPath)).digest("hex");
    if (actualSha256 !== artifact.sha256) {
      failed.push(artifact.name);
    }
  }

  return {
    ok: failed.length === 0,
    checked: manifest.artifacts.length,
    failed,
  };
}

export function hashFileBytes(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}
