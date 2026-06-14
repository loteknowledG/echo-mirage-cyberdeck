/**
 * MUTHUR speech verbalization probes.
 * Run: pnpm probe:muthur-speech-text
 */
import assert from "node:assert/strict";

import {
  textForMuthurSpeech,
  verbalizeAsciiSeparatorLine,
} from "../src/lib/muthur-speech-text";

function testMixedSeparatorLine(): void {
  assert.equal(
    verbalizeAsciiSeparatorLine("+++++++++++++++-----------------"),
    "plus plus plus, dash dash dash",
  );
  assert.equal(
    textForMuthurSpeech("+++++++++++++++-----------------"),
    "plus plus plus, dash dash dash",
  );
  console.log("  ok mixed plus/dash separator");
}

function testDashOnlyRule(): void {
  assert.equal(verbalizeAsciiSeparatorLine("---"), "dash dash dash");
  console.log("  ok dash-only separator");
}

function testProseUnchanged(): void {
  assert.equal(verbalizeAsciiSeparatorLine("Opened L-ARCH-001.md"), null);
  assert.match(textForMuthurSpeech("Opened L-ARCH-001.md"), /L-ARCH-001/);
  console.log("  ok prose unchanged");
}

async function main(): Promise<void> {
  console.log("probe:muthur-speech-text");
  testMixedSeparatorLine();
  testDashOnlyRule();
  testProseUnchanged();
  console.log("probe:muthur-speech-text PASS");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
