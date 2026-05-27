import { promises as fs } from "node:fs";
import path from "node:path";
import { normalizeVerificationRoute, urlMatchesRoute } from "@/lib/muthur/browser/browser-policy";
import {
  captureScreenshot,
  checkSelectorVisible,
  getLastBrowserSnapshot,
  getSessionConsoleErrors,
  openRoute,
  type BrowserNavigationSnapshot,
} from "@/lib/muthur/browser/browser-session";
import type { VerifyCheckResult, VerifyConditionPayload, VerificationOutcome } from "./verification-types";
import { DEFAULT_VERIFICATION_BASE_URL } from "./verification-types";

function screenshotPath(snapshot: BrowserNavigationSnapshot | null | undefined): string | undefined {
  return snapshot?.screenshot?.screenshot_path;
}

function snapshotMatchesRoute(
  snapshot: BrowserNavigationSnapshot | null | undefined,
  route: string | undefined,
): boolean {
  if (!snapshot || !route) return Boolean(snapshot);
  return urlMatchesRoute(snapshot.url, route);
}

async function ensureSnapshotForRoute(options: {
  route: string;
  baseUrl: string;
  capture_screenshot?: boolean;
  wait_for_selector?: string;
  screenshot_label?: string;
}): Promise<BrowserNavigationSnapshot> {
  const route = normalizeVerificationRoute(options.route);
  const snapshot = getLastBrowserSnapshot();
  if (snapshot && snapshotMatchesRoute(snapshot, route)) {
    return snapshot;
  }
  return openRoute({
    route,
    base_url: options.baseUrl,
    capture_screenshot: options.capture_screenshot ?? true,
    wait_for_selector: options.wait_for_selector,
    screenshot_label: options.screenshot_label ?? `verify-${route.replace(/\W+/g, "_")}`,
  });
}

async function checkApiReturns200(apiPath: string, baseUrl: string): Promise<VerifyCheckResult> {
  const url = apiPath.startsWith("http") ? apiPath : `${baseUrl.replace(/\/$/, "")}${apiPath.startsWith("/") ? apiPath : `/${apiPath}`}`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    return {
      check: "api_returns_200",
      passed: res.status >= 200 && res.status < 300,
      message: res.ok ? `API ${url} returned ${res.status}` : `API ${url} returned ${res.status}`,
      metadata: { url, status: res.status },
    };
  } catch (error) {
    return {
      check: "api_returns_200",
      passed: false,
      message: error instanceof Error ? error.message : "API request failed.",
      metadata: { url },
    };
  }
}

