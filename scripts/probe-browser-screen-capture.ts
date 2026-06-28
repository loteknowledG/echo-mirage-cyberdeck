/**
 * Browser screen capture helper probes (Node — no DOM).
 * Run: pnpm exec tsx scripts/probe-browser-screen-capture.ts
 */
import assert from "node:assert/strict";

import { isBrowserScreenCaptureSupported } from "../src/lib/cyberdeck/browser-screen-capture";

function testUnsupportedInNode(): void {
  assert.equal(isBrowserScreenCaptureSupported(), false);
  console.log("  ok isBrowserScreenCaptureSupported false without navigator");
}

function main(): void {
  console.log("probe-browser-screen-capture");
  testUnsupportedInNode();
  console.log("probe-browser-screen-capture PASS");
}

main();
