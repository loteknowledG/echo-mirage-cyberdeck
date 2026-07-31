import { expect, test } from "@playwright/test";

async function createAuditTab(page: import("@playwright/test").Page) {
  const input = page.locator('input[placeholder*="GATEWAY"], input[placeholder*="command"], input[placeholder*="COMMAND"]').first();
  await input.waitFor({ state: "visible", timeout: 10000 });
  await input.click();
  await input.fill("new tab named audit glyph A");
  await expect(input).toHaveValue("new tab named audit glyph A");
  await input.press("Enter");
  await expect(page.getByText("TAB_CREATED // audit // GLYPH A")).toBeVisible({ timeout: 10000 });
}

async function openAuditSurface(page: import("@playwright/test").Page, surface: string) {
  const auditTab = page.locator("cyberdeck-rail-tab").nth(3);
  await auditTab.waitFor({ state: "visible", timeout: 10000 });
  await auditTab.click({ button: "right" });
  await page.getByRole("menuitem", { name: surface }).click();
}

async function sendDeckCommand(page: import("@playwright/test").Page, text: string) {
  const input = page.locator('input[placeholder*="GATEWAY"], input[placeholder*="command"], input[placeholder*="COMMAND"]').first();
  await input.waitFor({ state: "visible", timeout: 10000 });
  await expect(input).toBeEnabled({ timeout: 10000 });
  await input.click();
  await input.fill(text);
  await input.press("Enter");
}

test("cyberdeck renders and switches required alpha modules", async ({ page }) => {
  try {
    await page.goto("/cyberdeck", { waitUntil: "load", timeout: 120000 });
  } catch {
    await page.goto("/cyberdeck", { waitUntil: "domcontentloaded", timeout: 120000 });
  }
  await page.waitForSelector("cyberdeck-rail-tab", { timeout: 120000 });
  const response = await page.reload({ waitUntil: "domcontentloaded" });
  expect(response).not.toBeNull();
  expect(response!.status()).toBeLessThan(500);
  const skipBoot = page.getByRole("button", { name: "Skip" });
  if (await skipBoot.isVisible().catch(() => false)) {
    await skipBoot.click();
    await expect(skipBoot).toBeHidden();
  }

  await expect(page.locator("cyberdeck-rail-tab")).toHaveCount(3, { timeout: 10000 });
  await expect(page.locator(".cyberdeck-chat-app")).toBeVisible({ timeout: 10000 });
  await expect(page.locator(".cyberdeck-chat-app > .cyberdeck-message-box")).toBeVisible({ timeout: 10000 });
  const body = page.locator("body");
  await expect(body).toContainText("Memory Atlas", { timeout: 10000 });
  await expect(body).toContainText("Flight Log", { timeout: 10000 });
  await expect(body).toContainText("Settings", { timeout: 10000 });

  await sendDeckCommand(page, "MUTHUR, indicate the command input area.");
  await expect(page.locator('[data-computer-use-indicate-marker="ring"]')).toHaveCount(1, { timeout: 5000 });
  await expect(page.locator('[data-computer-use-indicate-overlay="true"]')).toHaveCSS("pointer-events", "none");
  await expect(page.getByText("INDICATE_POINT // COMMAND_INPUT")).toBeVisible({ timeout: 10000 });

  await sendDeckCommand(page, "MUTHUR, highlight the settings panel.");
  await expect(page.locator("[data-computer-use-indicate-marker]")).toHaveCount(2, { timeout: 5000 });
  await expect(page.getByText("INDICATE_HIGHLIGHT // VOICE_LAB")).toBeVisible({ timeout: 10000 });

  await sendDeckCommand(page, "MUTHUR, clear indicators.");
  await expect(page.getByText("INDICATE_CLEAR // ACTIVE_MARKERS 0")).toBeVisible({ timeout: 10000 });
  await expect(page.locator("[data-computer-use-indicate-marker]")).toHaveCount(0, { timeout: 5000 });

  await createAuditTab(page);

  await openAuditSurface(page, "Kit");
  await expect(page.getByText("REALMORPHISM", { exact: false })).toBeVisible({ timeout: 30000 });

  await openAuditSurface(page, "Flight Log");
  await expect(page.getByText("OPERATIONS TRACE // LOCAL BUS")).toBeVisible({ timeout: 30000 });
  await expect(page.getByText("DECK :: cold start :: SUCCESS")).toBeVisible();

  await openAuditSurface(page, "Settings");
  await expect(page.getByText("DEPTH PANEL LAB")).toBeVisible({ timeout: 30000 });
  await expect(page.getByText("MECHANICAL DEPTH PRIMITIVE")).toBeVisible();
  const deckRoot = page.locator("[data-deck-mode]").first();
  await expect(deckRoot).toHaveAttribute("data-deck-mode", "ascii");
});
