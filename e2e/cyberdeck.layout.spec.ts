import { expect, test, type Page } from "@playwright/test";

const MOBILE_VIEWPORT = { width: 390, height: 844 };
const DESKTOP_VIEWPORT = { width: 1280, height: 720 };
const COMPOSER = ".cyberdeck-chat-app > .cyberdeck-message-box";
const DIVIDER = '[role="separator"]';

type SplitGeometry = {
  composerBottom: number;
  dividerTop: number;
  groupBottom: number;
  groupDirection: string;
  groupTop: number;
  panelOverflow: string;
};

async function openCyberdeck(page: Page, viewport: { width: number; height: number }) {
  await page.setViewportSize(viewport);
  let response = await page.goto("/cyberdeck", { waitUntil: "domcontentloaded" });
  for (let attempt = 0; response?.status() === 404 && attempt < 2; attempt += 1) {
    response = await page.reload({ waitUntil: "domcontentloaded" });
  }
  expect(response?.status()).not.toBe(404);
  await page.locator("cyberdeck-rail-tab").first().waitFor({ state: "visible", timeout: 120000 });
  const skipBoot = page.getByRole("button", { name: "Skip" });
  if (await skipBoot.isVisible().catch(() => false)) {
    await skipBoot.click();
    await expect(skipBoot).toBeHidden();
  }
  await expect(page.locator(COMPOSER)).toBeVisible({ timeout: 10000 });
  await expect(page.locator(DIVIDER)).toBeVisible({ timeout: 10000 });
}

async function readSplitGeometry(page: Page): Promise<SplitGeometry> {
  return page.evaluate(
    ({ composerSelector, dividerSelector }) => {
      const composer = document.querySelector<HTMLElement>(composerSelector);
      const divider = document.querySelector<HTMLElement>(dividerSelector);
      const group = divider?.parentElement;
      const upperPanel = composer?.closest(".cyberdeck-chat-app")?.parentElement;

      if (!composer || !divider || !group || !upperPanel) {
        throw new Error("Cyberdeck split layout is not mounted.");
      }

      const composerBox = composer.getBoundingClientRect();
      const dividerBox = divider.getBoundingClientRect();
      const groupBox = group.getBoundingClientRect();

      return {
        composerBottom: composerBox.bottom,
        dividerTop: dividerBox.top,
        groupBottom: groupBox.bottom,
        groupDirection: getComputedStyle(group).flexDirection,
        groupTop: groupBox.top,
        panelOverflow: getComputedStyle(upperPanel).overflow,
      };
    },
    { composerSelector: COMPOSER, dividerSelector: DIVIDER },
  );
}

async function dragDividerTo(page: Page, y: number) {
  const dividerBox = await page.locator(DIVIDER).boundingBox();
  expect(dividerBox).not.toBeNull();

  const x = dividerBox!.x + dividerBox!.width / 2;
  const startY = dividerBox!.y + dividerBox!.height / 2;
  await page.mouse.move(x, startY);
  await page.mouse.down();
  await page.mouse.move(x, y, { steps: 8 });
  await page.mouse.up();
}

async function openCustomTabContextMenu(page: Page) {
  const input = page.locator('input[placeholder*="GATEWAY"], input[placeholder*="command"], input[placeholder*="COMMAND"]').first();
  await input.fill("new tab named retired-check glyph R");
  await input.press("Enter");
  await expect(page.getByText("TAB_CREATED // retired-check // GLYPH R")).toBeVisible({ timeout: 10000 });

  const customTab = page.locator("cyberdeck-rail-tab").nth(3);
  await customTab.click({ button: "right" });
}

function expectComposerAttachedToDivider(geometry: SplitGeometry) {
  expect(Math.abs(geometry.dividerTop - geometry.composerBottom)).toBeLessThanOrEqual(2);
}

test.describe("Cyberdeck responsive split layout", () => {
  test("desktop keeps ECHO and MUTHUR side by side", async ({ page }) => {
    await openCyberdeck(page, DESKTOP_VIEWPORT);

    const geometry = await readSplitGeometry(page);
    expect(geometry.groupDirection).toBe("row");
  });

  test("mobile composer moves with the divider and lower pane remains below it", async ({ page }) => {
    await openCyberdeck(page, MOBILE_VIEWPORT);

    const initial = await readSplitGeometry(page);
    expect(initial.groupDirection).toBe("column");
    expectComposerAttachedToDivider(initial);

    await dragDividerTo(page, initial.groupTop + 380);
    const moved = await readSplitGeometry(page);

    expect(moved.dividerTop).toBeLessThan(initial.dividerTop - 80);
    expectComposerAttachedToDivider(moved);
  });

  test("mobile divider reaches both edges and clips ECHO when collapsed", async ({ page }) => {
    await openCyberdeck(page, MOBILE_VIEWPORT);

    const initial = await readSplitGeometry(page);
    await dragDividerTo(page, initial.groupTop);
    const collapsedEcho = await readSplitGeometry(page);

    expect(collapsedEcho.dividerTop).toBeLessThanOrEqual(collapsedEcho.groupTop + 12);
    expect(collapsedEcho.panelOverflow).toBe("hidden");

    await dragDividerTo(page, collapsedEcho.groupBottom);
    const collapsedMuthur = await readSplitGeometry(page);

    expect(collapsedMuthur.dividerTop).toBeGreaterThanOrEqual(collapsedMuthur.groupBottom - 20);
    expectComposerAttachedToDivider(collapsedMuthur);
  });

  test("mobile divider position survives switching to desktop and back", async ({ page }) => {
    await openCyberdeck(page, MOBILE_VIEWPORT);

    const initial = await readSplitGeometry(page);
    await dragDividerTo(page, initial.groupTop + 360);
    const placed = await readSplitGeometry(page);
    expectComposerAttachedToDivider(placed);

    await page.setViewportSize(DESKTOP_VIEWPORT);
    await expect.poll(async () => (await readSplitGeometry(page)).groupDirection).toBe("row");

    await page.setViewportSize(MOBILE_VIEWPORT);
    await expect.poll(async () => (await readSplitGeometry(page)).groupDirection).toBe("column");

    const returned = await readSplitGeometry(page);
    expect(Math.abs(returned.dividerTop - placed.dividerTop)).toBeLessThanOrEqual(2);
    expectComposerAttachedToDivider(returned);
  });

  test("mobile divider position survives a page reload", async ({ page }) => {
    await openCyberdeck(page, MOBILE_VIEWPORT);

    const initial = await readSplitGeometry(page);
    await dragDividerTo(page, initial.groupTop + 360);
    const placed = await readSplitGeometry(page);
    expectComposerAttachedToDivider(placed);

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator(COMPOSER)).toBeVisible({ timeout: 10000 });
    await expect(page.locator(DIVIDER)).toBeVisible({ timeout: 10000 });

    const returned = await readSplitGeometry(page);
    expect(Math.abs(returned.dividerTop - placed.dividerTop)).toBeLessThanOrEqual(2);
    expectComposerAttachedToDivider(returned);
  });

  test("custom tab menu omits retired MUTHUR execution surface", async ({ page }) => {
    await openCyberdeck(page, MOBILE_VIEWPORT);

    let executionPolls = 0;
    page.on("request", (request) => {
      if (new URL(request.url()).pathname === "/api/muthur/execution" && request.method() === "GET") {
        executionPolls += 1;
      }
    });

    await openCustomTabContextMenu(page);
    await expect(page.getByRole("menuitem", { name: "MUTHUR Execution" })).toHaveCount(0);
    expect(executionPolls).toBe(0);
  });
});
