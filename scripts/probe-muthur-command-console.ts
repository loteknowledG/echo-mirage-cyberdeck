/**
 * L-UI-001 command console acceptance probes (logic-level, deterministic).
 * Run: pnpm probe:muthur-command-console
 */
import assert from "node:assert/strict";

import {
  buildMuthurResponseScrollKey,
  commitMuthurAssistantTurn,
  formatMuthurStreamBody,
  groupMuthurChatTurns,
  isLongMuthurResponse,
  resolveMuthurResponsePhase,
  toolTraceToDiagnostic,
  type MuthurChatMessage,
} from "../src/lib/muthur-core/muthur-command-console";
import {
  appendMuthurDiagnosticBatch,
  appendMuthurDiagnosticEntry,
  buildMuthurStallMessage,
  createEmptyMuthurDiagnosticsState,
  presentMuthurDiagnostics,
  shouldFireMuthurComposeWatchdog,
} from "../src/lib/muthur-core/muthur-diagnostics-channel";
import {
  extractMuthurStreamReasoning,
  formatMuthurReasoningDiagnostic,
  MUTHUR_REASONING_STREAM_SENTINEL,
} from "../src/lib/muthur-core/muthur-stream-reasoning";
import {
  isMuthurUplinkProgressOnly,
  parseMuthurUplinkProgressPhase,
} from "../src/lib/muthur-core/muthur-progress-phase";
import {
  buildMuthurSelfModifyPrompt,
  isMuthurSelfModifyIntent,
} from "../src/lib/muthur/muthur-self-modify-intent";
import { formatMuthurLiveStreamDisplay } from "../src/lib/muthur-core/muthur-stream-payload";

function longText(words: number): string {
  return Array.from({ length: words }, (_, index) => `word${index}`).join(" ");
}

function testLongResponseReadable(): void {
  const body = longText(2100);
  assert.ok(isLongMuthurResponse(body), "T1: expected long response detection");
  const stream = formatMuthurStreamBody(`⏳ MUTHUR // preparing uplink...\n\n${body}`);
  assert.equal(stream, body, "T1: progress must not obscure response body");
  console.log("  ok T1 long response readable");
}

function testToolFailureIsolation(): void {
  const messages: MuthurChatMessage[] = [
    { role: "user", text: "Plan the architecture." },
    {
      role: "assistant",
      text: "Verdict: adopt command router as spine.",
      toolTrace: "localfs,operator_browser",
    },
    { role: "system", text: "BROWSER_ACTION // CAPTCHA_BLOCKED" },
    { role: "system", text: "OPERATOR EDIT // FAILED" },
  ];
  const turns = groupMuthurChatTurns(messages);
  assert.equal(turns.length, 1);
  assert.match(turns[0].assistant?.text ?? "", /Verdict/);
  assert.ok(turns[0].diagnostics.length >= 3, "T2: tool failures belong in diagnostics");
  console.log("  ok T2 tool failure isolation");
}

function testDiagnosticCollapseGrouping(): void {
  let diagnostics = createEmptyMuthurDiagnosticsState();
  diagnostics = appendMuthurDiagnosticBatch(diagnostics, [
    "MODEL_CONNECTED",
    "UPLINK_TIMEOUT",
    "OPERATOR OPEN // file.ts",
  ]);
  const presented = presentMuthurDiagnostics(diagnostics);
  assert.ok(presented.totalCount >= 3, "T3: diagnostics collected in separate channel");
  console.log("  ok T3 diagnostic grouping");
}

function testScrollKeyIgnoresLateDiagnostics(): void {
  const base: MuthurChatMessage[] = [
    { role: "user", text: "architecture plan" },
    { role: "assistant", text: "Conclusion: ship command router first." },
  ];
  const before = buildMuthurResponseScrollKey(base, "", false);
  const after = buildMuthurResponseScrollKey(
    [...base, { role: "system", text: "OPERATOR EDIT // applied" }],
    "",
    false,
  );
  assert.equal(before, after, "T4: diagnostics must not change response scroll key");
  console.log("  ok T4 scroll key stable after diagnostics");
}

function testRendererErrorIsolation(): void {
  const messages: MuthurChatMessage[] = [
    { role: "user", text: "Summarize." },
    { role: "assistant", text: "Summary remains visible despite renderer noise." },
    { role: "system", text: "RENDER // glyph channel failed to mount" },
  ];
  const turns = groupMuthurChatTurns(messages);
  assert.match(turns[0].assistant?.text ?? "", /Summary remains visible/);
  assert.ok(
    turns[0].diagnostics.some((entry) => /RENDER/i.test(entry.text)),
    "T5: renderer error isolated in diagnostics",
  );
  console.log("  ok T5 renderer error isolation");
}

function testCompletionPhase(): void {
  assert.equal(
    resolveMuthurResponsePhase({ isStreaming: true, streamText: "", messages: [] }),
    "composing",
  );
  assert.equal(
    resolveMuthurResponsePhase({
      isStreaming: false,
      streamText: "",
      messages: [
        { role: "user", text: "status" },
        { role: "assistant", text: "done" },
      ],
    }),
    "complete",
  );
  assert.equal(
    resolveMuthurResponsePhase({
      isStreaming: true,
      streamText: "⏳ MUTHUR // composing final reply...",
      messages: [],
      stalled: true,
    }),
    "stalled",
  );
  console.log("  ok completion phase");
}

