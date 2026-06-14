/**
 * L-UI-001 response visibility acceptance probes (T1–T6).
 * Run: pnpm probe:muthur-response-visibility
 */
import assert from "node:assert/strict";

import {
  buildMuthurResponseScrollKey,
  commitMuthurAssistantTurn,
  formatMuthurStreamBody,
  isLongMuthurResponse,
  resolveMuthurResponsePhase,
  type MuthurChatMessage,
} from "../src/lib/muthur-core/muthur-command-console";
import {
  appendMuthurDiagnosticEntry,
  buildMuthurStallMessage,
  createEmptyMuthurDiagnosticsState,
  formatDiagnosticEntryText,
  presentMuthurDiagnostics,
  shouldFireMuthurComposeWatchdog,
} from "../src/lib/muthur-core/muthur-diagnostics-channel";
import {
  isMuthurResponseChannelRole,
  partitionMuthurChannelUpdate,
  resolveMuthurResponseLifecycle,
} from "../src/lib/muthur-core/muthur-response-channel";

function longText(words: number): string {
  return Array.from({ length: words }, (_, index) => `word${index}`).join(" ");
}

function testT1DiagnosticFlood(): void {
  let channel: MuthurChatMessage[] = [{ role: "user", text: "open L-ARCH-001.md" }];
  let diagnostics = createEmptyMuthurDiagnosticsState();

  channel = commitMuthurAssistantTurn({
    messages: channel,
    text: "Opened L-ARCH-001.md in the operator pane.",
  });

  const base = Date.now();
  for (let i = 0; i < 300; i += 1) {
    diagnostics = appendMuthurDiagnosticEntry(diagnostics, "QUEUE // uplink tick", base + i);
  }

  assert.equal(
    resolveMuthurResponsePhase({ isStreaming: false, streamText: "", messages: channel }),
    "complete",
  );
  assert.ok(presentMuthurDiagnostics(diagnostics).totalCount >= 300);
  console.log("  ok T1 diagnostic flood (300 events)");
}

function testT2ToolFailure(): void {
  const channel: MuthurChatMessage[] = [
    { role: "user", text: "edit doc" },
    { role: "assistant", text: "Applied the requested edit." },
  ];
  let diagnostics = createEmptyMuthurDiagnosticsState();
  diagnostics = appendMuthurDiagnosticEntry(
    diagnostics,
    "OPERATOR EDIT // FAILED // could not apply",
  );

  assert.match(channel.at(-1)?.text ?? "", /Applied/);
  assert.ok(diagnostics.entries.some((entry) => /FAILED/i.test(entry.text)));
  console.log("  ok T2 tool failure isolation");
}

function testT3QueueSpam(): void {
  let diagnostics = createEmptyMuthurDiagnosticsState();
  for (let i = 0; i < 120; i += 1) {
    diagnostics = appendMuthurDiagnosticEntry(diagnostics, "⏳ MUTHUR // thinking...");
  }
  assert.equal(diagnostics.entries.length, 1);
  assert.equal(diagnostics.entries[0]?.repeatCount, 120);
  assert.match(formatDiagnosticEntryText(diagnostics.entries[0]!), /repeated 120 times/);
  console.log("  ok T3 queue spam deduplicated");
}

function testT4LongArchitectureResponse(): void {
  const body = longText(2200);
  assert.ok(isLongMuthurResponse(body));
  const stream = formatMuthurStreamBody(`⏳ MUTHUR // composing...\n\n${body}`);
  assert.equal(stream, body);
  console.log("  ok T4 long architecture response readable");
}

function testT5StalledResponse(): void {
  const stall = shouldFireMuthurComposeWatchdog({
    isStreaming: true,
    streamText: "⏳ MUTHUR // composing final reply...",
    composeStartedAt: Date.now() - 130_000,
  });
  assert.ok(stall);
  assert.equal(
    resolveMuthurResponseLifecycle({
      isStreaming: true,
      streamText: "⏳ MUTHUR // composing final reply...",
      messages: [],
      stalled: true,
    }),
    "stalled",
  );
  assert.match(
    buildMuthurStallMessage({ phase: "MUTHUR // composing final reply...", elapsedMs: 130_000 }),
    /Diagnostics available/i,
  );
  console.log("  ok T5 stalled response watchdog");
}

function testT6ResponseOwnership(): void {
  const prev: MuthurChatMessage[] = [{ role: "user", text: "hello" }];
  const rawNext: MuthurChatMessage[] = [
    { role: "user", text: "hello" },
    { role: "system", text: "MODEL_CONNECTED" },
    { role: "assistant", text: "ack" },
    { role: "error", text: "should not appear in channel" },
  ];
  const { channel, newDiagnostics } = partitionMuthurChannelUpdate(prev, rawNext);

  assert.equal(channel.length, 2);
  assert.ok(channel.every((message) => isMuthurResponseChannelRole(message.role)));
  assert.ok(newDiagnostics.length >= 2);
  assert.ok(!channel.some((message) => message.role === "system" || message.role === "error"));

  const scrollBefore = buildMuthurResponseScrollKey(channel, "", false);
  const scrollAfter = buildMuthurResponseScrollKey(
    [...channel, { role: "system", text: "late diagnostic" }],
    "",
    false,
  );
  assert.equal(scrollBefore, scrollAfter);
  console.log("  ok T6 response channel ownership");
}

function testFailedLifecycle(): void {
  assert.equal(
    resolveMuthurResponseLifecycle({
      isStreaming: false,
      streamText: "",
      messages: [{ role: "user", text: "open file" }],
      failed: true,
    }),
    "failed",
  );
  console.log("  ok failed lifecycle state");
}

async function main(): Promise<void> {
  console.log("probe:muthur-response-visibility");
  testT1DiagnosticFlood();
  testT2ToolFailure();
  testT3QueueSpam();
  testT4LongArchitectureResponse();
  testT5StalledResponse();
  testT6ResponseOwnership();
  testFailedLifecycle();
  console.log("probe:muthur-response-visibility PASS");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
