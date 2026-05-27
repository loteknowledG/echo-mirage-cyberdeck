import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  closeBrowserSession,
  getMuthurExecutionLoop,
  resetMuthurExecutionLoopForTests,
  resetMuthurExecutionStoreForTests,
} from "../src/lib/muthur/execution/index.server";
import { MUTHUR_SCREENSHOT_DIR } from "../src/lib/muthur/browser/browser-session";

const RECEIPTS_JSONL = path.join(process.cwd(), ".muthur", "logs", "verification-receipts.jsonl");
const SAFETY_JSONL = path.join(process.cwd(), ".muthur", "logs", "safety-events.jsonl");

async function devServerUp(baseUrl: string): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl}/api/muthur/execution`, { cache: "no-store" });
    return res.ok;
  } catch {
    return false;
  }
}

async function postExecution(baseUrl: string, body: Record<string, unknown>) {
  const res = await fetch(`${baseUrl}/api/muthur/execution`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as Record<string, unknown>;
  assert.equal(res.ok, true, JSON.stringify(data));
  return data;
}

async function main() {
  const baseUrl = process.env.MUTHUR_VERIFY_BASE_URL ?? "http://127.0.0.1:3050";
  const up = await devServerUp(baseUrl);
  if (!up) {
    console.log("probe-muthur-browser-verification: SKIP (dev server not reachable at", baseUrl, ")");
    process.exit(0);
  }

  resetMuthurExecutionStoreForTests();
  resetMuthurExecutionLoopForTests();
  await closeBrowserSession();

  const openData = await postExecution(baseUrl, {
    op: "enqueue",
    mode: "execute",
    wait: true,
    taskLabel: "probe-browser-open-url",
    actions: [
      {
        type: "open_url",
        source: "probe",
        payload: { route: "/cyberdeck", base_url: baseUrl, screenshot_label: "probe-open-url" },
      },
    ],
  });
  const openResult = (openData.results as Array<{ status?: string; result?: { screenshot_path?: string } }>)?.[0];
  assert.ok(openResult);
  assert.equal(openResult.status, "completed");
  assert.ok(openResult.result?.screenshot_path);
  await fs.access(openResult.result!.screenshot_path!);
  const pngHeader = await fs.readFile(openResult.result!.screenshot_path!);
  assert.equal(pngHeader[0], 0x89);
  assert.equal(String.fromCharCode(pngHeader[1], pngHeader[2], pngHeader[3]), "PNG");

  const screenshotData = await postExecution(baseUrl, {
    op: "enqueue",
    mode: "execute",
    wait: true,
    actions: [{ type: "screenshot", source: "probe", payload: { label: "probe-screenshot" } }],
  });
  const screenshotResult = (screenshotData.results as Array<{ result?: { screenshot_path?: string; metadata?: { screenshot?: { width?: number; height?: number; captured_at?: string } } } }>)?.[0];
  assert.ok(screenshotResult?.result?.screenshot_path);
  assert.ok(screenshotResult.result?.metadata?.screenshot?.captured_at);
  assert.ok(screenshotResult.result?.metadata?.screenshot?.width);

  const remoteData = await postExecution(baseUrl, {
    op: "enqueue",
    mode: "execute",
    wait: true,
    actions: [{ type: "open_url", source: "probe", payload: { url: "https://example.com" } }],
  });
  const remoteResult = (remoteData.results as Array<{ status?: string; result?: { success?: boolean } }>)?.[0];
  assert.equal(remoteResult?.status, "failed");
  assert.equal(remoteResult?.result?.success, false);
  const safetyLog = await fs.readFile(SAFETY_JSONL, "utf8").catch(() => "");
  assert.match(safetyLog, /browser_url_blocked/);

  const verifyData = await postExecution(baseUrl, {
    op: "verify_route",
    route: "/cyberdeck",
    base_url: baseUrl,
    mode: "execute",
    wait: true,
    taskLabel: "probe-browser-verify-receipt",
  });
  const verifyResult = (verifyData.results as Array<{ status?: string; receipt_path?: string }>)?.[0];
  assert.equal(verifyResult?.status, "verified");
  assert.ok(verifyResult?.receipt_path);
  await fs.access(verifyResult!.receipt_path!);
  const receiptsLog = await fs.readFile(RECEIPTS_JSONL, "utf8");
  assert.match(receiptsLog, /probe-browser-verify-receipt|verify_route|verified/);

  const verifyLoadedData = await postExecution(baseUrl, {
    op: "enqueue",
    mode: "execute",
    wait: true,
    actions: [
      {
        type: "verify_route_loaded",
        source: "probe",
        payload: { route: "/cyberdeck", base_url: baseUrl },
      },
    ],
  });
  const verifyLoaded = (verifyLoadedData.results as Array<{ status?: string }>)?.[0];
  assert.equal(verifyLoaded?.status, "verified");

  const verifyTextData = await postExecution(baseUrl, {
    op: "enqueue",
    mode: "execute",
    wait: true,
    actions: [
      {
        type: "verify_page_text",
        source: "probe",
        payload: { route: "/cyberdeck", text: "Memory Atlas", base_url: baseUrl },
      },
    ],
  });
  const verifyText = (verifyTextData.results as Array<{ status?: string }>)?.[0];
  assert.equal(verifyText?.status, "verified");

  async function verifyApprovedRoute(route: string, taskLabel: string) {
    const data = await postExecution(baseUrl, {
      op: "verify_route",
      route,
      base_url: baseUrl,
      mode: "execute",
      wait: true,
      taskLabel,
    });
    const result = (data.results as Array<{ status?: string; receipt_path?: string; verification?: { passed?: boolean; checks?: Array<{ check?: string; passed?: boolean }> } }>)?.[0];
    assert.ok(result?.receipt_path, `missing receipt for ${route}`);
    await fs.access(result!.receipt_path!);
    const receipt = JSON.parse(await fs.readFile(result!.receipt_path!, "utf8")) as {
      url?: string;
      verification_passed?: boolean;
      verification?: { passed?: boolean; checks?: Array<{ check?: string; passed?: boolean }> };
    };
    assert.ok(receipt.url, `missing receipt url for ${route}`);
    const pathname = new URL(receipt.url!).pathname.replace(/\/+$/, "") || "/";
    return { route, result, receipt, pathname };
  }

  const cyberdeckRoute = await verifyApprovedRoute("/cyberdeck", "probe-b6-cyberdeck");
  assert.equal(cyberdeckRoute.result?.status, "verified");
  assert.equal(cyberdeckRoute.pathname, "/cyberdeck");

  const previewRoute = await verifyApprovedRoute("/preview", "probe-b6-preview");
  assert.ok(previewRoute.result?.status === "verified" || previewRoute.result?.status === "verification_failed");
  if (previewRoute.result?.status === "verified") {
    assert.equal(previewRoute.pathname, "/preview");
  }

  // `/` redirects to `/cyberdeck` in src/app/page.tsx — honest verification_failed is correct.
  const rootRoute = await verifyApprovedRoute("/", "probe-b6-root");
  assert.equal(rootRoute.result?.status, "verification_failed");
  assert.equal(rootRoute.pathname, "/cyberdeck");
  const routeLoads = rootRoute.receipt.verification?.checks?.find((check) => check.check === "route_loads");
  assert.equal(routeLoads?.passed, false);
  assert.notEqual(rootRoute.pathname, "/");

  const consoleData = await postExecution(baseUrl, {
    op: "enqueue",
    mode: "execute",
    wait: true,
    actions: [{ type: "get_console_errors", source: "probe", payload: {} }],
  });
  const consoleResult = (consoleData.results as Array<{ result?: { metadata?: { entries?: unknown[] } } }>)?.[0];
  assert.ok(Array.isArray(consoleResult?.result?.metadata?.entries));

  const clickData = await postExecution(baseUrl, {
    op: "enqueue",
    mode: "execute",
    wait: true,
    actions: [{ type: "click", source: "probe", payload: { selector: "button" } }],
  });
  const clickResult = (clickData.results as Array<{ status?: string; result?: { metadata?: { status?: string } } }>)?.[0];
  assert.equal(clickResult?.status, "unsupported");
  assert.equal(clickResult?.result?.metadata?.status, "unsupported");

  await fs.mkdir(MUTHUR_SCREENSHOT_DIR, { recursive: true });
  const screenshots = await fs.readdir(MUTHUR_SCREENSHOT_DIR);
  assert.ok(screenshots.some((name) => name.endsWith(".png")));

  console.log("probe-muthur-browser-verification: PASS");
  console.log("screenshot_dir:", MUTHUR_SCREENSHOT_DIR);
  console.log("latest_screenshot:", screenshots.at(-1));
  await closeBrowserSession();
}

main().catch(async (error) => {
  console.error(error);
  await closeBrowserSession();
  process.exit(1);
});
