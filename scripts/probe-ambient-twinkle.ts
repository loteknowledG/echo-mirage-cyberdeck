import assert from "node:assert/strict";
import { createAmbientTwinkleLamps } from "../src/lib/cyberdeck/ambient-twinkle/ambient-twinkle-engine";
import { getAmbientTwinklePreset } from "../src/lib/cyberdeck/ambient-twinkle/ambient-twinkle-presets";

function main() {
  const preset = getAmbientTwinklePreset("command-surface");
  const lamps = createAmbientTwinkleLamps({ preset: "command-surface" });

  assert.equal(lamps.length, preset.lampCount);
  assert.ok(lamps.every((lamp) => lamp.peakOpacity >= lamp.idleOpacity));
  assert.ok(lamps.every((lamp) => lamp.periodMs >= 7000 && lamp.periodMs <= 21000));

  const activeLamps = lamps.filter((lamp) => lamp.peakOpacity - lamp.idleOpacity > 0.15);
  const activeRatio = activeLamps.length / lamps.length;
  assert.ok(activeRatio > 0.1 && activeRatio < 0.35);

  const compact = createAmbientTwinkleLamps({ preset: "compact", seedOffset: 1 });
  assert.equal(compact.length, getAmbientTwinklePreset("compact").lampCount);
  assert.notDeepEqual(
    lamps.map((lamp) => lamp.peakOpacity),
    compact.map((lamp) => lamp.peakOpacity),
  );

  console.log(
    `[probe] command-surface lamps=${lamps.length} active=${activeLamps.length} ratio=${activeRatio.toFixed(2)}`,
  );
  console.log("probe-ambient-twinkle: PASS");
}

main();
