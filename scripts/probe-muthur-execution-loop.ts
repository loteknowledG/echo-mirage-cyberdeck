import assert from "node:assert/strict";
import {
  getMuthurExecutionLoop,
  resetMuthurExecutionLoopForTests,
  resetMuthurExecutionStoreForTests,
} from "../src/lib/muthur/execution/index.server";

async function main() {
  resetMuthurExecutionStoreForTests();
  resetMuthurExecutionLoopForTests();
  const loop = getMuthurExecutionLoop();
  loop.setMode("execute");

  const created = loop.enqueue([
    { type: "wait", source: "system", payload: { ms: 10 } },
    {
      type: "shell_command",
      source: "system",
      payload: { command: "git status --short" },
    },
  ]);

  await loop.waitForIdle(30_000);
  const state = loop.getState();
  assert.equal(created.length, 2);
  assert.equal(state.queue_length, 0);
  assert.equal(state.completed_actions.length, 2);
  assert.equal(state.completed_actions[0]?.status, "completed");
  assert.equal(state.completed_actions[1]?.status, "completed");

  const blocked = loop.enqueue([
    { type: "write_file", source: "system", payload: { path: ".muthur/logs/probe.txt", content: "probe" } },
  ]);
  loop.setMode("observe");
  const observeState = loop.getState();
  assert.equal(observeState.queue[0]?.status, "blocked");
  await loop.waitForIdle(5_000);
  assert.equal(loop.getState().queue_length, 1);
  loop.approve(blocked[0]!.id);
  await loop.waitForIdle(30_000);
  assert.equal(loop.getState().queue_length, 0);

  loop.setMode("execute");
  const unsupported = loop.enqueue([
    { type: "click", source: "system", payload: { x: 1, y: 2 } },
  ]);
  await loop.waitForIdle(30_000);
  const done = loop.getState().completed_actions.find((action) => action.id === unsupported[0]?.id);
  assert.equal(done?.status, "unsupported");

  console.log("probe-muthur-execution-loop: PASS");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
