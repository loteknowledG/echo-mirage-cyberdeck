import { expect, test, type Page } from "@playwright/test";

const DESKTOP_VIEWPORT = { width: 1280, height: 720 };
const BOOT_KEY = "echo-mirage-boot-completed-v1";

async function openCyberdeck(page: Page) {
  await page.addInitScript((bootKey) => {
    window.localStorage.setItem(bootKey, "1");
  }, BOOT_KEY);

  await page.setViewportSize(DESKTOP_VIEWPORT);
  const response = await page.goto("/cyberdeck", { waitUntil: "domcontentloaded", timeout: 120000 });
  expect(response?.status()).toBeLessThan(500);

  await page
    .locator(
      'textarea[placeholder*="command"], input[placeholder*="command"], input[placeholder*="COMMAND"], input[placeholder*="GATEWAY"]',
    )
    .first()
    .waitFor({ state: "visible", timeout: 120000 });
}

async function openRealmorphismKitTab(page: Page) {
  const railTab = page.locator("cyberdeck-rail-tab").first();
  await railTab.waitFor({ state: "visible", timeout: 10000 });
  await railTab.click({ button: "right" });
  await page.getByRole("menuitem", { name: /Open Realmorphism kit/i }).click();
  await expect(page.getByText("TAB_KIT // REALMORPHISM REGISTRY OPENED")).toBeVisible({
    timeout: 15000,
  });
  await expect(page.locator("[data-registry-kit-scroll]")).toBeVisible({
    timeout: 15000,
  });
}

function kitPane(page: Page) {
  return page.locator("[data-registry-kit-scroll]");
}

function kitScrollContainer(page: Page) {
  return kitPane(page);
}

test.describe("Realmorphism Kit scroll", () => {
  test.beforeEach(async ({ page }) => {
    await openCyberdeck(page);
    await openRealmorphismKitTab(page);
  });

  test("uses a single vertical scroll container (no nested page scroll)", async ({ page }) => {
    const scrollHost = kitPane(page);
    const scroll = kitScrollContainer(page);
    await expect(scroll).toBeVisible({ timeout: 15000 });

    const scrollers = await scrollHost.evaluate((root) => {
      let count = 0;
      const nodes = [root, ...root.querySelectorAll("*")];
      for (const el of nodes) {
        if (!(el instanceof HTMLElement)) continue;
        const style = window.getComputedStyle(el);
        if (style.overflowY !== "auto" && style.overflowY !== "scroll") continue;
        if (el.scrollHeight <= el.clientHeight + 2) continue;
        count += 1;
      }
      return count;
    });
    expect(scrollers).toBe(1);
  });

  test("scrolls to bottom and stays there (no snap back to top)", async ({ page }) => {
    const scroll = kitScrollContainer(page);
    await expect(scroll).toBeVisible({ timeout: 15000 });

    const topMarker = page.locator('[data-registry-showroom] h1', { hasText: "Realmorphism" });
    const bottomMarker = page.getByRole("heading", { name: "Community Upload Notes" });
    await expect(topMarker).toBeVisible();
    await expect(bottomMarker).toBeVisible();

    const scrollMetricsBefore = await scroll.evaluate((el) => ({
      scrollTop: el.scrollTop,
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
    }));
    expect(scrollMetricsBefore.scrollHeight).toBeGreaterThan(
      scrollMetricsBefore.clientHeight + 50,
    );

    await bottomMarker.scrollIntoViewIfNeeded();

    await expect
      .poll(async () => scroll.evaluate((el) => el.scrollTop))
      .toBeGreaterThan(100);

    const scrollTopAtBottom = await scroll.evaluate((el) => el.scrollTop);
    const maxScroll = await scroll.evaluate((el) => el.scrollHeight - el.clientHeight);
    expect(scrollTopAtBottom).toBeGreaterThan(maxScroll * 0.85);

    const headerVisibleInViewport = await scroll.evaluate((scroller) => {
      const header = scroller.querySelector('[data-registry-showroom] h1');
      if (!header) return false;
      const sRect = scroller.getBoundingClientRect();
      const tRect = header.getBoundingClientRect();
      return tRect.top >= sRect.top - 2 && tRect.bottom <= sRect.bottom + 2;
    });
    expect(headerVisibleInViewport).toBe(false);

    await scroll.hover();
    for (let i = 0; i < 8; i += 1) {
      await page.mouse.wheel(0, 400);
      await page.waitForTimeout(50);
    }

    const scrollTopAfter = await scroll.evaluate((el) => el.scrollTop);
    expect(scrollTopAfter).toBeGreaterThan(maxScroll * 0.7);
    expect(scrollTopAfter).toBeGreaterThanOrEqual(scrollTopAtBottom - 20);

    await expect(bottomMarker).toBeInViewport();
  });

  test("keeps scroll position after async catalog sections hydrate", async ({ page }) => {
    const scroll = kitScrollContainer(page);
    await expect(scroll).toBeVisible({ timeout: 15000 });

    await scroll.evaluate((el) => {
      el.scrollTop = Math.min(520, el.scrollHeight - el.clientHeight);
    });
    const before = await scroll.evaluate((el) => el.scrollTop);
    expect(before).toBeGreaterThan(120);

    await expect(page.locator('[data-oneline-art-picker]')).toBeAttached({ timeout: 30000 });
    await expect(page.locator('[aria-label="Figlet font"]')).toBeAttached({ timeout: 30000 });
    await expect
      .poll(async () =>
        page.evaluate(() => document.querySelector('[data-oneline-art-picker]')?.textContent?.trim() !== "…"),
      )
      .toBe(true);
    await page.waitForTimeout(400);

    const after = await scroll.evaluate((el) => el.scrollTop);
    expect(after).toBeGreaterThan(before * 0.85);

    const headerVisibleInViewport = await scroll.evaluate((scroller) => {
      const header = scroller.querySelector('[data-registry-showroom] h1');
      if (!header) return false;
      const sRect = scroller.getBoundingClientRect();
      const tRect = header.getBoundingClientRect();
      return tRect.top >= sRect.top - 2 && tRect.bottom <= sRect.bottom + 2;
    });
    expect(headerVisibleInViewport).toBe(false);
  });
});
