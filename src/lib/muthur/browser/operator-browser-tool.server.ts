import { normalizeOperatorBrowserUrl } from "@/lib/browser-intents";
import {
  firecrawlResearchGoto,
  isFirecrawlConfigured,
} from "@/lib/muthur/browser/firecrawl-research.server";
import type {
  OperatorBrowserLiveResult,
  OperatorBrowserLiveSnapshot,
} from "@/lib/muthur/browser/operator-browser-live.types";
import { loadPlaywright } from "./load-playwright.server";

export type { OperatorBrowserLiveResult, OperatorBrowserLiveSnapshot } from "./operator-browser-live.types";

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
    engine: "playwright",
  };
  lastLiveSnapshot = snapshot;
  return snapshot;
}

async function gotoLivePlaywright(url: string): Promise<OperatorBrowserLiveResult> {
  const page = await ensureResearchPage();
  const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.waitForTimeout(1_200);
  const snapshot = await readLiveSnapshot(page, response?.status() ?? 200);
  if (!snapshot.pageText.trim()) {
    return {
      ok: false,
      error:
        "Page loaded but returned no readable text (CAPTCHA, JS-only shell, or blocked).",
    };
  }
  return { ok: true, snapshot };
}

async function snapshotLivePlaywright(): Promise<OperatorBrowserLiveResult> {
  const page = researchPage ?? (await ensureResearchPage());
  const snapshot = await readLiveSnapshot(page);
  if (!snapshot.pageText.trim()) {
    return {
      ok: false,
      error: "Snapshot has no readable page text.",
    };
  }
  return { ok: true, snapshot };
}

async function gotoLiveFirecrawl(url: string): Promise<OperatorBrowserLiveResult> {
  if (!isFirecrawlConfigured()) {
    return {
      ok: false,
      error:
        "Playwright is not available on this server. Set FIRECRAWL_API_KEY (firecrawl.dev) for live web research on Vercel.",
    };
  }

  try {
    const snapshot = await firecrawlResearchGoto(url);
    lastLiveSnapshot = snapshot;
    return { ok: true, snapshot };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Firecrawl fetch failed.";
    return { ok: false, error: message };
  }
}

async function gotoLive(url: string): Promise<OperatorBrowserLiveResult> {
  const validated = validateResearchUrl(url);
  if (!validated.ok) {
    return { ok: false, error: validated.error };
  }

  try {
    const playwright = await gotoLivePlaywright(validated.url);
    if (playwright.ok) {
      return playwright;
    }
  } catch {
    /* Playwright unavailable — fall through to Firecrawl */
  }

  return gotoLiveFirecrawl(validated.url);
}

async function snapshotLive(): Promise<OperatorBrowserLiveResult> {
  if (lastLiveSnapshot?.pageText.trim()) {
    return { ok: true, snapshot: lastLiveSnapshot };
  }

  try {
    if (researchPage) {
      return await snapshotLivePlaywright();
    }
  } catch {
    /* fall through */
  }

  return {
    ok: false,
    error:
      "No browser page is open. Call operator_browser goto first, or answer without browser.",
  };
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
