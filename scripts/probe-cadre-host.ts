/**
 * L-CADRE-001 Terminal Host Framework probes.
 * Run: pnpm probe:cadre-host
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { CADRE_RUNTIME_SLOTS, defaultCadreRuntime } from "../src/lib/cadre/runtime-registry";
import {
  cadreHostReadyMessage,
  getCadreRuntimeManager,
  resetCadreRuntimeManagerForTests,
} from "../src/lib/server/cadre-runtime-manager.server";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "src");

const FORBIDDEN_CLIENT_IMPORTS = [
  "cadre-runtime-manager.server",
  "cadre-stream-hub.server",
  "node:child_process",
  'from "fs"',
  'from "path"',
  'from "node:path"',
];

const CLIENT_SCAN_ROOTS = [
  path.join(SRC, "features"),
  path.join(SRC, "components"),
  path.join(SRC, "lib", "cadre"),
];

function collectSourceFiles(dir: string, out: string[] = []): string[] {
  if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) {
    if (/\.(ts|tsx)$/.test(dir)) out.push(dir);
    return out;
  }
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) collectSourceFiles(full, out);
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

function testInitialState(): void {
  resetCadreRuntimeManagerForTests();
  const manager = getCadreRuntimeManager();
  const runtimes = manager.listRuntimes();
  assert.equal(runtimes.length, CADRE_RUNTIME_SLOTS.length);
  for (const runtime of runtimes) {
    assert.equal(runtime.status, "stopped");
    assert.equal(runtime.pid, null);
    assert.equal(runtime.startedAt, null);
  }
  assert.equal(cadreHostReadyMessage(), "CADRE HOST READY");
  console.log("  ok initial state A6/A7");
}

async function testStartStopObserve(): Promise<void> {
  resetCadreRuntimeManagerForTests();
  const manager = getCadreRuntimeManager();

  const started = await manager.startRuntime("cursor");
  assert.equal(started.status, "running");
  assert.equal(started.adapter, "stub-host");
  assert.ok(started.pid && started.pid > 0);
  assert.ok(started.startedAt);

  await new Promise((resolve) => setTimeout(resolve, 300));
  const output = manager.getOutput("cursor");
  assert.ok(output, "expected output bucket");
  assert.match(output!.stdout, /CADRE HOST STUB ONLINE/);
  assert.equal(output!.status, "running");

  const stopped = await manager.stopRuntime("cursor");
  assert.ok(stopped);
  assert.equal(stopped!.status, "stopped");
  assert.equal(stopped!.pid, null);

  console.log("  ok stub start/stop/output");
}

async function testRegistrySurvivesManagerAccess(): Promise<void> {
  resetCadreRuntimeManagerForTests();
  const managerA = getCadreRuntimeManager();
  await managerA.startRuntime("cursor");
  const managerB = getCadreRuntimeManager();
  const cursor = managerB.getRuntime("cursor");
  assert.ok(cursor);
  assert.equal(cursor!.status, "running");
  await managerB.stopRuntime("cursor");
  console.log("  ok registry singleton A5");
}

function testRuntimeRegistrySlots(): void {
  for (const slot of CADRE_RUNTIME_SLOTS) {
    const runtime = defaultCadreRuntime(slot.terminalType);
    assert.equal(runtime.id, slot.id);
    assert.equal(runtime.name, slot.name);
    assert.equal(runtime.terminalType, slot.terminalType);
  }
  console.log("  ok runtime registry slots");
}

function testClientBoundary(): void {
  const offenders: string[] = [];
  for (const root of CLIENT_SCAN_ROOTS) {
    for (const file of collectSourceFiles(root)) {
      if (file.includes("cadre-runtime-manager.server") || file.includes("cadre-stream-hub.server")) {
        continue;
      }
      const source = readFileSync(file, "utf8");
      if (source.includes('"use server"')) continue;
      for (const token of FORBIDDEN_CLIENT_IMPORTS) {
        if (source.includes(token)) {
          offenders.push(`${path.relative(ROOT, file)} -> ${token}`);
        }
      }
    }
  }
  assert.equal(offenders.length, 0, offenders.join("\n"));
  console.log("  ok client/server boundary");
}

async function main(): Promise<void> {
  console.log("probe:cadre-host");
  testInitialState();
  testRuntimeRegistrySlots();
  testClientBoundary();
  await testStartStopObserve();
  await testRegistrySurvivesManagerAccess();
  resetCadreRuntimeManagerForTests();
  console.log("probe:cadre-host PASS");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
