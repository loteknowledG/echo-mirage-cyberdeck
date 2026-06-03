type PlaywrightModule = typeof import("playwright");

export async function loadPlaywright(): Promise<PlaywrightModule> {
  try {
    return await import(/* webpackIgnore: true */ "playwright");
  } catch {
    throw new Error(
      "Playwright is not available. Install with: pnpm exec playwright install chromium",
    );
  }
}
