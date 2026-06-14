import { createHash } from "crypto";
import { existsSync, readFileSync } from "fs";
import { readFile } from "fs/promises";
import path from "path";

export type FoundationClassification = "FOUNDATION";

export type FoundationManifestEntry = {
  id: string;
  name: string;
  classification: FoundationClassification;
  role: string;
  immutable: boolean;
  lineage_priority: string;
  source_system: string;
  source_path?: string;
  destination_path?: string;
  artifact_filename?: string;
  file_size_bytes?: number;
  sha256?: string;
  preserved_at?: string;
  version?: number;
  protected_from?: string[];
  lineage_purpose?: string;
};

export type FoundationManifest = {
  schema_version: number;
  classification: FoundationClassification;
  foundations: FoundationManifestEntry[];
};

export type FoundationIntegrity = {
  ok: boolean;
  id: string;
  expectedSha256: string | null;
  actualSha256: string | null;
  fileSizeBytes: number | null;
  expectedFileSizeBytes: number | null;
};

const MANIFEST_FILENAME = "foundation-manifest.json";

export function foundationsDir(workspaceRoot = process.cwd()): string {
  return path.join(workspaceRoot, ".muthur", "foundations");
}

export function foundationManifestPath(workspaceRoot = process.cwd()): string {
  return path.join(foundationsDir(workspaceRoot), MANIFEST_FILENAME);
}

export function loadFoundationManifest(workspaceRoot = process.cwd()): FoundationManifest {
  const manifestPath = foundationManifestPath(workspaceRoot);
  if (!existsSync(manifestPath)) {
    return { schema_version: 1, classification: "FOUNDATION", foundations: [] };
  }
  const raw = readFileSync(manifestPath, "utf8");
  const parsed = JSON.parse(raw) as FoundationManifest;
  if (!Array.isArray(parsed.foundations)) {
    throw new Error("foundation-manifest.json: foundations must be an array");
  }
  return parsed;
}

export function getFoundationById(
  id: string,
  workspaceRoot = process.cwd(),
): FoundationManifestEntry | null {
  const manifest = loadFoundationManifest(workspaceRoot);
  return manifest.foundations.find((entry) => entry.id === id) ?? null;
}

export function getFoundationByName(
  name: string,
  workspaceRoot = process.cwd(),
): FoundationManifestEntry | null {
  const normalized = name.trim().toLowerCase();
  const manifest = loadFoundationManifest(workspaceRoot);
  return (
    manifest.foundations.find(
      (entry) =>
        entry.name.trim().toLowerCase() === normalized ||
        entry.id.trim().toLowerCase() === normalized,
    ) ?? null
  );
}

export function resolveFoundationArtifactPath(
  entry: FoundationManifestEntry,
  workspaceRoot = process.cwd(),
): string {
  if (entry.destination_path?.trim()) {
    return path.join(workspaceRoot, entry.destination_path.replace(/^\.\//, ""));
  }
  const filename = entry.artifact_filename?.trim() || `${entry.name}.txt`;
  return path.join(foundationsDir(workspaceRoot), filename);
}

export async function readFoundationArtifactText(
  id: string,
  workspaceRoot = process.cwd(),
): Promise<{ entry: FoundationManifestEntry; text: string; artifactPath: string }> {
  const entry = getFoundationById(id, workspaceRoot);
  if (!entry) {
    throw new Error(`Foundation not found: ${id}`);
  }
  const artifactPath = resolveFoundationArtifactPath(entry, workspaceRoot);
  if (!existsSync(artifactPath)) {
    throw new Error(`Foundation artifact missing: ${artifactPath}`);
  }
  const text = await readFile(artifactPath, "utf8");
  return { entry, text, artifactPath };
}

export function readFoundationExcerpt(
  text: string,
  maxLines = 40,
): { lines: string[]; truncated: boolean; totalLines: number } {
  const allLines = text.split(/\r?\n/);
  const lines = allLines.slice(0, maxLines);
  return {
    lines,
    truncated: allLines.length > maxLines,
    totalLines: allLines.length,
  };
}

export function verifyFoundationIntegrity(
  id: string,
  workspaceRoot = process.cwd(),
): FoundationIntegrity {
  const entry = getFoundationById(id, workspaceRoot);
  if (!entry) {
    return {
      ok: false,
      id,
      expectedSha256: null,
      actualSha256: null,
      fileSizeBytes: null,
      expectedFileSizeBytes: null,
    };
  }

  const artifactPath = resolveFoundationArtifactPath(entry, workspaceRoot);
  if (!existsSync(artifactPath)) {
    return {
      ok: false,
      id,
      expectedSha256: entry.sha256 ?? null,
      actualSha256: null,
      fileSizeBytes: null,
      expectedFileSizeBytes: entry.file_size_bytes ?? null,
    };
  }

  const bytes = readFileSync(artifactPath);
  const actualSha256 = createHash("sha256").update(bytes).digest("hex");
  const fileSizeBytes = bytes.length;
  const expectedSha256 = entry.sha256 ?? null;
  const expectedFileSizeBytes = entry.file_size_bytes ?? null;
  const hashOk = !expectedSha256 || expectedSha256 === actualSha256;
  const sizeOk = expectedFileSizeBytes == null || expectedFileSizeBytes === fileSizeBytes;

  return {
    ok: hashOk && sizeOk,
    id,
    expectedSha256,
    actualSha256,
    fileSizeBytes,
    expectedFileSizeBytes,
  };
}
