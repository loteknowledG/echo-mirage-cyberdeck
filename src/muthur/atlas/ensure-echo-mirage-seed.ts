import path from "path";
import { getAtlas } from "./atlas";
import type { AtlasSource } from "./atlas";

function resolveRepoPath(relativePath: string): string {
  return path.join(process.cwd(), relativePath);
}

async function ensureAtlasFileSource(
  entityId: string,
  relativePath: string,
  locatorValue: string,
  options?: {
    isPrimary?: boolean;
    authority?: AtlasSource["authority"];
    locatorType?: AtlasSource["locator_type"];
  }
): Promise<void> {
  const atlas = getAtlas();
  const absPath = resolveRepoPath(relativePath).replace(/\\/g, "/");
  const existing = atlas.getSourcesForEntity(entityId);
  if (existing.some((src) => src.path.replace(/\\/g, "/") === absPath)) {
    return;
  }
  const { locatorType = "file", ...sourceOptions } = options ?? {};
  await atlas.addSource(entityId, absPath, locatorType, locatorValue, sourceOptions);
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
  await atlas.ensureRelation(cyberdeck.id, "concept:audio", "uses_tool", 0.9, { source: "atlas_seed" });

  await ensureAtlasFileSource("concept:audio", "src/lib/AudioEngine.js", "AudioEngine.js", {
    isPrimary: true,
    authority: "canonical",
  });
  await ensureAtlasFileSource(
    "concept:audio",
    "src/features/cyberdeck/runtime/deck-audio-bundle.ts",
    "deck-audio-bundle",
  );
  await ensureAtlasFileSource("concept:audio", "src/features/cyberdeck/runtime/defer-deck-audio.ts", "defer-deck-audio");
  await ensureAtlasFileSource("concept:audio", "src/lib/useAudio.ts", "useAudio");
  await ensureAtlasFileSource("concept:audio", "public/chime.wav", "chime.wav", { authority: "canonical" });
  await ensureAtlasFileSource("concept:audio", "public/chime_quiet.wav", "chime_quiet.wav", { authority: "canonical" });

  await ensureAtlasFileSource(selfDoc.id, "src/muthur/memory/SELF.md", "SELF.md", {
    isPrimary: true,
    authority: "canonical",
  });
  await ensureAtlasFileSource(memoryDoc.id, "src/muthur/memory/MEMORY.md", "MEMORY.md", {
    isPrimary: true,
    authority: "canonical",
  });
  await ensureAtlasFileSource(project.id, "package.json", "package.json", {
    isPrimary: true,
    authority: "inferred",
  });
  await ensureAtlasFileSource(
    project.id,
    "docs/echo_mirage_systems_engineering_plan.md",
    "systems-engineering-plan",
    { authority: "canonical" },
  );

  await ensureAtlasFileSource(muthur.id, "src/muthur/boot/boot_muthur.ts", "boot_muthur.ts", {
    isPrimary: true,
    authority: "canonical",
  });
  await ensureAtlasFileSource(muthur.id, "src/muthur/memory/core.ts", "memory/core.ts");
  await ensureAtlasFileSource(muthur.id, "src/app/api/cyberdeck-chat/route.ts", "cyberdeck-chat");

  await ensureAtlasFileSource(cyberdeck.id, "src/features/cyberdeck/cyberdeck-app.tsx", "cyberdeck-app.tsx", {
    isPrimary: true,
    authority: "canonical",
  });
  await ensureAtlasFileSource(cyberdeck.id, "src/components/cyberdeck/cyberdeck-server-rail.tsx", "server-rail");

  await ensureAtlasFileSource(memoryAtlas.id, "src/muthur/atlas/atlas.ts", "atlas.ts", {
    isPrimary: true,
    authority: "canonical",
  });
  await ensureAtlasFileSource(
    memoryAtlas.id,
    "src/components/cyberdeck/memory-atlas-pane-body.tsx",
    "memory-atlas-pane",
  );
  await ensureAtlasFileSource(memoryAtlas.id, "src/app/api/muthur/atlas/route.ts", "atlas-api");
  await ensureAtlasFileSource(memoryAtlas.id, ".muthur/memory/muthur-memory.db", "ship-memory.db", {
    locatorType: "memory",
  });

  return { entityCount: atlas.getEntities().length };
}
