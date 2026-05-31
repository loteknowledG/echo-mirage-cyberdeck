import { expect, test, type Locator, type Page } from "@playwright/test";

const DESKTOP_VIEWPORT = { width: 1280, height: 720 };
const BOOT_KEY = "echo-mirage-boot-completed-v1";
const ROW_PX = 28;

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

function compactPickerSection(page: Page) {
  return page.locator("section").filter({ hasText: "control · compact" });
}

function textRollerSection(page: Page) {
  return page.locator("section").filter({ hasText: "control · text" });
}

async function countVisibleBandTitles(wheel: Locator) {
  return wheel.evaluate((el) => {
    const panelRect = el.getBoundingClientRect();
    const rowPx =
      Number.parseFloat(getComputedStyle(el).getPropertyValue("--float-wheel-row-px")) || ROW_PX;
    const bandTop = panelRect.top + panelRect.height / 2 - rowPx / 2;
    const bandBottom = bandTop + rowPx;
    let count = 0;

    for (const node of el.querySelectorAll("[data-oneline-title]")) {
      const html = node as HTMLElement;
      if (Number.parseFloat(getComputedStyle(html).opacity) < 0.45) continue;
      const rect = html.getBoundingClientRect();
      if (rect.height < 2 || rect.width < 2) continue;
      const midY = rect.top + rect.height / 2;
      if (midY < bandTop - 1 || midY > bandBottom + 1) continue;
      count += 1;
    }
    return count;
  });
}

async function countVisibleCompactIcons(roller: Locator) {
  return roller.evaluate((el) => {
    const rect = el.getBoundingClientRect();
    let count = 0;
    for (const img of el.querySelectorAll("img")) {
      const html = img as HTMLElement;
      if (Number.parseFloat(getComputedStyle(html).opacity) < 0.45) continue;
      const r = html.getBoundingClientRect();
      if (r.height < 2 || r.width < 2) continue;
      const midY = r.top + r.height / 2;
      if (midY < rect.top - 1 || midY > rect.bottom + 1) continue;
      count += 1;
    }
    return count;
  });
}

async function readCenterTitle(wheel: Locator) {
  return wheel.evaluate((el) => {
    const panelRect = el.getBoundingClientRect();
    const rowPx =
      Number.parseFloat(getComputedStyle(el).getPropertyValue("--float-wheel-row-px")) || ROW_PX;
    const centerY = panelRect.top + panelRect.height / 2;

    for (const node of el.querySelectorAll("[data-oneline-title]")) {
      const html = node as HTMLElement;
      if (Number.parseFloat(getComputedStyle(html).opacity) < 0.45) continue;
      const rect = html.getBoundingClientRect();
      if (rect.height < 1 || rect.width < 1) continue;
      const midY = rect.top + rect.height / 2;
      if (Math.abs(midY - centerY) > rowPx / 2) continue;
      return html.textContent?.trim() ?? "";
    }
    return "";
  });
}

async function wheelRoller(roller: Locator, page: Page, deltaY: number) {
  await roller.scrollIntoViewIfNeeded();
  const viewport = roller.locator('[class*="viewport"]').first();
  await viewport.hover({ force: true });
  await page.mouse.wheel(0, deltaY);
  await page.waitForTimeout(750);
}

async function waitForOnelineCatalog(page: Page, wheel: Locator) {
  await expect
    .poll(async () => readCenterTitle(wheel), { timeout: 45000 })
    .not.toBe("");
}

async function readCatalogIndex(section: Locator) {
  const label = section.getByText(/\d+\s+\/\s+\d+/).first();
  await expect(label).toBeVisible();
  const text = (await label.textContent()) ?? "";
  const [idxRaw, totalRaw] = text.split("/");
  return {
    idx: Number(idxRaw?.trim()),
    total: Number(totalRaw?.trim()),
  };
}

async function spinUntilCatalogIndex(
  section: Locator,
  wheel: Locator,
  page: Page,
  targetIdx: number,
  maxSpins = 48,
) {
  for (let spin = 0; spin < maxSpins; spin += 1) {
    const { idx } = await readCatalogIndex(section);
    if (idx === targetIdx) return;
    await wheelRoller(wheel, page, 360);
  }
  const { idx, total } = await readCatalogIndex(section);
  throw new Error(`expected catalog index ${targetIdx}, stuck at ${idx}/${total}`);
}

