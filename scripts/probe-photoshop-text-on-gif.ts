/**
 * Photoshop GIF caption probe.
 * Run: pnpm probe:photoshop-text-on-gif
 */
import assert from "node:assert/strict";

import { applyTextOnGifServer } from "../src/lib/server/photoshop-text-on-gif.server";

const MINIMAL_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64",
);

async function main(): Promise<void> {
  console.log("probe:photoshop-text-on-gif");
  const result = await applyTextOnGifServer({
    gifBuffer: MINIMAL_GIF,
    fileName: "probe.gif",
    text: "Echo Mirage",
    fontSize: "12px",
    fontColor: "#ffffff",
  });

  if (!result.ok) {
    throw new Error(result.error);
  }

  assert.ok(result.buffer.length > 100, "output gif too small");
  assert.match(result.fileName, /-caption\.gif$/);
  console.log(`  ok rendered ${result.fileName} (${result.buffer.length} bytes)`);
  console.log("probe:photoshop-text-on-gif PASS");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