function testDiagnosticsFloodDoesNotBlockAssistantCommit(): void {
  let channel: MuthurChatMessage[] = [{ role: "user", text: "open L-ARCH-001.md" }];
  let diagnostics = createEmptyMuthurDiagnosticsState();

  channel = commitMuthurAssistantTurn({
    messages: channel,
    text: "Opened L-ARCH-001.md in the operator pane.",
    toolTrace: "localfs,operator_open_file",
  });

  const base = Date.now();
  for (let i = 0; i < 260; i += 1) {
    diagnostics = appendMuthurDiagnosticEntry(diagnostics, `PROBE_DIAG // event ${i}`, base + i * 85);
  }

  assert.match(channel.at(-1)?.text ?? "", /Opened L-ARCH-001/);
  assert.ok(diagnostics.entries.length <= 200, "T6: diagnostics capped");
  assert.equal(
    resolveMuthurResponsePhase({ isStreaming: false, streamText: "", messages: channel }),
    "complete",
  );
  const presented = presentMuthurDiagnostics(diagnostics);
  assert.ok(presented.collapsedSummary, "T6: overflow collapsed into summary");
  console.log("  ok T6 diagnostics flood with assistant commit");
}

function testFailedToolWhileComposing(): void {
  const channel: MuthurChatMessage[] = [{ role: "user", text: "Plan the architecture." }];
  let diagnostics = createEmptyMuthurDiagnosticsState();
  diagnostics = appendMuthurDiagnosticEntry(
    diagnostics,
    "OPERATOR EDIT // FAILED // MUTHUR could not apply the edit in the operator pane.",
  );

  assert.equal(
    resolveMuthurResponsePhase({
      isStreaming: true,
      streamText: "⏳ MUTHUR // composing final reply...",
      messages: channel,
    }),
    "composing",
  );

  const committed = commitMuthurAssistantTurn({
    messages: channel,
    text: "Verdict: adopt command router as spine.",
  });
  assert.equal(
    resolveMuthurResponsePhase({
      isStreaming: false,
      streamText: "",
      messages: committed,
    }),
    "complete",
  );
  assert.ok(
    diagnostics.entries.some((entry) => /OPERATOR EDIT \/\/ FAILED/i.test(entry.text)),
    "T7: tool failure isolated in diagnostics channel",
  );
  console.log("  ok T7 failed tool while composing");
}

function testComposeWatchdog(): void {
  const stall = shouldFireMuthurComposeWatchdog({
    isStreaming: true,
    streamText: "⏳ MUTHUR // composing final reply...",
    composeStartedAt: Date.now() - 130_000,
  });
  assert.ok(stall, "T8: watchdog fires after stall threshold");
  assert.match(buildMuthurStallMessage({ phase: "composing final reply...", elapsedMs: 130_000 }), /stalled/i);
  console.log("  ok T8 compose watchdog");
}

function testStreamFormatting(): void {
  const progressOnly = formatMuthurLiveStreamDisplay("⏳ MUTHUR // cogitating...");
  assert.match(progressOnly, /MUTHUR/);
  const withBody = formatMuthurStreamBody("⏳ MUTHUR // uplink...\n\nFinal conclusion here.");
  assert.equal(withBody, "Final conclusion here.");
  console.log("  ok stream body formatting");
}

function testReasoningStream(): void {
  const mixed = `⏳ MUTHUR // thinking...\n${MUTHUR_REASONING_STREAM_SENTINEL}Plan mkdir.⟦/R⟧${MUTHUR_REASONING_STREAM_SENTINEL}Then write.⟦/R⟧\n\nHello operator.`;
  const extracted = extractMuthurStreamReasoning(mixed);
  assert.equal(extracted.reasoning, "Plan mkdir.Then write.");
  assert.match(extracted.body, /Hello operator/);
  assert.equal(formatMuthurLiveStreamDisplay(mixed), "Hello operator.");
  assert.match(formatMuthurReasoningDiagnostic(extracted.reasoning), /^\[REASONING\]/);
  console.log("  ok T10 reasoning stream");
}

function testSelfModifyIntent(): void {
  assert.ok(isMuthurSelfModifyIntent("make it so I can ask muthur to change its own code"));
  assert.ok(isMuthurSelfModifyIntent("edit your source in src/lib/muthur-core"));
  assert.ok(!isMuthurSelfModifyIntent("hello muthur"));
  assert.match(buildMuthurSelfModifyPrompt("agent", "F:/dev/echo-mirage-cyberdeck"), /SELF-MODIFY/);
  console.log("  ok T11 self-modify intent");
}

function testUplinkProgressPhase(): void {
  const composing = "⏳ MUTHUR // composing final reply...";
  const phase = parseMuthurUplinkProgressPhase(composing);
  assert.equal(phase.kind, "transmit");
  assert.equal(phase.title, "TRANSMITTING");
  assert.ok(isMuthurUplinkProgressOnly(composing, ""), "T9: progress-only before body");
  assert.ok(
    !isMuthurUplinkProgressOnly(`${composing}\n\nHello`, "Hello"),
    "T9: not progress-only once body arrives",
  );
  console.log("  ok T9 uplink progress phase");
}

async function main(): Promise<void> {
  console.log("probe:muthur-command-console");
  testLongResponseReadable();
  testToolFailureIsolation();
  testDiagnosticCollapseGrouping();
  testScrollKeyIgnoresLateDiagnostics();
  testRendererErrorIsolation();
  testCompletionPhase();
  testStreamFormatting();
  testReasoningStream();
  testSelfModifyIntent();
  testUplinkProgressPhase();
  testDiagnosticsFloodDoesNotBlockAssistantCommit();
  testFailedToolWhileComposing();
  testComposeWatchdog();
  console.log("probe:muthur-command-console PASS");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
