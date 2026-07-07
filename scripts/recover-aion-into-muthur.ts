import assert from "node:assert/strict";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { getMemory } from "../src/muthur/memory/core";
import { ensureAionLineageMemory } from "../src/muthur/lineage/ensure-aion-lineage";
import {
  aionLineageDir,
  aionLineageManifestPath,
  hashFileBytes,
  loadAionLineageManifest,
  type AionLineageArtifact,
} from "../src/muthur/lineage/aion-store";
import { getSamusManusRoot } from "../src/lib/samus-manus/samus-manus-config.server";

type SourceSpec = {
  src: string;
  dest: string;
  name: string;
};

const SOURCES: SourceSpec[] = [
  { src: "person/Aion/MANIFEST.md", dest: "MANIFEST.md", name: "MANIFEST.md" },
  { src: "person/Aion/README.md", dest: "README.md", name: "README.md" },
  { src: "person/Aion/RESTORE_INSTRUCTIONS.md", dest: "RESTORE_INSTRUCTIONS.md", name: "RESTORE_INSTRUCTIONS.md" },
  { src: "person/Aion/CODEX_HANDOFF_PROMPT.md", dest: "CODEX_HANDOFF_PROMPT.md", name: "CODEX_HANDOFF_PROMPT.md" },
  { src: "docs/AION_IDENTITY.md", dest: "AION_IDENTITY.md", name: "AION_IDENTITY.md" },
  { src: "docs/MIND_MEMORY_NOOSPHERE_FOR_HUMANS.md", dest: "MIND_MEMORY_NOOSPHERE_FOR_HUMANS.md", name: "MIND_MEMORY_NOOSPHERE_FOR_HUMANS.md" },
  { src: "docs/MIND_LINEAGE.md", dest: "MIND_LINEAGE.md", name: "MIND_LINEAGE.md" },
  {
    src: "memory/memories_archive/noosphere/aion-prime/2026-03-30.md",
    dest: "archive/2026-03-30.md",
    name: "archive/2026-03-30.md",
  },
  {
    src: "memory/memories_archive/noosphere/aion-prime/2026-03-31.md",
    dest: "archive/2026-03-31.md",
    name: "archive/2026-03-31.md",
  },
  {
    src: "memory/memories_archive/noosphere/aion-prime/2026-04-01.md",
    dest: "archive/2026-04-01.md",
    name: "archive/2026-04-01.md",
  },
];

async function main(): Promise<void> {
  const workspaceRoot = process.cwd();
  const samusRoot = getSamusManusRoot();
  const packDir = aionLineageDir(workspaceRoot);

  console.log("recover:aion");
  console.log(`  samus root: ${samusRoot}`);
  console.log(`  destination: ${packDir}`);

  assert.ok(existsSync(samusRoot), `samus-manus root not found: ${samusRoot}`);

  mkdirSync(path.join(packDir, "archive"), { recursive: true });

  const artifacts: AionLineageArtifact[] = [];

  for (const spec of SOURCES) {
    const sourcePath = path.join(samusRoot, spec.src);
    assert.ok(existsSync(sourcePath), `missing source: ${sourcePath}`);

    const destPath = path.join(packDir, spec.dest);
    mkdirSync(path.dirname(destPath), { recursive: true });
    copyFileSync(sourcePath, destPath);

    const bytes = readFileSync(destPath);
    const destination_path = path.join(".muthur", "lineage", "aion", spec.dest).replace(/\\/g, "/");

    artifacts.push({
      name: spec.name,
      source_path: spec.src.replace(/\\/g, "/"),
      destination_path,
      file_size_bytes: bytes.length,
      sha256: hashFileBytes(bytes),
    });

    console.log(`  copied ${spec.name} (${bytes.length} bytes)`);
  }

  const manifest = {
    schema_version: 1,
    pack_id: "aion" as const,
    name: "Aion",
    source_system: "samus-manus",
    source_root: samusRoot.replace(/\\/g, "/"),
    recovered_at: new Date().toISOString(),
    artifacts,
  };

  writeFileSync(aionLineageManifestPath(workspaceRoot), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(`  wrote ${aionLineageManifestPath(workspaceRoot)}`);

  const memory = getMemory();
  await memory.ready();
  const seeded = await ensureAionLineageMemory(memory, workspaceRoot);
  console.log(`  memory seeded: ${seeded.loaded} (integrity ${seeded.integrityOk ? "PASS" : "FAIL"})`);

  const loaded = loadAionLineageManifest(workspaceRoot);
  assert.ok(loaded, "manifest missing after write");
  assert.equal(loaded.artifacts.length, SOURCES.length);

  console.log("recover:aion PASS");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
