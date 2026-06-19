import assert from "node:assert/strict";
import { getMuthurCommanderPosture } from "../src/lib/muthur/mission/muthur-commander-posture";
import { createMuthurMission } from "../src/lib/muthur/mission/muthur-mission-store";
import {
  activateMission,
  setMissionReady,
} from "../src/lib/muthur/mission/muthur-mission-lifecycle";
import { blockMission } from "../src/lib/muthur/mission/muthur-mission-lifecycle";
import { setMissionVerifying } from "../src/lib/muthur/mission/muthur-mission-lifecycle";

function main() {
  assert.equal(getMuthurCommanderPosture("agent", null), null);
  assert.equal(getMuthurCommanderPosture("commander", null), "AWAITING_MISSION");

  const draft = createMuthurMission({ title: "T", objective: "O" });
  assert.equal(getMuthurCommanderPosture("commander", draft), "PREPARING");

  const ready = setMissionReady(draft).mission;
  assert.equal(getMuthurCommanderPosture("commander", ready), "PREPARING");

  const active = activateMission(ready).mission;
  assert.equal(getMuthurCommanderPosture("commander", active), "EXECUTING");

  const blocked = blockMission(active, "Awaiting worker result").mission;
  assert.equal(getMuthurCommanderPosture("commander", blocked), "WAITING");

  const verifying = setMissionVerifying(blocked).mission;
  assert.equal(getMuthurCommanderPosture("commander", verifying), "VERIFYING");

  console.log("probe-muthur-commander-posture: PASS");
}

main();
