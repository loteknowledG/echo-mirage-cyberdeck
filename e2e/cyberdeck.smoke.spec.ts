import { expect, test } from "@playwright/test";

async function createAuditTab(page: import("@playwright/test").Page) {
  const input = page.locator('input[placeholder*="GATEWAY"], input[placeholder*="command"]').first();
  await input.fill("new tab named audit glyph A");
  await input.press("Enter");
  await expect(page.getByText("TAB_CREATED // audit // GLYPH A")).toBeVisible();
}

async function openAuditSurface(page: import("@playwright/test").Page, surface: string) {
  const auditTab = page.locator("cyberdeck-rail-tab").nth(3);
  await auditTab.click({ button: "right" });
  await page.getByRole("menuitem", { name: surface }).click();
}

test("cyberdeck renders and switches required alpha modules", async ({ page }) => {
  await page.goto("/cyberdeck", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => window.localStorage.clear());
  const response = await page.goto("/cyberdeck", { waitUntil: "domcontentloaded" });
  expect(response).not.toBeNull();
  expect(response!.status()).toBeLessThan(500);

  await expect(page.locator("cyberdeck-rail-tab")).toHaveCount(3);
  await expect(page.getByText("DECK ALPHA :: NOMINAL :: OPS 4")).toBeVisible();
  await expect(page.getByText("Command")).toBeVisible();
  await expect(page.getByText("Catalog")).toBeVisible();
  await expect(page.getByText("Operators")).toBeVisible();
  await expect(page.getByText("Memory Atlas")).toBeVisible();
  await expect(page.getByText("Voice Lab")).toBeVisible();
  await expect(page.getByText("Flight Log")).toBeVisible();
  await expect(page.getByText("Settings")).toBeVisible();

  await createAuditTab(page);

  await openAuditSurface(page, "Catalog");
  await expect(page.getByText("ECHO MIRAGE SERIES // CRAFTWERK CYBERDECK CORPORATION")).toBeVisible();
  await expect(page.getByText("[VIEW]").first()).toBeVisible();
  await expect(page.getByText("[CONFIGURE]").first()).toBeVisible();
  const firstCard = page.locator("article").filter({ hasText: "Echo Mirage Mark I" }).first();
  const cardBox = await firstCard.locator(".aspect-square").boundingBox();
  expect(cardBox).not.toBeNull();
  expect(Math.abs(cardBox!.width - cardBox!.height)).toBeLessThanOrEqual(1);
  await expect(firstCard.locator("img[alt='Echo Mirage Mark I cover']")).toHaveJSProperty("complete", true);

  await openAuditSurface(page, "Operators");
  await expect(page.getByText("CHATGPT // LEAD", { exact: true })).toBeVisible();
  await expect(page.getByText("CURSOR // DEV", { exact: true })).toBeVisible();
  await expect(page.getByText("CODEX // TEST", { exact: true })).toBeVisible();
  await expect(page.getByText("SAMUS-MANUS // MEMORY", { exact: true })).toBeVisible();
  await expect(page.getByText(/ONLINE|THINKING|REVIEWING|IDLE|BLOCKED/).first()).toBeVisible();

  await openAuditSurface(page, "Flight Log");
  await expect(page.getByText("OPERATIONS TRACE // LOCAL BUS")).toBeVisible();
  await expect(page.getByText("DECK :: cold start :: SUCCESS")).toBeVisible();

  await openAuditSurface(page, "Settings");
  await expect(page.getByText("REALMORPHISM / ASCII OVERRIDE")).toBeVisible();

  const modeButton = page.getByRole("button", { name: /\[REALMORPH\*? \| ASCII\*?\]/ });
  await expect(modeButton).toBeVisible();
  const deckRoot = page.locator("[data-deck-mode]").first();
  await expect(deckRoot).toHaveAttribute("data-deck-mode", /^(realmorphism|ascii)$/);
  const initialMode = await deckRoot.getAttribute("data-deck-mode");
  await modeButton.click();
  await expect(deckRoot).not.toHaveAttribute("data-deck-mode", initialMode!);
});
