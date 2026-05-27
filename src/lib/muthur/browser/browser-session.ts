import { promises as fs } from "node:fs";
import path from "node:path";

import { DEFAULT_BROWSER_BASE_URL, validateBrowserUrl } from "./browser-policy";

// Playwright is optional at runtime (see src/types/playwright-optional.d.ts).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Browser = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Page = any;

export type BrowserConsoleEntry = {
  message: string;
  source: string;
  severity: "error" | "warning" | "info";
  timestamp: string;
};

export type BrowserScreenshotResult = {
  screenshot_path: string;
  width: number;
  height: number;
  captured_at: string;
};

export type BrowserNavigationSnapshot = {
  url: string;
  title: string;
  status: number;
  console_entries: BrowserConsoleEntry[];
  body_text_excerpt: string;
  screenshot?: BrowserScreenshotResult;
  base_url: string;
  route?: string;
  navigated_at: string;
};

export const MUTHUR_SCREENSHOT_DIR = path.join(process.cwd(), ".muthur", "screenshots");

let browserInstance: Browser | null = null;
let pageInstance: Page | null = null;
let lastSnapshot: BrowserNavigationSnapshot | null = null;
let sessionConsoleEntries: BrowserConsoleEntry[] = [];

async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch {
    throw new Error(
      "Playwright is not available. Install with: pnpm exec playwright install chromium",
    );
  }
}

function pushConsoleEntry(message: string, severity: BrowserConsoleEntry["severity"], source: string) {
  sessionConsoleEntries.push({
    message,
    source,
    severity,
    timestamp: new Date().toISOString(),
  });
}

export function getActivePageUrl(): string | null {
  return lastSnapshot?.url ?? null;
}

export function getLastBrowserSnapshot(): BrowserNavigationSnapshot | null {
  return lastSnapshot;
}

export function getSessionConsoleEntries(): BrowserConsoleEntry[] {
  return [...sessionConsoleEntries];
}

export function getSessionConsoleErrors(): BrowserConsoleEntry[] {
  return sessionConsoleEntries.filter((entry) => entry.severity === "error");
}

export async function closeBrowserSession(): Promise<void> {
  if (browserInstance) {
    await browserInstance.close().catch(() => undefined);
  }
  browserInstance = null;
  pageInstance = null;
  lastSnapshot = null;
  sessionConsoleEntries = [];
}

async function ensurePage(): Promise<Page> {
  if (pageInstance) return pageInstance;
  const { chromium } = await loadPlaywright();
  const browser = await chromium.launch({ headless: true });
  browserInstance = browser;
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  pageInstance = page;
  sessionConsoleEntries = [];
  page.on("console", (msg: { type(): string; text(): string; location(): { url?: string } }) => {
    const type = msg.type();
    const severity: BrowserConsoleEntry["severity"] =
      type === "error" ? "error" : type === "warning" ? "warning" : "info";
    if (severity === "error" || severity === "warning") {
      pushConsoleEntry(msg.text(), severity, msg.location().url || "console");
    }
  });
  page.on("pageerror", (error: { message: string }) => {
    pushConsoleEntry(error.message, "error", "pageerror");
  });
  return page;
}

export async function openRoute(options: {
  route?: string;
  url?: string;
  base_url?: string;
  capture_screenshot?: boolean;
  screenshot_label?: string;
  wait_for_selector?: string;
}): Promise<BrowserNavigationSnapshot> {
  const baseUrl = options.base_url?.trim() || DEFAULT_BROWSER_BASE_URL;
  const target = options.url?.trim() || options.route?.trim() || "/";
  const validation = validateBrowserUrl(target, baseUrl);
  if (!validation.ok) {
    throw new Error(validation.reason);
  }

  const page = await ensurePage();
  sessionConsoleEntries = [];

  const response = await page.goto(validation.url, { waitUntil: "domcontentloaded", timeout: 45_000 });
  if (options.wait_for_selector) {
    await page.locator(options.wait_for_selector).waitFor({ state: "visible", timeout: 20_000 }).catch(() => undefined);
  }

  let screenshot: BrowserScreenshotResult | undefined;
  if (options.capture_screenshot !== false) {
    screenshot = await captureScreenshot(options.screenshot_label || "navigation");
  }

  const bodyText = await page.locator("body").innerText().catch(() => "");
  const snapshot: BrowserNavigationSnapshot = {
    url: page.url(),
    title: await page.title(),
    status: response?.status() ?? 0,
    console_entries: [...sessionConsoleEntries],
    body_text_excerpt: bodyText.slice(0, 4000),
    screenshot,
    base_url: baseUrl,
    route: options.route,
    navigated_at: new Date().toISOString(),
  };
  lastSnapshot = snapshot;
  return snapshot;
}

export async function captureScreenshot(label: string): Promise<BrowserScreenshotResult> {
  const page = await ensurePage();
  await fs.mkdir(MUTHUR_SCREENSHOT_DIR, { recursive: true });
  const safeLabel = label.replace(/[^\w.-]+/g, "_").slice(0, 48);
  const filePath = path.join(MUTHUR_SCREENSHOT_DIR, `${safeLabel}-${Date.now()}.png`);
  await page.screenshot({ path: filePath, fullPage: false });
  const viewport = page.viewportSize();
  const captured: BrowserScreenshotResult = {
    screenshot_path: filePath,
    width: viewport?.width ?? 0,
    height: viewport?.height ?? 0,
    captured_at: new Date().toISOString(),
  };
  if (lastSnapshot) {
    lastSnapshot = { ...lastSnapshot, screenshot: captured };
  }
  return captured;
}

export async function checkSelectorVisible(selector: string): Promise<boolean> {
  const page = await ensurePage();
  return page.locator(selector).first().isVisible().catch(() => false);
}

export function screenshotPreviewName(filePath: string): string {
  return path.basename(filePath);
}
