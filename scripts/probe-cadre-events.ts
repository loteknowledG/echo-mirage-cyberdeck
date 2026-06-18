/**
 * L-UX-CADRE-001 Phase A probes.
 * Run: pnpm probe:cadre-events
 */
import assert from "node:assert/strict";

import {
  buildCadreEvent,
  formatCadreEventLine,
  formatCadreMuthurArchiveLine,
  shouldArchiveCadreEvent,
} from "../src/lib/cadre/cadre-events";
import {
  getCadreEventBuffer,
  ingestCadreEvent,
  resetCadreEventBusForTests,
} from "../src/lib/cadre/cadre-event-bus";
import { signalToFlightLog } from "../src/lib/flight-log";
import {
  getCadreRuntimeManager,
  resetCadreRuntimeManagerForTests,
} from "../src/lib/server/cadre-runtime-manager.server";
import {
  listCadreEvents,
  resetCadreEventLogForTests,
} from "../src/lib/server/cadre-event-log.server";

function testCadreEventShape(): void {
  const event = buildCadreEvent({
    type: "runtime_started",
    actor: "CURSOR",
    runtimeId: "cursor",
    message: "Accepted implementation",
    severity: "success",
  });

  assert.equal(event.type, "runtime_started");
  assert.equal(event.actor, "CURSOR");
  assert.equal(event.archive, true);
  assert.match(formatCadreEventLine(event), /^\[CURSOR\] Accepted implementation$/);
  assert.match(formatCadreMuthurArchiveLine(event), /^CADRE \/\/ CURSOR \/\/ /);
  console.log("  ok cadre event shape");
}

function testArchiveFilter(): void {
  assert.equal(
    shouldArchiveCadreEvent({
      type: "readiness_changed",
      actor: "CODEX",
      message: "ready",
      severity: "success",
      meta: { readiness: "ready" },
    }),
    true,
  );
  assert.equal(
    shouldArchiveCadreEvent({
      type: "readiness_changed",
      actor: "CODEX",
      message: "starting",
      severity: "info",
      meta: { readiness: "starting" },
    }),
    false,
  );
  assert.equal(
    shouldArchiveCadreEvent({
      type: "stream_connected",
      actor: "CADRE",
      message: "connected",
      severity: "info",
    }),
    false,
  );
  console.log("  ok archive filter");
}

function testClientBusDedupes(): void {
  resetCadreEventBusForTests();
  const first = ingestCadreEvent({
    type: "runtime_started",
    actor: "PI",
    runtimeId: "pi",
    message: "Runtime online",
    severity: "success",
  });
  const second = ingestCadreEvent(first);
  assert.equal(getCadreEventBuffer().length, 1);
  assert.equal(second.id, first.id);
  console.log("  ok client bus dedupe");
}

function testFlightLogBridge(): void {
  const mapped = signalToFlightLog({
    id: "sig-1",
    ts: new Date().toISOString(),
    source: "cadre",
    type: "verification_pass",
    severity: "success",
    payload: {
      actor: "CODEX",
      message: "CODEX readiness: ready",
    },
  });
  assert.ok(mapped);
  assert.equal(mapped!.actor, "CODEX");
  assert.equal(mapped!.result, "VERIFICATION_PASS");
  console.log("  ok flight log bridge");
}

async function testServerLifecycleEvents(): Promise<void> {
  resetCadreRuntimeManagerForTests();
  resetCadreEventLogForTests();
  const manager = getCadreRuntimeManager();

  await manager.startRuntime("cursor");
  const events = listCadreEvents(20);
  assert.ok(events.some((event) => event.type === "runtime_started"));
  assert.ok(events.some((event) => event.type === "verification_pass" || event.type === "readiness_changed"));

  await manager.stopRuntime("cursor");
  const stopped = listCadreEvents(40);
  assert.ok(stopped.some((event) => event.type === "runtime_stopped"));

  const archived = stopped.filter((event) => event.archive);
  assert.ok(archived.length >= 2);
  console.log("  ok server lifecycle events");
}

async function main(): Promise<void> {
  console.log("probe:cadre-events");
  testCadreEventShape();
  testArchiveFilter();
  testClientBusDedupes();
  testFlightLogBridge();
  await testServerLifecycleEvents();
  console.log("probe:cadre-events PASS");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
