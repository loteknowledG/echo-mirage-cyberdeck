import assert from "node:assert/strict";
import {
  activateMission,
  blockMission,
  canTransitionMissionStatus,
  completeMission,
  setMissionReady,
  setMissionVerifying,
} from "../src/lib/muthur/mission/muthur-mission-lifecycle";
import { createMuthurMission } from "../src/lib/muthur/mission/muthur-mission-store";

function main() {
  const draft = createMuthurMission({
    title: "Lifecycle probe",
    objective: "Validate mission transitions.",
  });
  assert.equal(draft.status, "draft");

  assert.equal(canTransitionMissionStatus("draft", "ready"), true);
  assert.equal(canTransitionMissionStatus("draft", "active"), false);
  assert.equal(canTransitionMissionStatus("completed", "active"), false);

  const ready = setMissionReady(draft);
  assert.ok(ready.ok);
  assert.equal(ready.mission.status, "ready");
  assert.match(ready.archiveLine, /muthur_mission_ready/);

  const active = activateMission(ready.mission);
  assert.ok(active.ok);
  assert.equal(active.mission.status, "active");
  assert.ok(active.mission.startedAt);

  const blocked = blockMission(active.mission, "Awaiting worker result");
  assert.ok(blocked.ok);
  assert.equal(blocked.mission.blockedReason, "Awaiting worker result");
  assert.match(blocked.archiveLine, /muthur_mission_blocked/);

  const verifying = setMissionVerifying(blocked.mission);
  assert.ok(verifying.ok);
  assert.equal(verifying.mission.status, "verifying");

  const completed = completeMission(verifying.mission);
  assert.ok(completed.ok);
  assert.equal(completed.mission.status, "completed");
  assert.ok(completed.mission.completedAt);

  const rejected = activateMission(completed.mission);
  assert.equal(rejected.ok, false);
  assert.match(rejected.archiveLine, /muthur_mission_transition_rejected/);

  console.log("probe-muthur-mission-lifecycle: PASS");
}

main();
