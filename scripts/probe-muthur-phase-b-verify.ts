import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import { recordCodingTouch } from "../src/lib/muthur-core/coding-touch";
import { runCodingVerify } from "../src/lib/muthur-core/coding-verify.server";
import {
  appendMuthurStreamFooters,
  splitMuthurStreamPayload,
} from "../src/lib/muthur-core/muthur-stream-payload";
import { createMuthurToolExecutionContext } from "../src/lib/muthur-core/types";

async function main() {
  const ctx = createMuthurToolExecutionContext();
  recordCodingTouch(
    ctx,
    "localfs",
    { action: "write", path: "src/lib/muthur-core/loop.ts" },
    { path: "src/lib/muthur-core/loop.ts" },
  );
  assert.equal(ctx.codingTouches.length, 1);
  assert.equal(ctx.codingTouches[0], "src/lib/muthur-core/loop.ts");

  recordCodingTouch(ctx, "localfs", { action: "read", path: "package.json" }, { path: "package.json" });
  assert.equal(ctx.codingTouches.length, 1, "read-only localfs must not touch");

  console.log("[probe] running coding verify (tsc may take a moment)…");
  const receipt = await runCodingVerify(ctx.codingTouches);
  assert.ok(receipt.timestamp);
  assert.equal(typeof receipt.tsc_exit_code, "number");
  assert.ok(receipt.receipt_path);
  await fs.access(receipt.receipt_path);

  const footered = appendMuthurStreamFooters("Phase B ok.", ["localfs"], [], null, null, receipt);
  const split = splitMuthurStreamPayload(footered);
  assert.equal(split.displayText, "Phase B ok.");
  assert.equal(split.codingVerify?.passed, receipt.passed);
  assert.deepEqual(split.codingVerify?.touched_paths, receipt.touched_paths);

  console.log(`[probe] verify passed=${receipt.passed} tsc_exit=${receipt.tsc_exit_code}`);
  console.log("probe-muthur-phase-b-verify: PASS");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