test.describe("Realmorphism Kit rolling pickers", () => {
  test.beforeEach(async ({ page }) => {
    await openCyberdeck(page);
    await openRealmorphismKitTab(page);
  });

  test("compact toolbar doc-type roller shows one icon when settled", async ({ page }) => {
    const section = compactPickerSection(page);
    await section.scrollIntoViewIfNeeded();

    const roller = section.locator('[aria-label="Document type"]');
    await expect(roller).toBeVisible({ timeout: 15000 });

    const panelHeight = await roller.evaluate((el) => el.getBoundingClientRect().height);
    expect(panelHeight).toBeGreaterThanOrEqual(ROW_PX - 2);
    expect(panelHeight).toBeLessThanOrEqual(ROW_PX + 2);

    await expect.poll(async () => countVisibleCompactIcons(roller)).toBe(1);
  });

  test("compact toolbar doc-type roller stays visible while scrolling", async ({ page }) => {
    const section = compactPickerSection(page);
    await section.scrollIntoViewIfNeeded();

    const roller = section.locator('[aria-label="Document type"]');
    await expect(roller).toBeVisible({ timeout: 15000 });

    const selectedPanel = section.locator(".realmorphism-panel").filter({ hasText: "Selected" });
    const before = (await selectedPanel.locator(".text-\\[\\#7dffb4\\]").textContent())?.trim();
    await wheelRoller(roller, page, 240);
    await expect.poll(async () => countVisibleCompactIcons(roller)).toBeGreaterThan(0);
    await expect.poll(async () => countVisibleCompactIcons(roller), { timeout: 5000 }).toBe(1);

    const after = (await selectedPanel.locator(".text-\\[\\#7dffb4\\]").textContent())?.trim();
    expect(after).toBeTruthy();
    expect(after).not.toBe(before);
  });

  test("text toolbar roller shows one title when settled", async ({ page }) => {
    const section = textRollerSection(page);
    await section.scrollIntoViewIfNeeded();

    const wheel = section.locator('[aria-label="One-line ASCII art"]');
    await expect(wheel).toBeAttached({ timeout: 30000 });
    await waitForOnelineCatalog(page, wheel);

    const panelHeight = await wheel.evaluate((el) => el.getBoundingClientRect().height);
    expect(panelHeight).toBeGreaterThanOrEqual(ROW_PX - 2);
    expect(panelHeight).toBeLessThanOrEqual(ROW_PX + 2);

    await expect.poll(async () => countVisibleBandTitles(wheel)).toBe(1);
  });

  test("text toolbar roller shows titles while scrolling and advances selection", async ({
    page,
  }) => {
    const section = textRollerSection(page);
    await section.scrollIntoViewIfNeeded();

    const wheel = section.locator('[aria-label="One-line ASCII art"]');
    await waitForOnelineCatalog(page, wheel);

    const before = await readCenterTitle(wheel);
    await wheelRoller(wheel, page, 320);
    await expect.poll(async () => countVisibleBandTitles(wheel)).toBeGreaterThan(0);
    await expect.poll(async () => countVisibleBandTitles(wheel), { timeout: 5000 }).toBe(1);

    const after = await readCenterTitle(wheel);
    expect(after).not.toBe("");
    expect(after).not.toBe(before);
  });

  test("text toolbar roller wraps from first catalog item to last", async ({ page }) => {
    const section = textRollerSection(page);
    await section.scrollIntoViewIfNeeded();

    const wheel = section.locator('[aria-label="One-line ASCII art"]');
    await waitForOnelineCatalog(page, wheel);

    await expect(
      section.locator('[data-oneline-art-picker] [data-rolling-picker-loop="true"]'),
    ).toHaveAttribute("data-rolling-picker-loop", "true");

    const { total } = await readCatalogIndex(section);
    expect(total).toBeGreaterThan(1);

    await spinUntilCatalogIndex(section, wheel, page, 1);

    const firstTitle = await readCenterTitle(wheel);
    expect(firstTitle.length).toBeGreaterThan(0);

    await wheelRoller(wheel, page, -420);
    await expect
      .poll(async () => (await readCatalogIndex(section)).idx, { timeout: 8000 })
      .toBe(total);

    const lastTitle = await readCenterTitle(wheel);
    expect(lastTitle.length).toBeGreaterThan(0);
    expect(lastTitle).not.toBe(firstTitle);
  });

  test("text toolbar roller wraps from last catalog item back to first", async ({ page }) => {
    const section = textRollerSection(page);
    await section.scrollIntoViewIfNeeded();

    const wheel = section.locator('[aria-label="One-line ASCII art"]');
    await waitForOnelineCatalog(page, wheel);

    const { total } = await readCatalogIndex(section);
    expect(total).toBeGreaterThan(1);

    await spinUntilCatalogIndex(section, wheel, page, total);

    const lastTitle = await readCenterTitle(wheel);
    expect(lastTitle.length).toBeGreaterThan(0);

    await wheelRoller(wheel, page, 420);
    await expect
      .poll(async () => (await readCatalogIndex(section)).idx, { timeout: 8000 })
      .toBe(1);

    const firstTitle = await readCenterTitle(wheel);
    expect(firstTitle.length).toBeGreaterThan(0);
    expect(firstTitle).not.toBe(lastTitle);
  });

  test("compact doc-type roller loops through full catalog", async ({ page }) => {
    const section = compactPickerSection(page);
    await section.scrollIntoViewIfNeeded();

    const roller = section.locator('[aria-label="Document type"]');
    await expect(roller).toBeVisible({ timeout: 15000 });

    await expect(
      section.locator('[data-rolling-picker-mode="compact"][data-rolling-picker-loop="true"]'),
    ).toHaveAttribute("data-rolling-picker-loop", "true");

    const selectedPanel = section.locator(".realmorphism-panel").filter({ hasText: "Selected" });
    const start = (await selectedPanel.locator(".text-\\[\\#7dffb4\\]").textContent())?.trim();
    expect(start).toBeTruthy();

    for (let i = 0; i < 9; i += 1) {
      await wheelRoller(roller, page, 320);
    }

    await expect
      .poll(async () => (await selectedPanel.locator(".text-\\[\\#7dffb4\\]").textContent())?.trim(), {
        timeout: 8000,
      })
      .toBe(start);
  });
});
