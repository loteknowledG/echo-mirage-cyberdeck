import {
  resolveUiTarget,
  type CanonicalTarget,
  type ResolveTargetResult,
} from "../src/lib/computer-use/ui-alias-registry";

function assert(name: string, condition: boolean, detail?: unknown) {
  if (!condition) {
    console.error(`FAIL ${name}`, detail ?? "");
    process.exitCode = 1;
    return;
  }
  console.log(`PASS ${name}`);
}

function resolve(input: string): CanonicalTarget | null {
  const result = resolveUiTarget(input);
  return result.success ? result.target : null;
}

function main() {
  console.log("=== UI Semantic Alias Registry Probe ===\n");

  console.log("--- COMMAND_INPUT aliases ---");
  assert("command input", resolve("command input") === "COMMAND_INPUT");
  assert("command input area", resolve("command input area") === "COMMAND_INPUT");
  assert("message box", resolve("message box") === "COMMAND_INPUT");
  assert("chat box", resolve("chat box") === "COMMAND_INPUT");
  assert("text box", resolve("text box") === "COMMAND_INPUT");
  assert("textbox", resolve("textbox") === "COMMAND_INPUT");
  assert("prompt", resolve("prompt") === "COMMAND_INPUT");
  assert("prompt field", resolve("prompt field") === "COMMAND_INPUT");
  assert("input field", resolve("input field") === "COMMAND_INPUT");
  assert("input area", resolve("input area") === "COMMAND_INPUT");
  assert("message input", resolve("message input") === "COMMAND_INPUT");
  assert("command box", resolve("command box") === "COMMAND_INPUT");
  assert("MUTHUR, indicate message box", resolve("MUTHUR, indicate message box") === "COMMAND_INPUT");
  assert("muthur indicate command input", resolve("muthur indicate command input") === "COMMAND_INPUT");
  assert("muthur highlight prompt field", resolve("muthur highlight prompt field") === "COMMAND_INPUT");
  assert("indicate chat box", resolve("indicate chat box") === "COMMAND_INPUT");
  assert("highlight text box", resolve("highlight text box") === "COMMAND_INPUT");
  assert("point to textbox", resolve("point to textbox") === "COMMAND_INPUT");
  assert("chat input (no exact alias, no single contains match)", resolve("chat input") === null);
  assert("voice lab", resolve("voice lab") === "VOICE_LAB");
  assert("voice panel", resolve("voice panel") === "VOICE_LAB");
  assert("voice controls", resolve("voice controls") === "VOICE_LAB");
  assert("audio panel", resolve("audio panel") === "VOICE_LAB");
  assert("tts panel", resolve("tts panel") === "VOICE_LAB");
  assert("speech controls", resolve("speech controls") === "VOICE_LAB");
  assert("master gain", resolve("master gain") === "VOICE_LAB");
  assert("volume slider", resolve("volume slider") === "VOICE_LAB");
  assert("muthur highlight voice controls", resolve("muthur highlight voice controls") === "VOICE_LAB");
  assert("muthur indicate audio panel", resolve("muthur indicate audio panel") === "VOICE_LAB");
  assert("point to tts panel", resolve("point to tts panel") === "VOICE_LAB");
  assert("highlight speech controls", resolve("highlight speech controls") === "VOICE_LAB");

  console.log("\n--- LEFT_CONSOLE aliases ---");
  assert("left console", resolve("left console") === "LEFT_CONSOLE");
  assert("left panel", resolve("left panel") === "LEFT_CONSOLE");
  assert("log panel", resolve("log panel") === "LEFT_CONSOLE");
  assert("system log", resolve("system log") === "LEFT_CONSOLE");
  assert("sys log", resolve("sys log") === "LEFT_CONSOLE");
  assert("event log", resolve("event log") === "LEFT_CONSOLE");
  assert("muthur indicate left panel", resolve("muthur indicate left panel") === "LEFT_CONSOLE");
  assert("highlight log panel", resolve("highlight log panel") === "LEFT_CONSOLE");

  console.log("\n--- RIGHT_PANEL aliases ---");
  assert("right panel", resolve("right panel") === "RIGHT_PANEL");
  assert("document panel", resolve("document panel") === "RIGHT_PANEL");
  assert("docs panel", resolve("docs panel") === "RIGHT_PANEL");
  assert("viewer panel", resolve("viewer panel") === "RIGHT_PANEL");
  assert("markdown panel", resolve("markdown panel") === "RIGHT_PANEL");
  assert("doctrine panel", resolve("doctrine panel") === "RIGHT_PANEL");
  assert("muthur indicate docs panel", resolve("muthur indicate docs panel") === "RIGHT_PANEL");
  assert("highlight right panel", resolve("highlight right panel") === "RIGHT_PANEL");
  assert("point to doctrine panel", resolve("point to doctrine panel") === "RIGHT_PANEL");

  console.log("\n--- CENTER_STAGE aliases ---");
  assert("center stage", resolve("center stage") === "CENTER_STAGE");
  assert("main content", resolve("main content") === "CENTER_STAGE");
  assert("central area", resolve("central area") === "CENTER_STAGE");
  assert("main panel", resolve("main panel") === "CENTER_STAGE");

  console.log("\n--- Unresolved targets ---");
  assert("banana panel unresolved", resolve("banana panel") === null);
  assert("garbage input unresolved", resolve("banana") === null);
  assert("banana box unresolved", resolve("banana box") === null);
  assert("indicate banana", resolve("indicate banana") === null);
  assert("highlight nothing", resolve("highlight nothing") === null);
  assert("point to xyz", resolve("point to xyz") === null);
  assert("empty string unresolved", resolve("") === null);
  assert("whitespace only unresolved", resolve("   ") === null);
  assert("random phrase unresolved", resolve("the sky is blue") === null);

  console.log("\n--- Case insensitivity ---");
  assert("uppercase COMMAND INPUT", resolve("COMMAND INPUT") === "COMMAND_INPUT");
  assert("Title Case Voice Lab", resolve("Voice Lab") === "VOICE_LAB");
  assert("mixed case MESsAGE BoX", resolve("MESsAGE BoX") === "COMMAND_INPUT");

  console.log("\n--- Punctuation normalization ---");
  assert("message box. (with period)", resolve("message box.") === "COMMAND_INPUT");
  assert("prompt, (with comma)", resolve("prompt,") === "COMMAND_INPUT");
  assert("voice lab? (with question mark)", resolve("voice lab?") === "VOICE_LAB");
  assert("left panel! (with exclamation)", resolve("left panel!") === "LEFT_CONSOLE");

  console.log("\n--- Whitespace normalization ---");
  assert("command   input (multiple spaces)", resolve("command   input") === "COMMAND_INPUT");
  assert("  prompt  (leading/trailing spaces)", resolve("  prompt  ") === "COMMAND_INPUT");
  assert("voice\tlab (tab)", resolve("voice\tlab") === "VOICE_LAB");

  console.log("\n--- Ambiguous matches (unresolved) ---");
  assert("panel (ambiguous - multiple targets)", resolve("panel") === null);
  assert("box (multiple contains matches - unresolved)", resolve("box") === null);
  assert("input field (exact alias)", resolve("input field") === "COMMAND_INPUT");
  assert("chat input area (contains 'input area' alias)", resolve("chat input area") === "COMMAND_INPUT");

  console.log("\n--- Intent phrase prefix (contains match) ---");
  assert("muthur indicate message box", resolve("muthur indicate message box") === "COMMAND_INPUT");
  assert("muthur highlight chat box", resolve("muthur highlight chat box") === "COMMAND_INPUT");
  assert("please indicate voice lab", resolve("please indicate voice lab") === "VOICE_LAB");
  assert("show me the docs panel", resolve("show me the docs panel") === "RIGHT_PANEL");

  console.log("\n--- Verify UnresolvedResult shape ---");
  const unresolved = resolveUiTarget("banana panel");
  assert("unresolved returns success:false", unresolved.success === false);
  assert("unresolved has reason alias-not-found", !unresolved.success && unresolved.reason === "alias-not-found");
  assert("unresolved has query field", !unresolved.success && unresolved.query === "banana panel");

  console.log("\n--- Safety: no shell/IPC/dispatch ---");
  const { readFileSync } = require("node:fs");
  const { join } = require("node:path");
  const src = readFileSync(join(process.cwd(), "src/lib/computer-use/ui-alias-registry.ts"), "utf8");
  assert("no dispatchEvent", !/dispatchEvent/.test(src));
  assert("no ipcRenderer", !/ipcRenderer/.test(src));
  assert("no exec", !/exec/.test(src));
  assert("no spawn", !/spawn/.test(src));
  assert("no MouseEvent", !/MouseEvent/.test(src));
  assert("no click()", !/\.click\(/.test(src));
  assert("no focus()", !/\.focus\(/.test(src));
}

void main();