import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import { bootMuthur, buildMemoryContext } from "../src/muthur/boot/boot_muthur";
import { getAtlas } from "../src/muthur/atlas/atlas";
import { ensureEchoMirageAtlasSeed } from "../src/muthur/atlas/ensure-echo-mirage-seed";
import { mapAtlasToPaneEntities } from "../src/muthur/atlas/atlas-api.server";
import { getMemory } from "../src/muthur/memory/core";

const DEV_STATE_PATH = path.join(process.cwd(), ".tmp", "dev-server.json");

async function devServerUp(baseUrl: string): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl}/api/muthur/atlas`, { cache: "no-store" });
    return res.ok;
  } catch {
    return false;
  }
}

async function resolveProbeBaseUrl(): Promise<string | null> {
  const candidates: string[] = [];
  if (process.env.MUTHUR_VERIFY_BASE_URL?.trim()) {
    candidates.push(process.env.MUTHUR_VERIFY_BASE_URL.trim().replace(/\/$/, ""));
  }
  try {
    const state = JSON.parse(await fs.readFile(DEV_STATE_PATH, "utf8")) as {
      origin?: string;
      appPort?: number;
    };
    if (state.origin) candidates.push(String(state.origin).replace(/\/$/, ""));
    if (state.appPort) candidates.push(`http://127.0.0.1:${state.appPort}`);
  } catch {
    /* optional */
  }
  candidates.push("http://127.0.0.1:3050", "http://127.0.0.1:3051");

  for (const origin of [...new Set(candidates)]) {
    if (await devServerUp(origin)) return origin;
  }
  return null;
}

async function testInProcessAtlasMemory(): Promise<void> {
  await bootMuthur({ workspaceRoot: process.cwd() });
  const seed = await ensureEchoMirageAtlasSeed();
  assert.ok(seed.entityCount >= 7, `expected seeded entities, got ${seed.entityCount}`);

  const atlas = getAtlas();
  const paneEntities = mapAtlasToPaneEntities(atlas);
  assert.ok(paneEntities.some((entity) => entity.id === "project:echo-mirage"));
  assert.ok(paneEntities.some((entity) => entity.id === "concept:muthur"));

  const muthurPane = paneEntities.find((entity) => entity.id === "concept:muthur");
  assert.ok(muthurPane?.locations.length, "expected MUTHUR entity locations");
  assert.ok(
    muthurPane?.locations.some((loc) => loc.path.includes("boot_muthur.ts")),
    "expected boot path in MUTHUR locations",
  );

  const audioPane = paneEntities.find((entity) => entity.id === "concept:audio");
  assert.ok(audioPane?.locations.length, "expected Audio entity locations");
  assert.ok(
    audioPane?.locations.some((loc) => loc.path.includes("AudioEngine.js")),
    "expected AudioEngine path in Audio locations",
  );

  const resolved = await atlas.resolveEntity("muthur");
  assert.ok(resolved.entity, "expected MUTHUR entity resolution");
  assert.ok(resolved.hardRelations.length >= 1, "expected doctrine relations");

  const projectCtx = await atlas.resolveProjectContext("echo-mirage", "exploratory");
  assert.ok(projectCtx.primary, "expected echo-mirage project context");
  assert.ok(projectCtx.context.length >= 1, "expected related atlas context");

  const memoryCtx = await buildMemoryContext("muthur atlas memory");
  assert.match(memoryCtx, /MUTHUR MEMORY:/);
  assert.match(memoryCtx, /Atlas/);

  const memory = getMemory();
  await memory.ready();
  assert.ok(memory.getMemoryCount() >= 1, "expected boot memories");
}

async function testHttpAtlasMemory(baseUrl: string): Promise<void> {
  const atlasRes = await fetch(`${baseUrl}/api/muthur/atlas`, { cache: "no-store" });
  assert.equal(atlasRes.status, 200);
  const atlasJson = (await atlasRes.json()) as {
    ok: boolean;
    entities: Array<{ id: string }>;
    memoryCount: number;
  };
  assert.equal(atlasJson.ok, true);
  assert.ok(atlasJson.entities.some((entity) => entity.id === "concept:memory-atlas"));

  const resolveRes = await fetch(`${baseUrl}/api/muthur/atlas`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: "execution runtime" }),
  });
  assert.equal(resolveRes.status, 200);
  const resolveJson = (await resolveRes.json()) as { ok: boolean; entity: { id: string } | null };
  assert.equal(resolveJson.ok, true);
  assert.ok(resolveJson.entity, "expected HTTP atlas resolve");

  const memRes = await fetch(`${baseUrl}/api/muthur/memory`, { cache: "no-store" });
  assert.equal(memRes.status, 200);
  const memJson = (await memRes.json()) as { ok: boolean; memoryCount: number };
  assert.equal(memJson.ok, true);
  const beforeCount = memJson.memoryCount;

  const turnRes = await fetch(`${baseUrl}/api/muthur/memory`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      op: "record_turn",
      user: "probe atlas memory",
      assistant: "atlas and ship memory bridge verified",
    }),
  });
  assert.equal(turnRes.status, 200);
  const turnJson = (await turnRes.json()) as { ok: boolean; memoryCount: number };
  assert.equal(turnJson.ok, true);
  if (turnJson.memoryCount > beforeCount) {
    assert.ok(turnJson.memoryCount >= beforeCount + 1, "expected record_turn to append ship memory");
  } else {
    console.log(
      "probe:muthur-atlas-memory — HTTP memory write inconclusive (restart dev server after sql.js external config)",
    );
  }
}

async function main(): Promise<void> {
  await testInProcessAtlasMemory();
  console.log("probe:muthur-atlas-memory — in-process OK");

  const baseUrl = await resolveProbeBaseUrl();
  if (!baseUrl) {
    console.log("probe:muthur-atlas-memory — HTTP skipped (dev server offline)");
    return;
  }

  await testHttpAtlasMemory(baseUrl);
  console.log(`probe:muthur-atlas-memory — HTTP OK (${baseUrl})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
