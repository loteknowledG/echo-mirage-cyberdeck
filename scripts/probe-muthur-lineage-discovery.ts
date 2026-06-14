/**
 * L-MEM-005 acceptance probe (discovery deliverables exist).
 * Run: pnpm probe:muthur-lineage-discovery
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "fs";
import path from "path";

const DOCS = path.join(process.cwd(), "docs", "memory-recovery");

function mustExist(rel: string): void {
  const full = path.join(DOCS, rel);
  assert.ok(existsSync(full), `missing: ${rel}`);
}

function main(): void {
  console.log("probe:muthur-lineage-discovery");

  mustExist("lineage-inventory.md");
  mustExist("top-100-continuity-artifacts.md");
  mustExist("daemon-artifacts.md");
  mustExist("continuity-manifest.json");
  mustExist("muthur-lineage-transplant-plan.md");

  const manifest = JSON.parse(
    readFileSync(path.join(DOCS, "continuity-manifest.json"), "utf8"),
  ) as {
    artifact_count: number;
    artifacts: Array<{ classification: string; continuity_score: number }>;
  };

  assert.ok(manifest.artifact_count >= 50, "manifest too small");
  assert.ok(
    manifest.artifacts.some((entry) => entry.classification === "Foundation"),
    "missing Foundation class",
  );
  assert.ok(
    manifest.artifacts.filter((entry) => entry.continuity_score >= 90).length >= 5,
    "expected high-score continuity artifacts",
  );

  const top100 = readFileSync(path.join(DOCS, "top-100-continuity-artifacts.md"), "utf8");
  const headings = top100.match(/^## \d+\./gm) ?? [];
  assert.ok(headings.length >= 100, `top-100 doc has ${headings.length} entries`);

  console.log("  ok deliverables present");
  console.log(`  ok manifest entries: ${manifest.artifact_count}`);
  console.log(`  ok top-100 entries: ${headings.length}`);
  console.log("probe:muthur-lineage-discovery PASS");
}

main();
