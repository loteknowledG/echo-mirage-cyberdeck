import assert from "node:assert/strict";
import {
  countActiveAmbientLamps,
  createAmbientTwinkleLamps,
  createSectorAmbientLamps,
} from "../src/lib/cyberdeck/ambient-twinkle/ambient-twinkle-engine";
import {
  getAmbientTwinklePreset,
  getMuthurConsoleSectors,
} from "../src/lib/cyberdeck/ambient-twinkle/ambient-twinkle-presets";

function main() {
  const preset = getAmbientTwinklePreset("command-surface");
  const lamps = createAmbientTwinkleLamps({ preset: "command-surface" });

  assert.equal(lamps.length, preset.lampCount);
  assert.ok(lamps.every((lamp) => lamp.peakOpacity >= lamp.idleOpacity));
  assert.ok(lamps.every((lamp) => lamp.periodMs >= 6000 && lamp.periodMs <= 18000));
  assert.ok(lamps.every((lamp) => lamp.sparkleMs >= 100 && lamp.sparkleMs <= 250));

  const activeCount = countActiveAmbientLamps(lamps);
  const activeRatio = activeCount / lamps.length;
  assert.ok(activeRatio >= 0.28 && activeRatio <= 0.42);

  const activeLamps = lamps.filter((lamp) => lamp.active);
  assert.ok(activeLamps.every((lamp) => lamp.peakOpacity >= 0.55));

  const compact = createAmbientTwinkleLamps({ preset: "compact", seedOffset: 1 });
  assert.equal(compact.length, getAmbientTwinklePreset("compact").lampCount);
  assert.notDeepEqual(
    lamps.map((l) => l.peakOpacity),
    compact.map((l) => l.peakOpacity),
  );

  const sectors = getMuthurConsoleSectors();
  const consoleLamps = createSectorAmbientLamps({ sectors, seed: 6002 });
  assert.equal(consoleLamps.length, sectors.reduce((sum, sector) => sum + sector.lampCount, 0));
  assert.ok(consoleLamps.every((lamp) => lamp.sectorId != null));

  console.log(
    `[probe] command-surface lamps=${lamps.length} active=${activeCount} ratio=${activeRatio.toFixed(2)}`,
  );
  console.log(`[probe] muthur-console lamps=${consoleLamps.length} sectors=${sectors.length}`);
  console.log("probe-ambient-twinkle: PASS");
}

main();
