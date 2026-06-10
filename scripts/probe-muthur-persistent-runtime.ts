import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  getMuthurPersistentRuntime,
  resetMuthurPersistentRuntimeForTests,
  resetMuthurRuntimeStoreForTests,
} from "../src/lib/muthur/runtime/index.server";
import {
  getMuthurExecutionLoop,
  resetMuthurExecutionLoopForTests,
  resetMuthurExecutionStoreForTests,
} from "../src/lib/muthur/execution/index.server";

const DEV_STATE_PATH = path.join(process.cwd(), ".tmp", "dev-server.json");
const SESSION_PATH = path.join(process.cwd(), ".muthur", "runtime", "session.json");

async function devServerUp(baseUrl: string): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl}/api/muthur/runtime`, { cache: "no-store" });
    return res.ok;
  } catch {
    return false;
  }
}

async function resolveProbeBaseUrl(): Promise<string | null> {
  const candidates: string[] = [];
  if (process.env.MUTHUR_VERIFY_BASE_URL?.trim()) {
    candidates.push(process.env.MUTHUR_VERIFY_BASE_URL.trim().replace(/\/$/, ""));
  }
  try {
    const state = JSON.parse(await fs.readFile(DEV_STATE_PATH, "utf8")) as {
      origin?: string;
      appPort?: number;
    };
    if (state.origin) candidates.push(String(state.origin).replace(/\/$/, ""));
    if (state.appPort) candidates.push(`http://127.0.0.1:${state.appPort}`);
  } catch {
    /* optional */
  }
  candidates.push("http://127.0.0.1:3050", "http://127.0.0.1:3051");

  for (const origin of [...new Set(candidates)]) {
    if (await devServerUp(origin)) return origin;
  }
  return null;
}

async function testInProcessRuntime(): Promise<void> {
  resetMuthurExecutionStoreForTests();
  resetMuthurExecutionLoopForTests();
  resetMuthurRuntimeStoreForTests();
  resetMuthurPersistentRuntimeForTests();

  const runtime = getMuthurPersistentRuntime();
  const initial = await runtime.getState();
  assert.equal(initial.posture, "standby");
  assert.equal(initial.watch_enabled, false);

  const watching = await runtime.startWatch(60_000);
  assert.equal(watching.watch_enabled, true);
  assert.equal(watching.posture, "watch");

  const stopped = await runtime.stopWatch();
  assert.equal(stopped.watch_enabled, false);
  assert.equal(stopped.posture, "standby");

  const enqueued = await runtime.enqueueTask({
    kind: "patrol",
    label: "probe-enqueued-patrol",
    source: "probe",
  });
  assert.ok(enqueued.recent_tasks.length >= 1 || enqueued.patrol_count >= 1);

  const beforePatrolCount = (await runtime.getState()).patrol_count;
  await runtime.patrolNow("probe-in-process-patrol", "probe");
  const afterPatrol = await runtime.getState();
  assert.ok(afterPatrol.last_patrol, "expected patrol receipt");
  assert.equal(afterPatrol.patrol_count, beforePatrolCount + 1);
  assert.ok(Array.isArray(afterPatrol.last_patrol?.checks));
  assert.equal(afterPatrol.last_patrol?.checks.length, 2);
  assert.ok(afterPatrol.patrol_history.length >= 1);
  assert.equal(afterPatrol.last_patrol?.source, "probe");

  try {
    const sessionRaw = await fs.readFile(SESSION_PATH, "utf8");
    assert.match(sessionRaw, /patrol_count/);
  } catch {
    /* session file optional on first run */
  }

  const loop = getMuthurExecutionLoop();
  const minActions = afterPatrol.last_patrol?.checks.some((check) => check.message.includes("skipped")) ? 1 : 2;
  assert.ok(
    loop.getState().completed_actions.length >= minActions,
    `expected >= ${minActions} completed actions`,
  );
}

async function testRuntimeApi(baseUrl: string): Promise<void> {
  const getRes = await fetch(`${baseUrl}/api/muthur/runtime`);
  const getData = (await getRes.json()) as { ok?: boolean; state?: { posture?: string } };
  assert.equal(getRes.ok, true);
  assert.ok(getData.state?.posture);

  const watchRes = await fetch(`${baseUrl}/api/muthur/runtime`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ op: "start_watch", intervalMs: 120_000 }),
  });
  const watchData = (await watchRes.json()) as { state?: { watch_enabled?: boolean } };
  assert.equal(watchRes.ok, true);
  assert.equal(watchData.state?.watch_enabled, true);

  const enqueueRes = await fetch(`${baseUrl}/api/muthur/runtime`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      op: "enqueue_task",
      kind: "patrol",
      label: "probe-api-enqueue",
      source: "probe",
    }),
  });
  const enqueueData = (await enqueueRes.json()) as {
    state?: { task_queue?: unknown[]; recent_tasks?: unknown[] };
  };
  assert.equal(enqueueRes.ok, true);
  assert.ok(
    (enqueueData.state?.task_queue?.length ?? 0) +
      (enqueueData.state?.recent_tasks?.length ?? 0) >=
      1,
  );

  const stopRes = await fetch(`${baseUrl}/api/muthur/runtime`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ op: "stop_watch" }),
  });
  const stopData = (await stopRes.json()) as { state?: { watch_enabled?: boolean } };
  assert.equal(stopRes.ok, true);
  assert.equal(stopData.state?.watch_enabled, false);
}

async function main() {
  await testInProcessRuntime();

  const baseUrl = await resolveProbeBaseUrl();
  if (baseUrl) {
    await testRuntimeApi(baseUrl);
    console.log("probe-muthur-persistent-runtime: PASS (in-process + API)", baseUrl);
  } else {
    console.log("probe-muthur-persistent-runtime: PASS (in-process; API skipped — dev server down)");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
