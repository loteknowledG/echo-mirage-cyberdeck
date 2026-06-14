/**
 * L-MEM-005 Memory Atlas Retrieval Pipeline probes.
 * Run: pnpm probe:memory-atlas
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { parseMemoryAtlasQuery } from "../src/lib/memory-atlas/memory-atlas-query";
import {
  buildMemoryAtlasIndex,
  findBestWorkOrder,
} from "../src/lib/memory-atlas/memory-atlas-index";
import {
  buildMemoryAtlasResponse,
  resetMemoryAtlasIndexCache,
} from "../src/lib/memory-atlas/memory-atlas-retrieval.server";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "src");

const FORBIDDEN_CLIENT_IMPORTS = [
  "memory-atlas-retrieval.server",
  "memory-atlas-index",
  "node:fs",
  'from "fs"',
  'from "path"',
  'from "node:path"',
];

const CLIENT_SCAN_ROOTS = [
  path.join(SRC, "features"),
  path.join(SRC, "components"),
  path.join(SRC, "lib", "memory-atlas", "memory-atlas-query.ts"),
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

function testIntentParsing(): void {
  assert.equal(parseMemoryAtlasQuery("What work order created folder creation?")?.kind, "work_order");
  assert.equal(parseMemoryAtlasQuery("What verified provider authentication?")?.kind, "verification");
  assert.equal(parseMemoryAtlasQuery("What ADR decided provider authentication?")?.kind, "adr");
  assert.equal(parseMemoryAtlasQuery("Why does provider authentication work this way?")?.kind, "adr");
  assert.equal(parseMemoryAtlasQuery("What are our active threads?")?.kind, "active_threads");
  assert.equal(parseMemoryAtlasQuery("What are our unfinished memory tasks?")?.kind, "unfinished_threads");
  assert.equal(parseMemoryAtlasQuery("open L-ARCH-001.md"), null);
  assert.equal(parseMemoryAtlasQuery("Where did you come from?"), null);
  console.log("  ok intent parsing");
}

function testAcceptanceRetrieval(): void {
  resetMemoryAtlasIndexCache();
  const index = buildMemoryAtlasIndex(ROOT);

  const wo = buildMemoryAtlasResponse(
    { kind: "work_order", topic: "folder creation" },
    ROOT,
  );
  assert.match(wo.response, /L-FS-001/);
  assert.equal(wo.result.id, "L-FS-001");

  const verification = buildMemoryAtlasResponse(
    { kind: "verification", topic: "provider authentication" },
    ROOT,
  );
  assert.match(verification.response, /JP-L-CONN-001/);

  const adr = buildMemoryAtlasResponse(
    { kind: "adr", topic: "provider authentication" },
    ROOT,
  );
  assert.match(adr.response, /ADR-CONN-001/);
  assert.match(adr.response, /provider credential/i);

  const threads = buildMemoryAtlasResponse({ kind: "active_threads" }, ROOT);
  assert.match(threads.response, /L-MEM-005/);
  assert.match(threads.response, /L-MEM-006/);
  assert.match(threads.response, /L-MEM-007/);

  const best = findBestWorkOrder(index, "folder creation");
  assert.equal(best?.id, "L-FS-001");
  console.log("  ok acceptance retrieval A1–A4");
}

function testClientBoundary(): void {
  const files = new Set<string>();
  for (const root of CLIENT_SCAN_ROOTS) {
    collectSourceFiles(root, []).forEach((file) => files.add(file));
  }

  const violations: string[] = [];
  for (const file of files) {
    if (file.includes("memory-atlas-index") || file.includes("memory-atlas-retrieval")) continue;
    const source = readFileSync(file, "utf8");
    for (const forbidden of FORBIDDEN_CLIENT_IMPORTS) {
      if (source.includes(forbidden)) {
        violations.push(`${path.relative(ROOT, file)} contains "${forbidden}"`);
      }
    }
  }

  const cyberdeck = readFileSync(path.join(SRC, "features", "cyberdeck", "cyberdeck-app.tsx"), "utf8");
  assert.match(cyberdeck, /parseMemoryAtlasQuery/);
  assert.match(cyberdeck, /\/api\/muthur\/memory-query/);
  assert.doesNotMatch(cyberdeck, /memory-atlas-retrieval\.server/);
  assert.doesNotMatch(cyberdeck, /buildMemoryAtlasResponse/);

  const querySource = readFileSync(
    path.join(SRC, "lib", "memory-atlas", "memory-atlas-query.ts"),
    "utf8",
  );
  assert.doesNotMatch(querySource, /from "fs"/);
  assert.doesNotMatch(querySource, /from "path"/);
  assert.doesNotMatch(querySource, /memory-atlas-retrieval/);

  if (violations.length > 0) {
    console.error("Boundary violations:");
    for (const violation of violations) console.error(`  - ${violation}`);
    process.exit(1);
  }

  console.log("  ok client boundary A5");
}

function main(): void {
  console.log("probe:memory-atlas");
  testIntentParsing();
  testAcceptanceRetrieval();
  testClientBoundary();
  console.log("probe:memory-atlas PASS");
}

main();
