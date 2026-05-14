import {
  addNarrationListener,
  isNarrationPaused,
  narrate,
  narrateAndSpeak,
  pauseNarration,
  resumeNarration,
  speakNarration,
} from "../src/lib/computer-use/narration";

function assert(name: string, condition: boolean, detail?: unknown) {
  if (!condition) {
    console.error(`FAIL ${name}`, detail ?? "");
    process.exitCode = 1;
    return;
  }
  console.log(`PASS ${name}`);
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  resumeNarration();
  const heard: string[] = [];
  const removeListener = addNarrationListener((narration) => heard.push(narration.text));

  const first = narrate("INDICATE_POINT");
  assert("INDICATE_POINT narration text", first?.text === "Indicating command input.", first);
  assert("listener receives narration", heard.includes("Indicating command input."), heard);

  assert("repeat 2 within debounce emits", narrate("INDICATE_POINT") != null);
  assert("repeat 3 within debounce emits", narrate("INDICATE_POINT") != null);
  assert("repeat 4 within debounce suppresses", narrate("INDICATE_POINT") === null);

  await wait(3100);
  assert("debounce resets after stale window", narrate("INDICATE_POINT") != null);

  pauseNarration();
  assert("pauseNarration sets paused state", isNarrationPaused());
  assert("paused narration returns null", narrate("CONTROL_GRANTED") === null);
  resumeNarration();
  assert("resumeNarration clears paused state", !isNarrationPaused());

  const spoken = narrateAndSpeak("UNSUPPORTED_ACTION", false);
  assert("narrateAndSpeak returns narration when speech disabled", spoken?.text === "Unsupported action.", spoken);

  const targetNotFound = narrate("TARGET_NOT_FOUND");
  assert("TARGET_NOT_FOUND narration text", targetNotFound?.text === "Unable to locate teaching target.", targetNotFound);
  assert("TARGET_NOT_FOUND listener fires", heard.includes("Unable to locate teaching target."), heard);

  speakNarration("test narration");
  assert("speakNarration returns void (fire-and-forget)", true);

  removeListener();
}

void main();
