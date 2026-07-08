import { expect, test } from "@playwright/test";
import {
  COMPOSER,
  createCustomTab,
  openCyberdeck,
  sendDeckCommand,
} from "./helpers/cyberdeck-page";

/**
 * L-CYBERDECK-001 extraction smoke — fast UI path without LLM/API dependencies.
 * Maps to work-order manual smoke steps 1 + custom-tab command (P1).
 *
 * Run: pnpm e2e:extraction-smoke
 * Full deck smoke (MUTHUR indicate, surfaces): pnpm e2e:smoke
 */
test.describe.configure({ timeout: 360000 });

test.describe("L-CYBERDECK-001 extraction smoke", () => {
  test("boot: /cyberdeck rail and chat shell render", async ({ page }) => {
    await openCyberdeck(page);

    await expect(page.locator("cyberdeck-rail-tab")).toHaveCount(3, { timeout: 10000 });
    await expect(page.locator(".cyberdeck-chat-app")).toBeVisible({ timeout: 10000 });
    await expect(page.locator(COMPOSER)).toBeVisible({ timeout: 10000 });
    await expect(page.getByLabel("Gateway")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Memory Atlas", { exact: false })).toBeAttached({ timeout: 10000 });
  });

  test("P1: custom tab create via deck command", async ({ page }) => {
    await openCyberdeck(page);
    await createCustomTab(page, "extraction-probe", "X");
    await expect(page.locator("cyberdeck-rail-tab")).toHaveCount(4, { timeout: 10000 });
  });

  test("P1: custom tab context menu opens assigned surface", async ({ page }) => {
    await openCyberdeck(page);
    const customTab = await createCustomTab(page, "surface-probe", "S");

    await customTab.click({ button: "right" });
    await page.getByRole("menuitem", { name: "Flight Log" }).click();
    await expect(page.getByText("OPERATIONS TRACE // LOCAL BUS")).toBeVisible({ timeout: 30000 });
    await expect(page.getByText("DECK :: cold start :: SUCCESS")).toBeVisible({ timeout: 10000 });
  });

  test("P2-lite: muthur help responds without LLM uplink", async ({ page }) => {
    await openCyberdeck(page);
    await sendDeckCommand(page, "muthur help tabs");
    await expect(page.getByText("[MUTHUR HELP // CUSTOM TABS]")).toBeVisible({ timeout: 10000 });
  });
});
