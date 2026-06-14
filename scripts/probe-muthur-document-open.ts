/**
 * L-UI-001A-R2 document open intent + resolution probes.
 * Run: pnpm probe:muthur-document-open
 */
import assert from "node:assert/strict";
import { existsSync } from "fs";
import path from "path";

import {
  parseDocumentOpenIntent,
  parseOperatorObservationQuery,
} from "../src/lib/muthur-document-open-intent";
import { parseFoundationQuery } from "../src/lib/muthur-foundation-intent";
import {
  buildDocumentOpenResult,
  resolveDocumentReference,
} from "../src/lib/server/muthur-document-open.server";

const ROOT = process.cwd();

function testIntentClassification(): void {
  assert.deepEqual(parseDocumentOpenIntent("open L-ARCH-001.md"), {
    kind: "DOCUMENT_OPEN",
    verb: "open",
    target: "L-ARCH-001.md",
  });
  assert.deepEqual(parseDocumentOpenIntent("show operator-doc.md")?.target, "operator-doc.md");
  assert.equal(parseDocumentOpenIntent("what document is currently visible?"), null);
  assert.ok(parseOperatorObservationQuery("what document is currently visible?"));
  assert.ok(parseFoundationQuery("read foundation-001"));
  assert.equal(parseDocumentOpenIntent("read foundation-001"), null);
  console.log("  ok intent classification");
}

function testResolveLArch(): void {
  const resolution = resolveDocumentReference("L-ARCH-001.md", ROOT);
  assert.equal(resolution.status, "resolved");
  assert.ok(resolution.relativePath?.endsWith("L-ARCH-001.md"));
  assert.ok(existsSync(resolution.absolutePath!));
  console.log("  ok resolve L-ARCH-001.md");
}

function testSemanticResponse(): void {
  const resolution = resolveDocumentReference("L-ARCH-001.md", ROOT);
  const result = buildDocumentOpenResult({
    verb: "open",
    target: "L-ARCH-001.md",
    resolution,
    workspaceRoot: ROOT,
  });
  assert.match(result.response, /Capability Authority Doctrine/i);
  assert.match(result.response, /PURPOSE EXCERPT/);
  assert.equal(result.receipt.intent, "DOCUMENT_OPEN");
  assert.equal(result.receipt.resolved_file, resolution.relativePath);
  assert.ok(result.receipt.tool_chain.includes("resolve_document"));
  assert.ok(result.operatorOpen?.fileName === "L-ARCH-001.md");
  assert.doesNotMatch(result.response, /not currently open/i);
  console.log("  ok semantic document open response");
}

function testObservationNotDocumentOpen(): void {
  assert.equal(parseDocumentOpenIntent("describe the operator pane"), null);
  assert.ok(parseOperatorObservationQuery("describe the operator pane"));
  console.log("  ok observation vs document routing");
}

async function main(): Promise<void> {
  console.log("probe:muthur-document-open");
  testIntentClassification();
  testResolveLArch();
  testSemanticResponse();
  testObservationNotDocumentOpen();
  console.log("probe:muthur-document-open PASS");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