export async function runVerifyCondition(payload: VerifyConditionPayload): Promise<VerifyCheckResult> {
  const baseUrl = payload.base_url?.trim() || DEFAULT_VERIFICATION_BASE_URL;
  const route = payload.route ? normalizeVerificationRoute(payload.route) : undefined;

  switch (payload.check) {
    case "route_loads": {
      const expectStatus = payload.expect_status ?? 200;
      const targetRoute = normalizeVerificationRoute(payload.route ?? payload.url ?? "/");
      const nav = await ensureSnapshotForRoute({
        route: targetRoute,
        baseUrl,
        capture_screenshot: true,
        screenshot_label: `route-${targetRoute.replace(/\W+/g, "_")}`,
      });
      const statusOk = nav.status >= 200 && nav.status < 400;
      const routeOk = payload.route ? urlMatchesRoute(nav.url, targetRoute) : true;
      const passed = statusOk && routeOk && nav.status === expectStatus;
      return {
        check: "route_loads",
        passed,
        message: passed
          ? `Route loaded (${nav.status}) ${nav.url}`
          : `Route failed status=${nav.status} url=${nav.url} expected=${targetRoute}`,
        evidence_path: nav.screenshot?.screenshot_path,
        metadata: { url: nav.url, title: nav.title, status: nav.status, route: targetRoute },
      };
    }

    case "text_exists": {
      const text = payload.text?.trim();
      if (!text) {
        return { check: "text_exists", passed: false, message: "text_exists requires text." };
      }
      const targetRoute = normalizeVerificationRoute(payload.route ?? "/");
      let nav = getLastBrowserSnapshot();
      if (!nav || !snapshotMatchesRoute(nav, targetRoute)) {
        nav = await openRoute({
          route: targetRoute,
          base_url: baseUrl,
          capture_screenshot: true,
          wait_for_selector: targetRoute === "/cyberdeck" ? "cyberdeck-rail-tab" : undefined,
        });
      }
      let body = nav.body_text_excerpt;
      if (!body.toLowerCase().includes(text.toLowerCase())) {
        nav = await openRoute({
          route: targetRoute,
          base_url: baseUrl,
          capture_screenshot: true,
          wait_for_selector: targetRoute === "/cyberdeck" ? "cyberdeck-rail-tab" : undefined,
        });
        body = nav.body_text_excerpt;
      }
      const passed = body.toLowerCase().includes(text.toLowerCase());
      return {
        check: "text_exists",
        passed,
        message: passed ? `Found text "${text}"` : `Text not found: "${text}"`,
        evidence_path: screenshotPath(nav),
        metadata: { text, excerpt: body.slice(0, 400), url: nav.url, route: targetRoute },
      };
    }

    case "button_visible": {
      const selector = payload.selector?.trim();
      if (!selector) {
        return { check: "button_visible", passed: false, message: "button_visible requires selector." };
      }
      const targetRoute = route ?? normalizeVerificationRoute(payload.route ?? "/");
      if (!snapshotMatchesRoute(getLastBrowserSnapshot(), targetRoute)) {
        await openRoute({
          route: targetRoute,
          base_url: baseUrl,
          capture_screenshot: true,
          wait_for_selector: selector,
        });
      }
      const visible = await checkSelectorVisible(selector);
      return {
        check: "button_visible",
        passed: visible,
        message: visible ? `Selector visible: ${selector}` : `Selector not visible: ${selector}`,
        evidence_path: screenshotPath(getLastBrowserSnapshot()),
        metadata: { selector, route: targetRoute },
      };
    }

    case "no_console_errors": {
      const max = payload.max_console_errors ?? 0;
      const snapshot = getLastBrowserSnapshot();
      const errors = snapshot?.console_entries.filter((entry) => entry.severity === "error") ?? getSessionConsoleErrors();
      const passed = errors.length <= max;
      return {
        check: "no_console_errors",
        passed,
        message: passed
          ? `Console errors ${errors.length} <= ${max}`
          : `Console errors ${errors.length} > ${max}: ${errors.slice(0, 3).map((entry) => entry.message).join(" | ")}`,
        metadata: {
          count: errors.length,
          errors: errors.slice(0, 20).map((entry) => ({
            message: entry.message,
            source: entry.source,
            severity: entry.severity,
            timestamp: entry.timestamp,
          })),
        },
      };
    }

    case "screenshot_captured": {
      const snapshot = getLastBrowserSnapshot();
      let screenshotPathValue = payload.screenshot_path || screenshotPath(snapshot);
      if (!screenshotPathValue) {
        const captured = await captureScreenshot("verify");
        screenshotPathValue = captured.screenshot_path;
      }
      let exists = false;
      try {
        await fs.access(screenshotPathValue);
        exists = true;
      } catch {
        exists = false;
      }
      return {
        check: "screenshot_captured",
        passed: exists,
        message: exists ? `Screenshot saved: ${screenshotPathValue}` : "Screenshot missing.",
        evidence_path: exists ? screenshotPathValue : undefined,
        metadata: { screenshot_path: screenshotPathValue },
      };
    }

    case "api_returns_200": {
      const apiPath = payload.api_path?.trim() || payload.route?.trim() || "/api/muthur/execution";
      return checkApiReturns200(apiPath, baseUrl);
    }

    default:
      return {
        check: payload.check,
        passed: false,
        message: `Unknown verification check: ${String(payload.check)}`,
      };
  }
}

export async function runVerifyConditions(checks: VerifyConditionPayload[]): Promise<VerificationOutcome> {
  const results: VerifyCheckResult[] = [];
  for (const check of checks) {
    results.push(await runVerifyCondition(check));
  }
  const evidence_paths = results
    .map((item) => item.evidence_path)
    .filter((item): item is string => Boolean(item));
  return {
    passed: results.every((item) => item.passed),
    checks: results,
    evidence_paths: [...new Set(evidence_paths)],
  };
}

export function buildRouteVerificationChecks(route = "/"): VerifyConditionPayload[] {
  return [
    { check: "route_loads", route, expect_status: 200 },
    { check: "no_console_errors", max_console_errors: 0 },
    { check: "screenshot_captured" },
  ];
}

export function buildCyberdeckRouteVerificationChecks(route = "/cyberdeck"): VerifyConditionPayload[] {
  return [
    { check: "route_loads", route, expect_status: 200 },
    { check: "text_exists", text: "Memory Atlas", route },
    { check: "button_visible", selector: "cyberdeck-rail-tab", route },
    { check: "no_console_errors", max_console_errors: 0 },
    { check: "screenshot_captured" },
    { check: "api_returns_200", api_path: "/api/muthur/execution" },
  ];
}

export async function verifyCyberdeckRoute(baseUrl?: string): Promise<VerificationOutcome> {
  await openRoute({
    route: "/cyberdeck",
    base_url: baseUrl,
    capture_screenshot: true,
    wait_for_selector: "cyberdeck-rail-tab",
    screenshot_label: "cyberdeck-load",
  });
  return runVerifyConditions(buildCyberdeckRouteVerificationChecks("/cyberdeck"));
}
