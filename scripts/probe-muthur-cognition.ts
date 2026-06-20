import assert from "node:assert/strict";
import {
  buildMuthurCognitionStatusLine,
  formatMuthurCognitionDiagnostic,
  recordMuthurCognitionEvent,
  shouldSurfaceCognitionForUplinkMode,
} from "../src/lib/muthur/cognition/muthur-cognition-channel";
import { createEmptyMuthurCognitionState } from "../src/lib/muthur/cognition/muthur-cognition-store";

function main() {
  let state = createEmptyMuthurCognitionState();

  assert.equal(shouldSurfaceCognitionForUplinkMode("plan"), true);
  assert.equal(shouldSurfaceCognitionForUplinkMode("agent"), true);
  assert.equal(shouldSurfaceCognitionForUplinkMode("commander"), true);

  const recorded = recordMuthurCognitionEvent(state, {
    category: "observe",
    message: "Operator discussing Ambient Command Surface.",
  });
  state = recorded.state;
  assert.equal(state.events.length, 1);
  assert.match(formatMuthurCognitionDiagnostic(recorded.event), /\[COGNITION observe\]/);
  assert.match(formatMuthurCognitionDiagnostic(recorded.event), /Ambient Command Surface/);

  const planStatus = buildMuthurCognitionStatusLine("plan");
  assert.match(planStatus ?? "", /PLAN/);
  assert.match(planStatus ?? "", /read-only/i);

  const commanderStatus = buildMuthurCognitionStatusLine("commander", {
    commanderPosture: "AWAITING_MISSION",
  });
  assert.match(commanderStatus ?? "", /AWAITING MISSION/i);

  console.log("probe-muthur-cognition: PASS");
}

main();
