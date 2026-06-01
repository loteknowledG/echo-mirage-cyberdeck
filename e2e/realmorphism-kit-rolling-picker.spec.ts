import { expect, test, type Locator, type Page } from "@playwright/test";

const DESKTOP_VIEWPORT = { width: 1280, height: 720 };
const BOOT_KEY = "echo-mirage-boot-completed-v1";
const ROW_PX = 28;
const SHOWROOM_ROW_PX = 44;
const SHOWROOM_VISIBLE_ROWS = 3;
const SHOWROOM_BAND_PX = SHOWROOM_ROW_PX * SHOWROOM_VISIBLE_ROWS;

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

function compactPickerHost(section: Locator) {
  return section.locator('[data-rolling-picker-mode="compact"]').first();
}

function textPickerHost(section: Locator) {
  return section.locator('[aria-label="One-line ASCII art"]');
}

function textRollerSection(page: Page) {
  return page.locator("section").filter({ hasText: "control · text" });
}

function showroomSection(page: Page) {
  return page.locator("section").filter({ hasText: "control · showroom" });
}

function showroomWheelPanel(section: Locator) {
  return section.locator("[data-kit-showroom-wheel] [data-float-wheel-panel]");
}

function showroomPickerHost(section: Locator) {
  return section.locator('[data-rolling-picker-mode="showroom"]').first();
}

async function readShowroomCenterFont(wheelPanel: Locator) {
  return wheelPanel.evaluate((el) => {
    const panelRect = el.getBoundingClientRect();
    const rowPx =
      Number.parseFloat(getComputedStyle(el).getPropertyValue("--float-wheel-row-px")) ||
      SHOWROOM_ROW_PX;
    const centerY = panelRect.top + panelRect.height / 2;

    for (const inner of el.querySelectorAll("[data-ios-picker-inner]")) {
      const html = inner as HTMLElement;
      if (Number.parseFloat(getComputedStyle(html).opacity) < 0.45) continue;
      const rect = html.getBoundingClientRect();
      if (rect.height < 2 || rect.width < 2) continue;
      const midY = rect.top + rect.height / 2;
      if (Math.abs(midY - centerY) > rowPx / 2) continue;
      const label = html.querySelector("span");
      const text = (label?.textContent ?? html.textContent)?.trim() ?? "";
      if (text.length > 0) return text;
    }
    return "";
  });
}

async function countShowroomVisibleRows(wheelPanel: Locator) {
  return wheelPanel.evaluate((el) => {
    let count = 0;
    for (const inner of el.querySelectorAll("[data-ios-picker-inner]")) {
      const html = inner as HTMLElement;
      if (Number.parseFloat(getComputedStyle(html).opacity) < 0.28) continue;
      const rect = html.getBoundingClientRect();
      if (rect.height < 2 || rect.width < 2) continue;
      count += 1;
    }
    return count;
  });
}

