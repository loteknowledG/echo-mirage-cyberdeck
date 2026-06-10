import { randomUUID } from "node:crypto";
import { getMuthurExecutionLoop } from "@/lib/muthur/execution/execution-loop";
import type { MuthurPatrolCheck, MuthurPatrolReceipt } from "./runtime-types";

const DEFAULT_BASE_URL = process.env.MUTHUR_VERIFY_BASE_URL?.trim() || "http://127.0.0.1:3050";

async function devServerReachable(baseUrl: string): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl}/api/muthur/runtime`, { cache: "no-store" });
    return res.ok;
  } catch {
    return false;
  }
}

export async function runMuthurHealthPatrol(taskLabel = "runtime-patrol"): Promise<MuthurPatrolReceipt> {
  const startedAt = new Date().toISOString();
  const checks: MuthurPatrolCheck[] = [];
  const loop = getMuthurExecutionLoop();
  loop.setMode("execute");

  const tscCreated = loop.enqueue(
    [
      {
        type: "shell_command",
        source: "system",
        payload: { command: "pnpm exec tsc --noEmit" },
      },
    ],
    { taskLabel: `${taskLabel}-tsc` },
  );
  await loop.waitForIdle(180_000);
  const tscResult = loop
    .getState()
    .completed_actions.find((action) => action.id === tscCreated[0]?.id);
  const tscPassed = tscResult?.status === "completed" && tscResult.result?.success === true;
  checks.push({
    check: "tsc",
    passed: tscPassed,
    message: tscPassed
      ? "Typecheck passed."
      : tscResult?.error || tscResult?.result?.stderr || "Typecheck failed.",
  });

  let routeReceiptPath: string | undefined;
  const serverUp = await devServerReachable(DEFAULT_BASE_URL);
  if (!serverUp) {
    checks.push({
      check: "route_cyberdeck",
      passed: false,
      message: `Dev server not reachable at ${DEFAULT_BASE_URL} — route verify skipped.`,
    });
  } else {
    const verifyCreated = loop.enqueue(
      [
        {
          type: "open_url",
          source: "system",
          payload: {
            route: "/cyberdeck",
            base_url: DEFAULT_BASE_URL,
            verify_after: true,
            wait_for_selector: "cyberdeck-rail-tab",
            screenshot_label: `patrol-${Date.now()}`,
          },
        },
      ],
      { taskLabel: `${taskLabel}-verify-cyberdeck` },
    );
    await loop.waitForIdle(180_000);
    const verifyResult = loop
      .getState()
      .completed_actions.find((action) => action.id === verifyCreated[0]?.id);
    const routePassed =
      verifyResult?.status === "verified" ||
      (verifyResult?.status === "completed" && verifyResult.result?.success === true);
    routeReceiptPath = verifyResult?.receipt_path;
    checks.push({
      check: "route_cyberdeck",
      passed: routePassed,
      message: routePassed
        ? "Route /cyberdeck verified."
        : verifyResult?.error || verifyResult?.result?.verification_notes || "Route verify failed.",
    });
  }

  const passed = checks.every((check) => check.passed);
  return {
    id: randomUUID(),
    started_at: startedAt,
    completed_at: new Date().toISOString(),
    passed,
    checks,
    task_label: taskLabel,
    receipt_path: routeReceiptPath,
  };
}
