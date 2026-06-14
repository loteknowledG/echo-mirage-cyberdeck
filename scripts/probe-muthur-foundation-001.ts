/**
 * L-MEM-004 Foundation-001 preservation probes.
 * Run: pnpm probe:muthur-foundation-001
 */
import assert from "node:assert/strict";
import { existsSync } from "fs";
import path from "path";

import { parseFoundationQuery } from "../src/lib/muthur-foundation-intent";
import { buildFoundationResponse } from "../src/lib/server/muthur-foundation-retrieval.server";
import {
  foundationManifestPath,
  getFoundationById,
  loadFoundationManifest,
  readFoundationArtifactText,
  resolveFoundationArtifactPath,
  verifyFoundationIntegrity,
} from "../src/muthur/foundations/foundation-store";

const ROOT = process.cwd();
const EXPECTED_SHA256 = "42108fbce060426f04c55715009a8d23d30ea5cb7bcf4d23b7843450e5e15e69";

async function main(): Promise<void> {
  console.log("probe:muthur-foundation-001");

  assert.ok(existsSync(path.join(ROOT, ".muthur", "foundations")), "D1: foundation archive missing");
  assert.ok(existsSync(foundationManifestPath(ROOT)), "D2: foundation-manifest.json missing");

  const entry = getFoundationById("foundation-001", ROOT);
  assert.ok(entry, "D2: foundation-001 not registered");
  assert.equal(entry?.name, "lets-remember-something-ai");
  assert.equal(entry?.classification, "FOUNDATION");
  assert.equal(entry?.immutable, true);

  const artifactPath = resolveFoundationArtifactPath(entry!, ROOT);
  assert.ok(existsSync(artifactPath), "D3: preserved artifact file missing");

  const integrity = verifyFoundationIntegrity("foundation-001", ROOT);
  assert.equal(integrity.ok, true, "SHA256 integrity failed");
  assert.equal(integrity.actualSha256, EXPECTED_SHA256);

  const manifest = loadFoundationManifest(ROOT);
  assert.ok(manifest.foundations.length >= 1);

  assert.ok(parseFoundationQuery("Where did you come from?"));
  assert.ok(parseFoundationQuery("What is Foundation-001?"));
  assert.ok(parseFoundationQuery("Tell me about lets-remember-something-ai."));

  const meta = await buildFoundationResponse({ kind: "foundation_meta", id: "foundation-001" }, ROOT);
  assert.match(meta, /foundation-001/i);
  assert.match(meta, /FOUNDATION/);

  const excerpt = await buildFoundationResponse(
    { kind: "artifact_excerpt", id: "foundation-001" },
    ROOT,
  );
  assert.match(excerpt, /VERBATIM EXCERPT/);
  assert.match(excerpt, /like hey let/i);

  const { text } = await readFoundationArtifactText("foundation-001", ROOT);
  assert.ok(text.length > 100_000, "artifact content unexpectedly short");

  console.log("  ok archive + manifest + artifact + integrity");
  console.log("  ok foundation retrieval intents");
  console.log("probe:muthur-foundation-001 PASS");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
