import path from "path";
import { existsSync } from "fs";
import { getAtlas } from "./atlas";

function resolveDocPath(relativePath: string): string {
  const root = process.cwd();
  const candidates = [
    path.join(root, relativePath),
    path.join(root, "src", "muthur", "memory", path.basename(relativePath)),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return path.join(root, relativePath);
}

export async function ensureEchoMirageAtlasSeed(): Promise<{ entityCount: number }> {
  const atlas = getAtlas();

  const project = atlas.ensureEntity(
    "project:echo-mirage",
    "project",
    "Echo Mirage Cyberdeck",
    "Alpha Craftwerk cyberdeck — Next.js shell, MUTHUR continuity, operator workspace.",
    {
      confidence: 0.95,
      aliases: ["echo-mirage", "cyberdeck", "deck"],
      attributes: { track: "alpha", package_manager: "pnpm" },
    }
  );

  const muthur = atlas.ensureEntity(
    "concept:muthur",
    "concept",
    "MUTHUR",
    "Multimodal continuity co-pilot — memory, atlas, execution runtime, operator uplink.",
    {
      confidence: 0.94,
      aliases: ["MU/TH/UR", "ship computer", "continuity"],
    }
  );

  const cyberdeck = atlas.ensureEntity(
    "concept:cyberdeck",
    "concept",
    "Cyberdeck Shell",
    "Tab rail, operator pane, browser verify, flight log, and module surfaces.",
    { confidence: 0.9, aliases: ["deck shell", "operator deck"] }
  );

  const execution = atlas.ensureEntity(
    "concept:execution",
    "concept",
    "Execution Runtime",
    "Persistent watch, patrol, background tasks, and coding-verify receipts.",
    { confidence: 0.88, aliases: ["runtime", "patrol", "watch"] }
  );

  const memoryAtlas = atlas.ensureEntity(
    "concept:memory-atlas",
    "concept",
    "Memory Atlas",
    "Semantic entity grid — project, doctrine, and recall relations for MUTHUR.",
    { confidence: 0.92, aliases: ["atlas", "entity grid", "recall map"] }
  );

  const selfDoc = atlas.ensureEntity(
    "doc:self-md",
    "doc",
    "SELF.md",
    "MUTHUR identity, doctrine (MU/TH/UR), and operational boundaries.",
    { confidence: 1, aliases: ["SELF", "identity doc"] }
  );

  const memoryDoc = atlas.ensureEntity(
    "doc:memory-md",
    "doc",
    "MEMORY.md",
    "Durable operational memory — architecture notes and evergreen project context.",
    { confidence: 1, aliases: ["MEMORY", "operational memory"] }
  );

  await atlas.ensureRelation(project.id, cyberdeck.id, "implements", 0.9, { source: "atlas_seed" });
  await atlas.ensureRelation(project.id, muthur.id, "bootstraps", 0.9, { source: "atlas_seed" });
  await atlas.ensureRelation(muthur.id, selfDoc.id, "described_by", 1, { source: "atlas_seed" });
  await atlas.ensureRelation(muthur.id, memoryDoc.id, "described_by", 1, { source: "atlas_seed" });
  await atlas.ensureRelation(muthur.id, memoryAtlas.id, "feeds_into", 0.85, { source: "atlas_seed" });
  await atlas.ensureRelation(execution.id, project.id, "depends_on_project", 0.8, { source: "atlas_seed" });
  await atlas.ensureRelation(memoryAtlas.id, muthur.id, "uses_tool", 0.85, { source: "atlas_seed" });
  await atlas.ensureRelation(cyberdeck.id, execution.id, "feeds_into", 0.75, { source: "atlas_seed" });
  await atlas.ensureRelation(cyberdeck.id, memoryAtlas.id, "references_concept", 0.7, { source: "atlas_seed" });

  const selfPath = resolveDocPath("src/muthur/memory/SELF.md");
  const memoryPath = resolveDocPath("src/muthur/memory/MEMORY.md");

  if (atlas.getSourcesForEntity(selfDoc.id).length === 0) {
    await atlas.addSource(selfDoc.id, selfPath, "file", "SELF.md", {
      isPrimary: true,
      authority: "canonical",
    });
  }

  if (atlas.getSourcesForEntity(memoryDoc.id).length === 0) {
    await atlas.addSource(memoryDoc.id, memoryPath, "file", "MEMORY.md", {
      isPrimary: true,
      authority: "canonical",
    });
  }

  if (atlas.getSourcesForEntity(project.id).length === 0) {
    await atlas.addSource(project.id, path.join(process.cwd(), "package.json"), "file", "package.json", {
      isPrimary: true,
      authority: "inferred",
    });
  }

  return { entityCount: atlas.getEntities().length };
}
