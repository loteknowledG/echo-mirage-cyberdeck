import assert from "node:assert/strict";
import {
  formatDelegationDispatchedLine,
  formatDelegationPreparedLine,
} from "../src/lib/muthur/delegation/muthur-delegation-events";
import {
  advanceMissionForDelegationDispatch,
  advanceMissionForDelegationResult,
  advanceMissionWhenDelegationsClear,
} from "../src/lib/muthur/delegation/muthur-delegation-lifecycle";
import { formatMuthurDelegationPackageMessage } from "../src/lib/muthur/delegation/muthur-delegation-package";
import {
  createMuthurDelegation,
  markDelegationDispatched,
  parseAcceptanceCriteriaInput,
  recordDelegationResult,
} from "../src/lib/muthur/delegation/muthur-delegation-store";
import {
  activateMission,
  setMissionReady,
} from "../src/lib/muthur/mission/muthur-mission-lifecycle";
import { createMuthurMission } from "../src/lib/muthur/mission/muthur-mission-store";

function main() {
  const draft = createMuthurMission({
    title: "Probe mission",
    objective: "Verify delegation package formatting.",
  });
  const mission = activateMission(setMissionReady(draft).mission).mission;
  assert.equal(mission.status, "active");

  const assignment = createMuthurDelegation({
    mission,
    workerId: "codex",
    title: "Review commander delegation",
    objective: "Confirm package includes mission context and acceptance criteria.",
    acceptanceCriteria: parseAcceptanceCriteriaInput("package renders\ntsc passes"),
  });

  assert.equal(assignment.status, "draft");
  assert.match(formatDelegationPreparedLine(assignment), /muthur_delegation_package_prepared/);

  const message = formatMuthurDelegationPackageMessage({ mission, assignment });
  assert.match(message, /MUTHUR Delegation Package/);
  assert.match(message, /Probe mission/);
  assert.match(message, /Codex/);
  assert.match(message, /package renders/);

  const dispatched = markDelegationDispatched(assignment);
  assert.equal(dispatched.status, "awaiting_result");
  assert.match(formatDelegationDispatchedLine(dispatched), /muthur_delegation_dispatched/);

  const dispatchAdvance = advanceMissionForDelegationDispatch(mission, [dispatched]);
  assert.ok(dispatchAdvance?.ok);
  assert.equal(dispatchAdvance?.mission.status, "blocked");
  assert.equal(dispatchAdvance?.mission.blockedReason, "Awaiting worker result");
  assert.match(dispatchAdvance!.archiveLine, /muthur_mission_blocked/);

  const completed = recordDelegationResult(dispatched, {
    success: true,
    summary: "Delegation framework verified.",
  });
  assert.equal(completed.status, "completed");

  const resultAdvance = advanceMissionForDelegationResult(
    dispatchAdvance!.mission,
    [completed],
    true,
  );
  assert.ok(resultAdvance?.ok);
  assert.equal(resultAdvance?.mission.status, "verifying");
  assert.match(resultAdvance!.archiveLine, /muthur_mission_verifying/);

  const clearAdvance = advanceMissionWhenDelegationsClear(resultAdvance!.mission, [completed]);
  assert.equal(clearAdvance, null);

  console.log("probe-muthur-commander-delegation: PASS");
}

main();