async function readShowroomCenterOffsetPx(wheelPanel: Locator) {
  return wheelPanel.evaluate((el) => {
    const panelRect = el.getBoundingClientRect();
    const rowPx =
      Number.parseFloat(getComputedStyle(el).getPropertyValue("--float-wheel-row-px")) ||
      SHOWROOM_ROW_PX;
    const centerY = panelRect.top + panelRect.height / 2;

    for (const inner of el.querySelectorAll("[data-ios-picker-inner]")) {
      const html = inner as HTMLElement;
      if (Number.parseFloat(getComputedStyle(html).opacity) < 0.85) continue;
      const rect = html.getBoundingClientRect();
      if (rect.height < 2) continue;
      const midY = rect.top + rect.height / 2;
      if (Math.abs(midY - centerY) > rowPx / 2) continue;
      return Math.abs(midY - centerY);
    }
    return 999;
  });
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

async function scrollKitSectionIntoView(section: Locator) {
  await section.scrollIntoViewIfNeeded();
  await section.evaluate((el) => {
    const kit = el.closest("[data-registry-kit-scroll]") as HTMLElement | null;
    const html = el as HTMLElement;
    if (!kit) {
      html.scrollIntoView({ block: "center", inline: "nearest" });
      return;
    }
    const sectionTop = html.offsetTop;
    kit.scrollTop = Math.max(0, sectionTop - kit.clientHeight * 0.2);
  });
  await section.page().waitForTimeout(200);
}

async function wheelRoller(roller: Locator, page: Page, deltaY: number) {
  await roller.scrollIntoViewIfNeeded();
  await roller.evaluate((el, dy) => {
    const host = el.closest("[data-rolling-picker-mode]") as HTMLElement | null;
    if (!host) return;
    host.dispatchEvent(
      new WheelEvent("wheel", { deltaY: dy, bubbles: true, cancelable: true }),
    );
  }, deltaY);
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

    const host = compactPickerHost(section);
    const roller = section.locator('[aria-label="Document type"]');
    await expect(roller).toBeVisible({ timeout: 15000 });

    const selectedPanel = section.locator(".realmorphism-panel").filter({ hasText: "Selected" });
    const before = (await selectedPanel.locator(".text-\\[\\#7dffb4\\]").textContent())?.trim();
    await wheelRoller(host, page, 360);
    await expect
      .poll(async () => (await selectedPanel.locator(".text-\\[\\#7dffb4\\]").textContent())?.trim(), {
        timeout: 8000,
      })
      .not.toBe(before);
  });

  test("text toolbar roller shows one title when settled", async ({ page }) => {
    const section = textRollerSection(page);
    await scrollKitSectionIntoView(section);

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
    await scrollKitSectionIntoView(section);

    const wheel = section.locator('[aria-label="One-line ASCII art"]');
    const host = textPickerHost(section);
    await waitForOnelineCatalog(page, wheel);

    const before = await readCenterTitle(wheel);
    await wheelRoller(host, page, 360);
    await expect.poll(async () => countVisibleBandTitles(wheel)).toBeGreaterThan(0);
    await expect
      .poll(async () => readCenterTitle(wheel), { timeout: 8000 })
      .not.toBe(before);
    await expect.poll(async () => countVisibleBandTitles(wheel), { timeout: 5000 }).toBe(1);

    const after = await readCenterTitle(wheel);
    expect(after).not.toBe("");
  });

  test("text toolbar roller wraps from first catalog item to last", async ({ page }) => {
    const section = textRollerSection(page);
    await scrollKitSectionIntoView(section);

    const wheel = section.locator('[aria-label="One-line ASCII art"]');
    const host = textPickerHost(section);
    await waitForOnelineCatalog(page, wheel);

    await expect(
      section.locator('[data-oneline-art-picker] [data-rolling-picker-loop="true"]'),
    ).toHaveAttribute("data-rolling-picker-loop", "true");

    const { idx, total } = await readCatalogIndex(section);
    expect(total).toBeGreaterThan(1);
    expect(idx).toBe(1);

    const firstTitle = await readCenterTitle(wheel);
    expect(firstTitle.length).toBeGreaterThan(0);

    await wheelRoller(host, page, -600);
    await expect
      .poll(async () => (await readCatalogIndex(section)).idx, { timeout: 15000 })
      .toBe(total);

    const lastTitle = await readCenterTitle(wheel);
    expect(lastTitle.length).toBeGreaterThan(0);
    expect(lastTitle).not.toBe(firstTitle);
  });

  test("text toolbar roller wraps from last catalog item back to first", async ({ page }) => {
    const section = textRollerSection(page);
    await scrollKitSectionIntoView(section);

    const wheel = section.locator('[aria-label="One-line ASCII art"]');
    const host = textPickerHost(section);
    await waitForOnelineCatalog(page, wheel);

    const { total } = await readCatalogIndex(section);
    expect(total).toBeGreaterThan(1);

    await wheelRoller(host, page, -600);
    await expect
      .poll(async () => (await readCatalogIndex(section)).idx, { timeout: 15000 })
      .toBe(total);

    const lastTitle = await readCenterTitle(wheel);
    expect(lastTitle.length).toBeGreaterThan(0);

    await wheelRoller(host, page, 600);
    await expect
      .poll(async () => (await readCatalogIndex(section)).idx, { timeout: 15000 })
      .toBe(1);

    const firstTitle = await readCenterTitle(wheel);
    expect(firstTitle.length).toBeGreaterThan(0);
    expect(firstTitle).not.toBe(lastTitle);
  });

  test("compact doc-type roller loops at catalog boundaries", async ({ page }) => {
    const section = compactPickerSection(page);
    await section.scrollIntoViewIfNeeded();

    const host = compactPickerHost(section);
    const roller = section.locator('[aria-label="Document type"]');
    await expect(roller).toBeVisible({ timeout: 15000 });

    await expect(
      section.locator('[data-rolling-picker-mode="compact"][data-rolling-picker-loop="true"]'),
    ).toHaveAttribute("data-rolling-picker-loop", "true");

    const selectedPanel = section.locator(".realmorphism-panel").filter({ hasText: "Selected" });
    const readSelected = () =>
      selectedPanel
        .locator(".text-\\[\\#7dffb4\\]")
        .textContent()
        .then((text) => text?.trim() ?? "");

    await expect.poll(readSelected, { timeout: 8000 }).toMatch(/markdown/i);

    for (let index = 0; index < 5; index += 1) {
      await wheelRoller(host, page, -360);
    }
    await expect.poll(readSelected, { timeout: 8000 }).toMatch(/typescript/i);

    await wheelRoller(host, page, 360);
    await expect.poll(readSelected, { timeout: 8000 }).toMatch(/^css$/i);
  });

  test("showroom figlet wheel is clipped to the 3-row band (not full catalog)", async ({ page }) => {
    const section = showroomSection(page);
    await scrollKitSectionIntoView(section);

    const wheelPanel = showroomWheelPanel(section);
    await expect(wheelPanel).toBeVisible({ timeout: 30000 });

    const panelHeight = await wheelPanel.evaluate((el) => el.getBoundingClientRect().height);
    expect(panelHeight).toBeGreaterThanOrEqual(SHOWROOM_BAND_PX - 4);
    expect(panelHeight).toBeLessThanOrEqual(SHOWROOM_BAND_PX + 8);

    await expect.poll(async () => countShowroomVisibleRows(wheelPanel), { timeout: 15000 }).toBeLessThanOrEqual(
      SHOWROOM_VISIBLE_ROWS,
    );
    await expect.poll(async () => countShowroomVisibleRows(wheelPanel), { timeout: 15000 }).toBeGreaterThanOrEqual(
      2,
    );
  });

  test("showroom figlet wheel centers the active font on the selection band", async ({ page }) => {
    const section = showroomSection(page);
    await scrollKitSectionIntoView(section);

    const wheelPanel = showroomWheelPanel(section);
    await expect(wheelPanel).toBeVisible({ timeout: 30000 });

    await expect
      .poll(async () => readShowroomCenterFont(wheelPanel), { timeout: 30000 })
      .not.toBe("");

    const offsetPx = await readShowroomCenterOffsetPx(wheelPanel);
    expect(offsetPx).toBeLessThanOrEqual(6);

    const selectedPanel = section.locator(".realmorphism-panel").filter({ hasText: "Selected" });
    const selectedName = (
      await selectedPanel.locator(".font-mono.text-sm").textContent()
    )?.trim();
    const centerName = await readShowroomCenterFont(wheelPanel);
    expect(centerName).toBe(selectedName);
  });

  test("showroom figlet wheel scroll advances selection and detail preview", async ({ page }) => {
    const section = showroomSection(page);
    await scrollKitSectionIntoView(section);

    const wheelPanel = showroomWheelPanel(section);
    const host = showroomPickerHost(section);
    await expect(wheelPanel).toBeVisible({ timeout: 30000 });

    await expect
      .poll(async () => readShowroomCenterFont(wheelPanel), { timeout: 30000 })
      .not.toBe("");

    const before = await readShowroomCenterFont(wheelPanel);
    const selectedPanel = section.locator(".realmorphism-panel").filter({ hasText: "Selected" });
    const indexBefore = await readCatalogIndex(section);

    await wheelRoller(host, page, 420);
    await expect
      .poll(async () => readShowroomCenterFont(wheelPanel), { timeout: 12000 })
      .not.toBe(before);

    const after = await readShowroomCenterFont(wheelPanel);
    expect(after.length).toBeGreaterThan(0);

    const selectedName = (
      await selectedPanel.locator(".font-mono.text-sm").textContent()
    )?.trim();
    expect(after).toBe(selectedName);

    const indexAfter = await readCatalogIndex(section);
    expect(indexAfter.idx).not.toBe(indexBefore.idx);

    await expect(section.locator('pre:not([aria-hidden="true"])')).toBeVisible();
  });
});
