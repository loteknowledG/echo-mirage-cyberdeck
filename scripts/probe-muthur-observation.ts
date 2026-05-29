import assert from "node:assert/strict";
import {
  getMuthurExecutionLoop,
  recordMuthurObservation,
  resetMuthurExecutionLoopForTests,
  resetMuthurExecutionStoreForTests,
} from "../src/lib/muthur/execution/index.server";

async function main() {
  resetMuthurExecutionStoreForTests();
  resetMuthurExecutionLoopForTests();
  recordMuthurObservation({
    route: "/property-manager",
    surface: "property-manager",
    observing: true,
    observingPanelId: "property-manager-live-intake",
    observingSubsystem: "property-manager",
    activeTab: "property-manager",
    activePane: "live-intake",
    visibleDocument: null,
    documentExcerpt: null,
    selectedProperty: "Building C",
    selectedUnit: "C-204",
    visibleLogs: ["CALLER // water through ceiling"],
    activeTickets: [{ priority: "emergency", category: "water_leak" }],
    operationalMode: "OBSERVE",
    transcriptState: "LISTENING // EMERGENCY",
    operationalWarnings: ["EMERGENCY ESCALATION"],
    continuityIndicators: ["FOLLOW-UP REQUIRED"],
  });

  const loop = getMuthurExecutionLoop();
  loop.setMode("observe");
  const created = loop.enqueue([
    { type: "observe_operator_pane", source: "system", payload: {} },
  ]);

  assert.equal(created[0]?.requires_confirmation, false);
  await loop.waitForIdle(30_000);

  const state = loop.getState();
  const action = state.completed_actions.find((item) => item.id === created[0]?.id);
  assert.equal(state.execution_mode, "observe");
  assert.equal(action?.status, "completed");
  assert.equal(action?.result?.metadata?.read_only, true);
  const observation = action?.result?.metadata?.observation as { route?: string; selectedUnit?: string } | undefined;
  assert.equal(observation?.route, "/property-manager");
  assert.equal(observation?.selectedUnit, "C-204");

  const stillBlocked = loop.enqueue([
    {
      type: "write_file",
      source: "system",
      payload: { path: ".muthur/logs/observation-authority-must-not-write.txt", content: "not executed" },
    },
  ]);
  assert.equal(stillBlocked[0]?.requires_confirmation, true);
  assert.equal(loop.getState().queue.find((item) => item.id === stillBlocked[0]?.id)?.status, "blocked");
  loop.clearQueue();

  console.log("probe-muthur-observation: PASS");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
