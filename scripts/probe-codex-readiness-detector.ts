/**
 * L-CADRE-003 Codex Runtime Readiness Detection probes.
 * Run: pnpm probe:codex-readiness-detector
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { defaultCadreRuntime } from "../src/lib/cadre/runtime-registry";
import { isCodexCliAvailable } from "../src/lib/server/cadre/adapters/codex-runtime-adapter.server";
import { detectCodexReadiness } from "../src/lib/server/cadre/codex-readiness-detector.server";
import {
  getCadreRuntimeManager,
  resetCadreRuntimeManagerForTests,
} from "../src/lib/server/cadre-runtime-manager.server";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "src");

const FORBIDDEN_INPUT_PATTERNS = [".write(", ".stdin.write", "pty.write", "sendInput", "injectInput"];

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

function testRuntimeModelHasReadiness(): void {
  const runtime = defaultCadreRuntime("codex");
  assert.equal(runtime.readiness, "stopped");
  assert.equal(runtime.readinessReason, "Not running");
  assert.equal(runtime.lastReadinessAt, null);
  console.log("  ok runtime model A1");
}

function testDetectorRules(): void {
  const starting = detectCodexReadiness({
    stdout: "[CADRE] spawning CODEX",
    stderr: "",
    status: "starting",
  });
  assert.equal(starting.readiness, "starting");

  const update = detectCodexReadiness({
    stdout: "Update available! 0.133.0 -> 0.139.0\nPress enter to continue",
    stderr: "",
    status: "running",
  });
  assert.equal(update.readiness, "blocked_update_prompt");
  assert.match(update.readinessReason, /update prompt/i);

  const auth = detectCodexReadiness({
    stdout: "Please run `codex login` to authenticate",
    stderr: "",
    status: "running",
  });
  assert.equal(auth.readiness, "blocked_auth");
  assert.match(auth.readinessReason, /login/i);

  const ready = detectCodexReadiness({
    stdout: "Ask Codex anything\n› ",
    stderr: "",
    status: "running",
  });
  assert.equal(ready.readiness, "ready");

  const stopped = detectCodexReadiness({
    stdout: "",
    stderr: "",
    status: "stopped",
  });
  assert.equal(stopped.readiness, "stopped");

  const errored = detectCodexReadiness({
    stdout: "Error: stdin is not a terminal",
    stderr: "",
    status: "running",
    exitCode: 1,
  });
  assert.equal(errored.readiness, "errored");

  console.log("  ok detector rules A2–A7");
}

function testNoInputInjection(): void {
  const scanRoots = [
    path.join(SRC, "lib", "server", "cadre"),
    path.join(SRC, "lib", "server", "cadre-runtime-manager.server.ts"),
    path.join(SRC, "components", "cyberdeck", "cadre-pane-body.tsx"),
    path.join(SRC, "lib", "cadre"),
  ];
  const offenders: string[] = [];
  for (const root of scanRoots) {
    for (const file of collectSourceFiles(root)) {
      const source = readFileSync(file, "utf8");
      for (const token of FORBIDDEN_INPUT_PATTERNS) {
        if (source.includes(token)) offenders.push(`${path.relative(ROOT, file)} -> ${token}`);
      }
    }
  }
  assert.equal(offenders.length, 0, offenders.join("\n"));
  console.log("  ok no keystroke injection A10");
}

async function waitForReadiness(
  manager: ReturnType<typeof getCadreRuntimeManager>,
  allowed: Set<string>,
  timeoutMs = 12_000,
) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const runtime = manager.getRuntime("codex");
    if (runtime && allowed.has(runtime.readiness)) return runtime;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  const runtime = manager.getRuntime("codex");
  throw new Error(`Timed out waiting for readiness in ${[...allowed].join(", ")}; got ${runtime?.readiness}`);
}

async function testLiveCodexReadiness(): Promise<void> {
  if (!isCodexCliAvailable()) {
    console.log("  skip live codex readiness — Codex CLI not on PATH");
    return;
  }

  resetCadreRuntimeManagerForTests();
  const manager = getCadreRuntimeManager();

  const started = await manager.startRuntime("codex");
  assert.ok(["starting", "unknown", "blocked_update_prompt", "blocked_auth", "ready"].includes(started.readiness));

  const running = await waitForReadiness(
    manager,
    new Set(["blocked_update_prompt", "blocked_auth", "ready", "unknown", "starting"]),
  );
  assert.equal(running.status, "running");
  assert.ok(running.readinessReason);
  assert.ok(running.lastReadinessAt);

  const listed = manager.listRuntimes().find((entry) => entry.id === "codex");
  assert.ok(listed?.readiness);
  assert.ok(listed?.readinessReason);

  const stopped = await manager.stopRuntime("codex");
  assert.equal(stopped?.readiness, "stopped");

  const managerB = getCadreRuntimeManager();
  assert.equal(managerB.getRuntime("codex")?.readiness, "stopped");
  console.log(`  ok live codex readiness (${running.readiness}) A8`);
}

async function main(): Promise<void> {
  console.log("probe:codex-readiness-detector");
  testRuntimeModelHasReadiness();
  testDetectorRules();
  testNoInputInjection();
  await testLiveCodexReadiness();
  resetCadreRuntimeManagerForTests();
  console.log("probe:codex-readiness-detector PASS");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
