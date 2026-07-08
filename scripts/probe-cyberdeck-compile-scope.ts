/**
 * L-CYBERDECK-001 P0 — compile-scope ratchet for cyberdeck-app monolith.
 *   pnpm probe:cyberdeck-compile-scope
 *
 * Tighten MAX_* constants as extraction phases land (see work order).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = process.cwd();

/** P0 baseline (2026-06). Lower in P1/P2 PRs per L-CYBERDECK-001. */
const MAX_CYBERDECK_APP_LINES = 7_066;
const MAX_CYBERDECK_APP_IMPORTS = 152;

/** Heavy pane modules must stay behind pane-chunks / dynamic(), not cyberdeck-app. */
const FORBIDDEN_STATIC_IMPORTS = [
  "operator-pane-body",
  "glyph-channel-pane-body",
  "photoshop-pane-body",
  "db8-pane-body",
  "tunes-pane-body",
  "cadre-pane-body",
  "pane-loaders/",
  "@monaco-editor",
  "xterm",
  "voice-flow-panel",
] as const;

function read(relativePath: string): string {
  return readFileSync(resolve(ROOT, relativePath), "utf8");
}

function countLines(source: string): number {
  if (source.length === 0) return 0;
  return source.split(/\r?\n/).length;
}

function countImportLines(source: string): number {
  return source.split(/\r?\n/).filter((line) => /^import\s/.test(line)).length;
}

function assertNoStaticImport(source: string, moduleId: string, fileLabel: string): void {
  const staticImport = new RegExp(`^import\\s+.+from\\s+["'][^"']*${escapeRegExp(moduleId)}`, "m");
  const staticSideEffect = new RegExp(`^import\\s+["'][^"']*${escapeRegExp(moduleId)}`, "m");
  assert.ok(
    !staticImport.test(source) && !staticSideEffect.test(source),
    `${fileLabel} must not statically import ${moduleId} (use pane-chunks / dynamic)`,
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function main(): void {
  const appPath = "src/features/cyberdeck/cyberdeck-app.tsx";
  const pageClientPath = "src/app/cyberdeck/cyberdeck-page-client.tsx";
  const paneChunksPath = "src/features/cyberdeck/pane-chunks.ts";

  const cyberdeckApp = read(appPath);
  const pageClient = read(pageClientPath);
  const paneChunks = read(paneChunksPath);

  const lineCount = countLines(cyberdeckApp);
  const importCount = countImportLines(cyberdeckApp);

  assert.ok(
    lineCount <= MAX_CYBERDECK_APP_LINES,
    `${appPath} has ${lineCount} lines (max ${MAX_CYBERDECK_APP_LINES}) — tighten ceiling after extraction PR`,
  );
  assert.ok(
    importCount <= MAX_CYBERDECK_APP_IMPORTS,
    `${appPath} has ${importCount} import lines (max ${MAX_CYBERDECK_APP_IMPORTS})`,
  );

  for (const forbidden of FORBIDDEN_STATIC_IMPORTS) {
    assertNoStaticImport(cyberdeckApp, forbidden, "cyberdeck-app");
  }

  assert.ok(
    pageClient.includes('dynamic(() => import("@/features/cyberdeck/cyberdeck-app")'),
    "cyberdeck-page-client must dynamic-import cyberdeck-app with ssr:false",
  );
  assert.ok(pageClient.includes("ssr: false"), "cyberdeck-page-client must disable SSR for cyberdeck-app");

  assert.ok(
    paneChunks.includes("() => import(") && paneChunks.includes("pane-loaders"),
    "pane-chunks must use dynamic import() per pane loader",
  );

  assert.ok(
    cyberdeckApp.includes('import("@/features/cyberdeck/pane-chunks")'),
    "cyberdeck-app should load pane-chunks via dynamic import (not static)",
  );
  assertNoStaticImport(cyberdeckApp, "pane-chunks", "cyberdeck-app");

  const dynamicImportCount = (cyberdeckApp.match(/^const\s+\w+\s*=\s*dynamic\(/gm) ?? []).length;
  assert.ok(dynamicImportCount >= 3, `cyberdeck-app should keep heavy widgets dynamic (found ${dynamicImportCount})`);

  console.log("probe-cyberdeck-compile-scope: all checks passed");
  console.log(`  ${appPath}: ${lineCount} lines, ${importCount} imports`);
  console.log(`  ceilings: ${MAX_CYBERDECK_APP_LINES} lines, ${MAX_CYBERDECK_APP_IMPORTS} imports`);
  console.log(`  dynamic() declarations in app: ${dynamicImportCount}`);
}

main();
