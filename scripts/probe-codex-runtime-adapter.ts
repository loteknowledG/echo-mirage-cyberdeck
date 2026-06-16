/**
 * L-CADRE-002 Codex Runtime Adapter probes.
 * Run: pnpm probe:codex-runtime-adapter
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { cadreAdapterForType } from "../src/lib/cadre/runtime-registry";
import {
  buildCodexSpawnSpec,
  CODEX_ADAPTER_ID,
  CODEX_STUB_MARKER,
  isCodexAdapterOutput,
  isCodexCliAvailable,
} from "../src/lib/server/cadre/adapters/codex-runtime-adapter.server";
import {
  getCadreRuntimeManager,
  resetCadreRuntimeManagerForTests,
} from "../src/lib/server/cadre-runtime-manager.server";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "src");

const FORBIDDEN_CLIENT_IMPORTS = [
  "codex-runtime-adapter.server",
  "cadre-runtime-manager.server",
  "node-pty",
  "node:child_process",
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

function testRegistryAdapterRouting(): void {
  assert.equal(cadreAdapterForType("codex"), CODEX_ADAPTER_ID);
  assert.equal(cadreAdapterForType("cursor"), "stub-host");
  const spec = buildCodexSpawnSpec(ROOT);
  assert.ok(spec.file);
  assert.ok(spec.args.includes("--no-alt-screen"));
  assert.notEqual(spec.file, path.join(ROOT, "scripts", "cadre-runtime-host-stub.mjs"));
  console.log("  ok adapter routing A1");
}

function testClientBoundary(): void {
  const offenders: string[] = [];
  for (const root of CLIENT_SCAN_ROOTS) {
    for (const file of collectSourceFiles(root)) {
      const source = readFileSync(file, "utf8");
      if (source.includes('"use server"')) continue;
      for (const token of FORBIDDEN_CLIENT_IMPORTS) {
        if (source.includes(token)) offenders.push(`${path.relative(ROOT, file)} -> ${token}`);
      }
    }
  }
  assert.equal(offenders.length, 0, offenders.join("\n"));
  console.log("  ok client/server boundary A8");
}

async function waitForCodexOutput(
  manager: ReturnType<typeof getCadreRuntimeManager>,
  timeoutMs = 12_000,
): Promise<string> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const output = manager.getOutput("codex");
    if (output?.stdout && isCodexAdapterOutput(output.stdout)) {
      return output.stdout;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Timed out waiting for Codex adapter output");
}

async function testCodexLifecycle(): Promise<void> {
  if (!isCodexCliAvailable()) {
    console.log("  skip codex lifecycle — Codex CLI not on PATH");
    return;
  }

  resetCadreRuntimeManagerForTests();
  const manager = getCadreRuntimeManager();

  const started = await manager.startRuntime("codex");
  assert.equal(started.status, "running");
  assert.equal(started.adapter, CODEX_ADAPTER_ID);
  assert.ok(started.pid && started.pid > 0);
  assert.ok(started.startedAt);

  const stdout = await waitForCodexOutput(manager);
  assert.doesNotMatch(stdout, new RegExp(CODEX_STUB_MARKER));
  assert.ok(isCodexAdapterOutput(stdout), `unexpected codex output: ${stdout.slice(0, 200)}`);

  const listed = manager.listRuntimes().find((entry) => entry.id === "codex");
  assert.equal(listed?.status, "running");
  assert.equal(listed?.adapter, CODEX_ADAPTER_ID);

  const stopped = await manager.stopRuntime("codex");
  assert.ok(stopped);
  assert.equal(stopped!.status, "stopped");
  assert.equal(stopped!.pid, null);

  const restarted = await manager.restartRuntime("codex");
  assert.ok(restarted);
  assert.equal(restarted!.status, "running");
  const restartOutput = await waitForCodexOutput(manager);
  assert.ok(isCodexAdapterOutput(restartOutput));

  const managerB = getCadreRuntimeManager();
  assert.equal(managerB.getRuntime("codex")?.status, "running");

  await managerB.stopRuntime("codex");
  console.log("  ok codex lifecycle A2–A7");
}

async function main(): Promise<void> {
  console.log("probe:codex-runtime-adapter");
  testRegistryAdapterRouting();
  testClientBoundary();
  await testCodexLifecycle();
  resetCadreRuntimeManagerForTests();
  console.log("probe:codex-runtime-adapter PASS");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
