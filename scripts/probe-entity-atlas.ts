/**
 * L-MEM-006 Entity & Relationship Atlas probes.
 * Run: pnpm probe:entity-atlas
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { parseEntityAtlasQuery } from "../src/lib/entity-atlas/entity-atlas-query";
import {
  buildEntityAtlasResponse,
  resetEntityAtlasCache,
} from "../src/lib/entity-atlas/entity-atlas-retrieval.server";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "src");

const FORBIDDEN_CLIENT_IMPORTS = [
  "entity-atlas-retrieval.server",
  "entity-atlas-index",
  "memory-atlas-index",
  "node:fs",
  'from "fs"',
  'from "path"',
  'from "node:path"',
];

const CLIENT_SCAN_ROOTS = [
  path.join(SRC, "features"),
  path.join(SRC, "components"),
  path.join(SRC, "lib", "entity-atlas", "entity-atlas-query.ts"),
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
  assert.equal(parseEntityAtlasQuery("What is related to L-FS-001?")?.kind, "relationship");
  assert.equal(parseEntityAtlasQuery("What governs workspace mutation?")?.kind, "governs");
  assert.equal(parseEntityAtlasQuery("What verifies folder creation?")?.kind, "verifies");
  assert.equal(parseEntityAtlasQuery("What depends on ADR-MEM-001?")?.kind, "depends_on");
  assert.equal(parseEntityAtlasQuery("What does L-FS-001 belong to?")?.kind, "belongs_to");
  assert.equal(parseEntityAtlasQuery("What work order created folder creation?"), null);
  assert.equal(parseEntityAtlasQuery("What are our active threads?"), null);
  console.log("  ok intent parsing");
}

function testAcceptanceRetrieval(): void {
  resetEntityAtlasCache();

  const verifies = buildEntityAtlasResponse(
    { kind: "verifies", subject: "folder creation" },
    ROOT,
  );
  assert.match(verifies.response, /JP-L-FS-001/);
  assert.equal(verifies.entity_type, "verifies");

  const governs = buildEntityAtlasResponse(
    { kind: "governs", subject: "workspace mutation" },
    ROOT,
  );
  assert.match(governs.response, /ADR-FS-001/);
  assert.equal(governs.entity_type, "governs");

  const relatedFs = buildEntityAtlasResponse(
    { kind: "relationship", subject: "L-FS-001" },
    ROOT,
  );
  assert.match(relatedFs.response, /L-FS-001/);
  assert.match(relatedFs.response, /JP-L-FS-001/);
  assert.match(relatedFs.response, /ADR-FS-001/);
  assert.match(relatedFs.response, /Workspace/);
  const relatedFsIds = (relatedFs.result.related as Array<{ id: string }>).map((entry) => entry.id);
  assert.ok(relatedFsIds.includes("L-FS-001"));
  assert.ok(relatedFsIds.includes("JP-L-FS-001"));
  assert.ok(relatedFsIds.includes("ADR-FS-001"));
  assert.ok(relatedFsIds.includes("Workspace"));

  const relatedConn = buildEntityAtlasResponse(
    { kind: "relationship", subject: "provider authentication" },
    ROOT,
  );
  assert.match(relatedConn.response, /L-CONN-001/);
  assert.match(relatedConn.response, /JP-L-CONN-001/);
  assert.match(relatedConn.response, /ADR-CONN-001/);
  assert.match(relatedConn.response, /OpenRouter/);

  console.log("  ok acceptance retrieval A1–A4");
}

function testClientBoundary(): void {
  const files = new Set<string>();
  for (const root of CLIENT_SCAN_ROOTS) {
    collectSourceFiles(root, []).forEach((file) => files.add(file));
  }

  const violations: string[] = [];
  for (const file of files) {
    if (file.includes("entity-atlas-index") || file.includes("entity-atlas-retrieval")) continue;
    const source = readFileSync(file, "utf8");
    for (const forbidden of FORBIDDEN_CLIENT_IMPORTS) {
      if (source.includes(forbidden)) {
        violations.push(`${path.relative(ROOT, file)} contains "${forbidden}"`);
      }
    }
  }

  const cyberdeck = readFileSync(path.join(SRC, "features", "cyberdeck", "cyberdeck-app.tsx"), "utf8");
  assert.match(cyberdeck, /parseEntityAtlasQuery/);
  assert.match(cyberdeck, /\/api\/muthur\/entity-query/);
  assert.doesNotMatch(cyberdeck, /entity-atlas-retrieval\.server/);
  assert.doesNotMatch(cyberdeck, /buildEntityAtlasResponse/);

  const querySource = readFileSync(
    path.join(SRC, "lib", "entity-atlas", "entity-atlas-query.ts"),
    "utf8",
  );
  assert.doesNotMatch(querySource, /from "fs"/);
  assert.doesNotMatch(querySource, /entity-atlas-retrieval/);

  if (violations.length > 0) {
    console.error("Boundary violations:");
    for (const violation of violations) console.error(`  - ${violation}`);
    process.exit(1);
  }

  console.log("  ok client boundary A6");
}

function main(): void {
  console.log("probe:entity-atlas");
  testIntentParsing();
  testAcceptanceRetrieval();
  testClientBoundary();
  console.log("probe:entity-atlas PASS");
}

main();
