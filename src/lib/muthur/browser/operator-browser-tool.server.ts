import { normalizeOperatorBrowserUrl } from "@/lib/browser-intents";
import { loadPlaywright } from "./load-playwright.server";

export type OperatorBrowserLiveSnapshot = {
  url: string;
  title: string;
  pageText: string;
  status: number;
};

export type OperatorBrowserLiveResult =
  | { ok: true; snapshot: OperatorBrowserLiveSnapshot }
  | { ok: false; error: string };

// Playwright is optional at runtime (see src/types/playwright-optional.d.ts).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Browser = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Page = any;

let researchBrowser: Browser | null = null;
let researchPage: Page | null = null;
let lastLiveSnapshot: OperatorBrowserLiveSnapshot | null = null;

function validateResearchUrl(raw: string): { ok: true; url: string } | { ok: false; error: string } {
  const normalized = normalizeOperatorBrowserUrl(raw);
  try {
    const parsed = new URL(normalized);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { ok: false, error: `Unsupported URL scheme: ${parsed.protocol}` };
    }
    return { ok: true, url: parsed.href };
  } catch {
    return { ok: false, error: `Invalid browser URL: ${raw}` };
  }
}

async function ensureResearchPage(): Promise<Page> {
  if (researchPage) return researchPage;
  const { chromium } = await loadPlaywright();
  researchBrowser = await chromium.launch({ headless: true });
  const context = await researchBrowser.newContext({ viewport: { width: 1280, height: 720 } });
  researchPage = await context.newPage();
  return researchPage;
}

async function readLiveSnapshot(page: Page, status = 200): Promise<OperatorBrowserLiveSnapshot> {
  const bodyText = await page.locator("body").innerText().catch(() => "");
  const snapshot: OperatorBrowserLiveSnapshot = {
    url: page.url(),
    title: await page.title().catch(() => ""),
    pageText: bodyText.slice(0, 6000),
    status,
  };
  lastLiveSnapshot = snapshot;
  return snapshot;
}

async function gotoLive(url: string): Promise<OperatorBrowserLiveResult> {
  const validated = validateResearchUrl(url);
  if (!validated.ok) {
    return { ok: false, error: validated.error };
  }

  try {
    const page = await ensureResearchPage();
    const response = await page.goto(validated.url, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await page.waitForTimeout(1_200);
    const snapshot = await readLiveSnapshot(page, response?.status() ?? 200);
    if (!snapshot.pageText.trim()) {
      return {
        ok: false,
        error:
          "Page loaded but returned no readable text (CAPTCHA, JS-only shell, or blocked). Answer from training knowledge; do not retry snapshot.",
      };
    }
    return { ok: true, snapshot };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Browser navigation failed.";
    return { ok: false, error: message };
  }
}

async function snapshotLive(): Promise<OperatorBrowserLiveResult> {
  try {
    const page = researchPage ?? (await ensureResearchPage().catch(() => null));
    if (!page) {
      if (lastLiveSnapshot?.pageText.trim()) {
        return { ok: true, snapshot: lastLiveSnapshot };
      }
      return {
        ok: false,
        error: "No browser page is open. Call operator_browser goto first, or answer without browser.",
      };
    }
    const snapshot = await readLiveSnapshot(page);
    if (!snapshot.pageText.trim()) {
      return {
        ok: false,
        error:
          "Snapshot has no readable page text. Answer from training knowledge; do not retry operator_browser snapshot.",
      };
    }
    return { ok: true, snapshot };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Browser snapshot failed.";
    return { ok: false, error: message };
  }
}

export async function executeOperatorBrowserLiveAction(
  action: string,
  args: Record<string, unknown>,
): Promise<OperatorBrowserLiveResult> {
  const kind = action.toLowerCase() || "goto";

  if (kind === "goto") {
    const url =
      (typeof args.url === "string" ? args.url.trim() : "") ||
      (typeof args.query === "string" ? args.query.trim() : "");
    if (!url) {
      return { ok: false, error: "operator_browser goto requires url or query." };
    }
    return gotoLive(url);
  }

  if (kind === "snapshot") {
    return snapshotLive();
  }

  if (kind === "back") {
    const page = researchPage;
    if (!page?.goBack) {
      return lastLiveSnapshot
        ? { ok: true, snapshot: lastLiveSnapshot }
        : { ok: false, error: "No browser session for back." };
    }
    await page.goBack({ waitUntil: "domcontentloaded", timeout: 30_000 }).catch(() => undefined);
    await page.waitForTimeout(800);
    return snapshotLive();
  }

  if (kind === "forward") {
    const page = researchPage;
    if (!page?.goForward) {
      return lastLiveSnapshot
        ? { ok: true, snapshot: lastLiveSnapshot }
        : { ok: false, error: "No browser session for forward." };
    }
    await page.goForward({ waitUntil: "domcontentloaded", timeout: 30_000 }).catch(() => undefined);
    await page.waitForTimeout(800);
    return snapshotLive();
  }

  if (kind === "reload") {
    const page = researchPage;
    if (!page?.reload) {
      return lastLiveSnapshot
        ? { ok: true, snapshot: lastLiveSnapshot }
        : { ok: false, error: "No browser session for reload." };
    }
    await page.reload({ waitUntil: "domcontentloaded", timeout: 30_000 }).catch(() => undefined);
    await page.waitForTimeout(800);
    return snapshotLive();
  }

  // click/type/submit stay client-queued; server does not simulate DOM interaction here.
  return {
    ok: false,
    error: `Live fetch is not available for operator_browser action "${kind}" during tool rounds.`,
  };
}
