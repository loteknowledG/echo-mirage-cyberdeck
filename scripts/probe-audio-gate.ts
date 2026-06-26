import assert from "node:assert/strict";
import {
  hydrateSilentModeAudioGate,
  isAudioAllowed,
  setAudioMasterEnabled,
  setSilentModeForAudioGate,
} from "../src/lib/cyberdeck/audio-gate";

function runProbe() {
  hydrateSilentModeAudioGate(false);
  setAudioMasterEnabled(true);
  assert.equal(isAudioAllowed(), true);

  setSilentModeForAudioGate(true);
  assert.equal(isAudioAllowed(), false);

  setSilentModeForAudioGate(false);
  assert.equal(isAudioAllowed(), true);

  setAudioMasterEnabled(false);
  assert.equal(isAudioAllowed(), false);

  setAudioMasterEnabled(true);
  setSilentModeForAudioGate(true);
  assert.equal(isAudioAllowed(), false);

  hydrateSilentModeAudioGate(false);
  assert.equal(isAudioAllowed(), true);

  console.log("probe-audio-gate: PASS");
}

runProbe();
