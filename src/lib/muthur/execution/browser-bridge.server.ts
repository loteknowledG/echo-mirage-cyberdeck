/** @deprecated Import from `@/lib/muthur/browser/index.server` — L-12 bridge re-export */
export {
  captureScreenshot,
  checkSelectorVisible,
  closeBrowserSession,
  getActivePageUrl,
  getLastBrowserSnapshot,
  getSessionConsoleEntries,
  getSessionConsoleErrors,
  MUTHUR_SCREENSHOT_DIR,
  openRoute,
  screenshotPreviewName,
  type BrowserConsoleEntry,
  type BrowserNavigationSnapshot,
  type BrowserScreenshotResult,
} from "@/lib/muthur/browser/browser-session";

export {
  APPROVED_VERIFICATION_ROUTES,
  DEFAULT_BROWSER_BASE_URL,
  isApprovedVerificationRoute,
  validateBrowserUrl,
} from "@/lib/muthur/browser/browser-policy";
