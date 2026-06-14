/**
 * Phase 1 acceptance probe — MUTHUR self-memory wiring (no Samus import).
 * Run: pnpm probe:muthur-memory-phase1
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";

import { buildMemoryPrompt } from "../src/muthur/memory/chat-memory";
import { bootMuthur, buildMemoryContext } from "../src/muthur/boot/boot_muthur";
import { getAtlas, resetAtlas } from "../src/muthur/atlas/atlas";
import { loadAtlasFromStore } from "../src/muthur/atlas/atlas-store";
import { getMemory, resetMemory } from "../src/muthur/memory/core";
import { writeMemoryRetrievalReceipt } from "../src/muthur/memory/retrieval-receipts";

const TEST_ROOT = path.join(process.cwd(), ".tmp", `muthur-phase1-${Date.now()}`);
const TEST_DB = path.join(TEST_ROOT, "memory", "muthur-memory.db");

function cleanup(): void {
  resetMemory();
  resetAtlas();
  if (existsSync(TEST_ROOT)) {
    rmSync(TEST_ROOT, { recursive: true, force: true });
  }
}

async function setup(): Promise<void> {
  cleanup();
  process.env.MUTHUR_MEMORY_DB_PATH = TEST_DB;
  await bootMuthur({ workspaceRoot: TEST_ROOT });
}

async function testSaveAndKeywordRetrieve(): Promise<void> {
  const memory = getMemory();
  await memory.ready();
  const marker = "phase1-unique-keyword-zephyr-7742";
  const id = memory.add("note", `Operator doctrine includes ${marker} for recall verification.`, {
    source: "phase1_probe",
  });
  assert.ok(id && id > 0, "expected memory row id");
  memory.flush();

  const hits = memory.query_similar(marker, 5);
  assert.ok(hits.some((row) => row.text.includes(marker)), "keyword retrieve failed");
  console.log("  ok save + keyword retrieve");
}

async function testSemanticishRetrieve(): Promise<void> {
  const memory = getMemory();
  await memory.ready();
  memory.add("note", "The omnissiah calibration ritual uses amber telemetry buffers.", {
    source: "phase1_probe",
  });
  memory.flush();

  const hits = memory.query_similar("amber telemetry calibration", 5);
  assert.ok(hits.length > 0, "expected semantic-ish hits");
  assert.ok((hits[0].score ?? 0) > 0, "expected non-zero score");
  console.log("  ok semantic-ish retrieve");
}

async function testShipMemoryWithClientContext(): Promise<void> {
  const client = "Session memory (browser): operator prefers concise answers.";
  const server = await buildMemoryContext("phase1-unique-keyword-zephyr-7742", {
    clientContext: client,
    workspaceRoot: TEST_ROOT,
  });
  const prompt = buildMemoryPrompt(client, server);
  assert.match(prompt, /Session memory \(browser\)/);
  assert.match(prompt, /Ship memory \(atlas \+ SQLite\)/);
  assert.match(prompt, /phase1-unique-keyword-zephyr-7742/);
  console.log("  ok merged client + ship memory prompt");
}

async function testAtlasPersistence(): Promise<void> {
  const atlas = getAtlas();
  const before = atlas.getEntities().length;
  assert.ok(before >= 7, `expected seeded entities, got ${before}`);

  const probeId = "concept:phase1-probe";
  atlas.ensureEntity(probeId, "concept", "Phase1 Probe", "Atlas persistence verification entity.");
  getMemory().flush();

  resetAtlas();
  resetMemory();
  process.env.MUTHUR_MEMORY_DB_PATH = TEST_DB;

  const memory = getMemory();
  await memory.ready();
  const reloaded = getAtlas();
  const loaded = await loadAtlasFromStore(reloaded, memory);
  assert.ok(loaded >= before, `expected atlas reload count >= ${before}, got ${loaded}`);
  assert.ok(
    reloaded.getEntities().some((entity) => entity.id === probeId),
    "expected probe entity after reload"
  );
  console.log("  ok atlas persistence across reload");
}

async function testRetrievalReceipt(): Promise<void> {
  const memory = getMemory();
  await memory.ready();
  const hits = memory.query_similar("phase1-unique-keyword-zephyr-7742", 3);
  const receiptPath = writeMemoryRetrievalReceipt({
    query: "phase1 receipt probe",
    shipResults: hits,
    clientContext: "client receipt line",
    workspaceRoot: TEST_ROOT,
  });
  assert.ok(existsSync(receiptPath), "receipt file missing");
  const parsed = JSON.parse(readFileSync(receiptPath, "utf-8")) as {
    selected: Array<{ source_type: string }>;
  };
  assert.ok(parsed.selected.some((item) => item.source_type === "ship_memory"));
  assert.ok(parsed.selected.some((item) => item.source_type === "client_context"));
  console.log(`  ok retrieval receipt at ${receiptPath}`);
}

async function main(): Promise<void> {
  console.log("probe:muthur-memory-phase1");
  try {
    await setup();
    await testSaveAndKeywordRetrieve();
    await testSemanticishRetrieve();
    await testShipMemoryWithClientContext();
    await testAtlasPersistence();
    await testRetrievalReceipt();
    console.log("probe:muthur-memory-phase1 PASS");
  } finally {
    cleanup();
    delete process.env.MUTHUR_MEMORY_DB_PATH;
  }
}

main().catch((err) => {
  console.error(err);
  cleanup();
  process.exit(1);
});
