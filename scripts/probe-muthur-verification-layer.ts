import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import {
  closeBrowserSession,
  getMuthurExecutionLoop,
  resetMuthurExecutionLoopForTests,
  resetMuthurExecutionStoreForTests,
} from "../src/lib/muthur/execution/index.server";

async function devServerUp(baseUrl: string): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl}/api/muthur/execution`, { cache: "no-store" });
    return res.ok;
  } catch {
    return false;
  }
}

async function main() {
  const baseUrl = process.env.MUTHUR_VERIFY_BASE_URL ?? "http://127.0.0.1:3050";
  const up = await devServerUp(baseUrl);
  if (!up) {
    console.log("probe-muthur-verification-layer: SKIP (dev server not reachable)");
    process.exit(0);
  }

  resetMuthurExecutionStoreForTests();
  resetMuthurExecutionLoopForTests();
  await closeBrowserSession();

  const res = await fetch(`${baseUrl}/api/muthur/execution`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      op: "verify_route",
      route: "/cyberdeck",
      base_url: baseUrl,
      mode: "execute",
      wait: true,
      taskLabel: "probe-verify-cyberdeck",
    }),
  });
  const data = (await res.json()) as {
    ok?: boolean;
    results?: Array<{ status?: string; verification?: { passed?: boolean }; receipt_path?: string }>;
  };
  assert.equal(res.ok, true);
  assert.equal(data.ok, true);
  const result = data.results?.[0];
  assert.ok(result);
  assert.equal(result.status, "verified");
  assert.equal(result.verification?.passed, true);
  assert.ok(result.receipt_path);
  await fs.access(result.receipt_path!);

  const shellOnly = await fetch(`${baseUrl}/api/muthur/execution`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      op: "enqueue",
      mode: "execute",
      wait: true,
      actions: [{ type: "shell_command", source: "system", payload: { command: "git status --short" } }],
    }),
  });
  const shellData = (await shellOnly.json()) as { results?: Array<{ status?: string }> };
  assert.equal(shellData.results?.[0]?.status, "completed");

  console.log("probe-muthur-verification-layer: PASS");
  await closeBrowserSession();
}

main().catch(async (error) => {
  console.error(error);
  await closeBrowserSession();
  process.exit(1);
});
