/**
 * Aion lineage recovery probes.
 * Run: pnpm probe:muthur-aion-recovery
 */
import assert from "node:assert/strict";
import { existsSync } from "fs";
import path from "path";

import { parseAionQuery } from "../src/lib/muthur-aion-intent";
import { buildAionResponse } from "../src/lib/server/muthur-aion-retrieval.server";
import { getMemory } from "../src/muthur/memory/core";
import { aionLineageDir, loadAionLineageManifest, verifyAionLineageIntegrity } from "../src/muthur/lineage/aion-store";

const ROOT = process.cwd();

async function main(): Promise<void> {
  console.log("probe:muthur-aion-recovery");

  const packDir = aionLineageDir(ROOT);
  assert.ok(existsSync(packDir), "Aion lineage pack missing — run pnpm recover:aion");

  const manifest = loadAionLineageManifest(ROOT);
  assert.ok(manifest, "lineage-manifest.json missing");
  assert.equal(manifest?.pack_id, "aion");
  assert.ok((manifest?.artifacts.length ?? 0) >= 10, "expected full Aion artifact set");

  const integrity = verifyAionLineageIntegrity(ROOT);
  assert.equal(integrity.ok, true, `integrity failed: ${integrity.failed.join(", ")}`);

  assert.ok(parseAionQuery("restore Aion"));
  assert.ok(parseAionQuery("recover aion into muthur"));
  assert.ok(parseAionQuery("who is Aion?"));

  const response = await buildAionResponse({ kind: "restore_aion" }, ROOT);
  assert.match(response, /AION LINEAGE/i);
  assert.match(response, /Codex collaborator/i);

  const memory = getMemory();
  await memory.ready();
  const rows = memory.all(500);
  assert.ok(
    rows.some((row) => row.type === "lineage_pack" && row.metadata?.pack === "aion"),
    "lineage_pack row missing from ship memory",
  );

  console.log("  ok pack + integrity + intent + retrieval + memory seed");
  console.log("probe:muthur-aion-recovery PASS");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
