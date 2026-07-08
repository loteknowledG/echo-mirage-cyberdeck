import { expect, type Page } from "@playwright/test";

export const DECK_COMMAND_INPUT =
  'input[placeholder*="GATEWAY"], input[placeholder*="command"], input[placeholder*="COMMAND"]';

export const COMPOSER = ".cyberdeck-chat-app > .cyberdeck-message-box";

export async function openCyberdeck(page: Page, options?: { cleanState?: boolean }) {
  if (options?.cleanState !== false) {
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
  }
  try {
    await page.goto("/cyberdeck", { waitUntil: "load", timeout: 120000 });
  } catch {
    await page.goto("/cyberdeck", { waitUntil: "domcontentloaded", timeout: 120000 });
  }
  await page.waitForSelector("cyberdeck-rail-tab", { timeout: 200000 });
  const response = await page.reload({ waitUntil: "domcontentloaded" });
  expect(response).not.toBeNull();
  expect(response!.status()).toBeLessThan(500);
  await skipBootScreen(page);
  await expect(page.locator(COMPOSER)).toBeVisible({ timeout: 10000 });
}

export async function skipBootScreen(page: Page) {
  const skipBoot = page.getByRole("button", { name: "Skip" });
  if (await skipBoot.isVisible().catch(() => false)) {
    await skipBoot.click({ force: true });
    await skipBoot.click({ force: true }).catch(() => undefined);
    await page.waitForTimeout(300);
  }
}

export async function sendDeckCommand(page: Page, text: string) {
  const input = page.locator(DECK_COMMAND_INPUT).first();
  await input.waitFor({ state: "visible", timeout: 30000 });
  await expect(input).toBeEnabled({ timeout: 10000 });
  await input.click();
  await input.fill(text);
  await input.press("Enter");
}

export async function createCustomTab(page: Page, label: string, glyph: string) {
  await sendDeckCommand(page, `new tab named ${label} glyph ${glyph}`);
  await expect(page.getByText(`TAB_CREATED // ${label} // GLYPH ${glyph}`)).toBeVisible({
    timeout: 10000,
  });
  const customTab = page.locator("cyberdeck-rail-tab").nth(3);
  await expect(customTab).toBeVisible({ timeout: 10000 });
  return customTab;
}
