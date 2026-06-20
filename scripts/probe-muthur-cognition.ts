import assert from "node:assert/strict";
import {
  flushMuthurCognitionSummary,
  formatMuthurCognitionLiveLine,
  recordMuthurCognitionEvent,
  setMuthurCognitionMode,
} from "../src/lib/muthur/cognition/muthur-cognition-channel";
import { createEmptyMuthurCognitionState } from "../src/lib/muthur/cognition/muthur-cognition-store";

function main() {
  let state = createEmptyMuthurCognitionState();

  const offRecorded = recordMuthurCognitionEvent(state, {
    category: "observe",
    message: "Hidden while OFF.",
  });
  state = offRecorded.state;
  assert.equal(state.stream.length, 0);
  assert.equal(state.events.length, 1);

  state = setMuthurCognitionMode(state, "live");
  const liveRecorded = recordMuthurCognitionEvent(state, {
    category: "observe",
    message: "Operator discussing Ambient Command Surface.",
  });
  state = liveRecorded.state;
  assert.equal(state.stream.length, 1);
  assert.match(state.stream[0]?.text ?? "", /\[observe\]/);
  assert.match(formatMuthurCognitionLiveLine(state.events[0]!), /Ambient Command Surface/);

  state = setMuthurCognitionMode(state, "summary");
  state = recordMuthurCognitionEvent(state, {
    category: "observe",
    message: "Conversation topic shifted to diagnostics header.",
  }).state;
  state = recordMuthurCognitionEvent(state, {
    category: "recommend",
    message: "Promote lighting host to mission.",
  }).state;
  assert.equal(state.pendingSummary.length, 2);

  state = flushMuthurCognitionSummary(state);
  assert.equal(state.pendingSummary.length, 0);
  assert.equal(state.stream.length, 2);
  assert.match(state.stream[0]?.text ?? "", /OBSERVATION:/);
  assert.match(state.stream[0]?.text ?? "", /RECOMMENDATION:/);

  console.log("probe-muthur-cognition: PASS");
}

main();
