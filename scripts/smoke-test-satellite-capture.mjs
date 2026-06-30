#!/usr/bin/env node
/** CI smoke test — primary monitor capture must return non-zero dimensions. */
import { captureViaNodeScreenshots } from "../apps/echo-satellite-electron/electron/capture.mjs";

try {
  const capture = await captureViaNodeScreenshots();
  if (!capture.width || !capture.height) {
    throw new Error(`Capture size is ${capture.width}x${capture.height}`);
  }
  if (capture.pngBase64.length < 500) {
    throw new Error(`Capture payload too small (${capture.pngBase64.length} b64 chars)`);
  }
  console.log(
    `PASS satellite capture smoke test: ${capture.width}x${capture.height}, ~${capture.pngBase64.length} b64 chars`,
  );
} catch (error) {
  console.error("FAIL satellite capture smoke test:", error instanceof Error ? error.message : error);
  process.exit(1);
}
