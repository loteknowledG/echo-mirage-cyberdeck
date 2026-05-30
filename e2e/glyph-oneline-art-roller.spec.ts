import { expect, test, type Locator, type Page } from "@playwright/test";

const DESKTOP_VIEWPORT = { width: 1280, height: 720 };
const BOOT_KEY = "echo-mirage-boot-completed-v1";
const FIGLET_ROW_PX = 28;

async function openCyberdeck(page: Page) {
  await page.addInitScript((bootKey) => {
    window.localStorage.setItem(bootKey, "1");
  }, BOOT_KEY);

  await page.setViewportSize(DESKTOP_VIEWPORT);
  let response = await page.goto("/cyberdeck", { waitUntil: "domcontentloaded", timeout: 120000 });
  for (let attempt = 0; response?.status() === 404 && attempt < 2; attempt += 1) {
    response = await page.reload({ waitUntil: "domcontentloaded" });
  }
  expect(response?.status()).toBeLessThan(500);

  await page
    .locator(
      'textarea[placeholder*="command"], input[placeholder*="command"], input[placeholder*="COMMAND"], input[placeholder*="GATEWAY"]',
    )
    .first()
    .waitFor({ state: "visible", timeout: 120000 });
}

async function sendDeckCommand(page: Page, text: string) {
  const input = page
    .locator(
      'textarea[placeholder*="command"], input[placeholder*="command"], input[placeholder*="COMMAND"], input[placeholder*="GATEWAY"]',
    )
    .first();
  await expect(input).toBeEnabled({ timeout: 15000 });
  await input.fill(text);
  await input.press("Enter");
}

async function openGlyphChannelTab(page: Page) {
  await sendDeckCommand(page, "new tab named oneline audit glyph G");
  await expect(page.getByText(/TAB_CREATED.*oneline audit/i)).toBeVisible({ timeout: 15000 });

  const auditTab = page.locator("cyberdeck-rail-tab").filter({ hasText: "G" }).last();
  await auditTab.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Ascii" }).click();

  await expect(page.locator('[data-pointer-target="glyph-channel"]')).toBeVisible({
    timeout: 60000,
  });
}

function glyphChannelPane(page: Page) {
  return page.locator('[data-pointer-target="glyph-channel"]');
}

function renderEngineRoller(page: Page) {
  return glyphChannelPane(page).locator('[aria-label="Render engine"]');
}

function onelineArtPicker(page: Page) {
  return glyphChannelPane(page).locator("[data-oneline-art-picker]");
}

function onelineWheel(page: Page) {
  return glyphChannelPane(page).locator('[aria-label="One-line ASCII art"]');
}

function glyphComposer(page: Page) {
  return glyphChannelPane(page).locator(".glyph-channel-composer input");
}

async function selectOnelineEngine(page: Page) {
  const engine = renderEngineRoller(page);
  await expect(engine).toBeVisible({ timeout: 30000 });

  for (let i = 0; i < 6; i += 1) {
    const label = await engine.evaluate((el) => {
      const centerY = el.getBoundingClientRect().top + el.getBoundingClientRect().height / 2;
      for (const span of el.querySelectorAll("span")) {
        const rect = span.getBoundingClientRect();
        if (rect.height < 1) continue;
        if (Math.abs(rect.top + rect.height / 2 - centerY) > rect.height) continue;
        return span.textContent?.trim() ?? "";
      }
      return "";
    });
    if (/1\s*line/i.test(label)) break;
    await engine.hover();
    await page.mouse.wheel(0, 120);
    await page.waitForTimeout(350);
  }

  await expect(onelineWheel(page)).toBeVisible({ timeout: 30000 });
}

async function readCenterBandText(roller: Locator, attr: "oneline-art" | "oneline-title") {
  return roller.evaluate(
    (el, dataAttr) => {
      const rowPx =
        Number.parseFloat(getComputedStyle(el).getPropertyValue("--float-wheel-row-px")) || 28;
      const panelRect = el.getBoundingClientRect();
      const centerY = panelRect.top + panelRect.height / 2;

      for (const node of el.querySelectorAll(`[data-${dataAttr}]`)) {
        const html = node as HTMLElement;
        if (Number.parseFloat(getComputedStyle(html).opacity) < 0.5) continue;
        const rect = html.getBoundingClientRect();
        if (rect.height < 1 || rect.width < 1) continue;
        const midY = rect.top + rect.height / 2;
        if (Math.abs(midY - centerY) > rowPx / 2) continue;
        return html.textContent?.trim() ?? "";
      }
      return "";
    },
    attr,
  );
}

async function waitForOnelineCatalog(page: Page) {
  await expect
    .poll(async () => readCenterBandText(onelineWheel(page), "oneline-title"), { timeout: 30000 })
    .not.toBe("");
}

async function wheelRoller(roller: Locator, page: Page, deltaY: number) {
  await roller.hover();
  await page.mouse.wheel(0, deltaY);
  await page.waitForTimeout(700);
}

test.describe("Glyph channel 1-line ASCII roller", () => {
  test.beforeEach(async ({ page }) => {
    await openCyberdeck(page);
    await openGlyphChannelTab(page);
    await selectOnelineEngine(page);
    await waitForOnelineCatalog(page);
  });

  test("settled center band shows title only at figlet row height", async ({ page }) => {
    const input = glyphComposer(page);
    const wheel = onelineWheel(page);

    const inputBox = await input.boundingBox();
    const wheelBox = await wheel.boundingBox();
    expect(inputBox).not.toBeNull();
    expect(wheelBox).not.toBeNull();
    expect(inputBox!.y + inputBox!.height).toBeLessThanOrEqual(wheelBox!.y + 2);

    const art = await readCenterBandText(wheel, "oneline-art");
    const title = await readCenterBandText(wheel, "oneline-title");
    expect(title.length).toBeGreaterThan(0);
    expect(art).toBe("");

    const height = await wheel.evaluate((el) => el.getBoundingClientRect().height);
    expect(height).toBeGreaterThanOrEqual(FIGLET_ROW_PX - 2);
    expect(height).toBeLessThanOrEqual(FIGLET_ROW_PX + 2);

    const composerShell = glyphChannelPane(page).locator(".glyph-channel-composer");
    const shellWidth = await composerShell.evaluate((el) => el.getBoundingClientRect().width);
    const wheelWidth = await wheel.evaluate((el) => el.getBoundingClientRect().width);
    expect(wheelWidth).toBeGreaterThan(shellWidth * 0.45);

    const engine = renderEngineRoller(page);
    const engineBox = await engine.boundingBox();
    expect(engineBox).not.toBeNull();
    const engineMidY = engineBox!.y + engineBox!.height / 2;
    const wheelMidY = wheelBox!.y + wheelBox!.height / 2;
    expect(Math.abs(engineMidY - wheelMidY)).toBeLessThan(6);
  });

  test("spinning and settled both show title in picker", async ({ page }) => {
    const wheel = onelineWheel(page);

    await wheelRoller(wheel, page, 480);

    await expect
      .poll(async () => readCenterBandText(wheel, "oneline-title"), { timeout: 5000 })
      .not.toBe("");

    await expect
      .poll(async () => readCenterBandText(wheel, "oneline-art"), { timeout: 8000 })
      .toBe("");

    const settledTitle = await readCenterBandText(wheel, "oneline-title");
    expect(settledTitle.length).toBeGreaterThan(0);
  });

  test("wheel settle writes ascii into composer for enter-to-render", async ({ page }) => {
    const wheel = onelineWheel(page);
    const composer = glyphComposer(page);

    await wheelRoller(wheel, page, 320);

    await expect
      .poll(async () => (await composer.inputValue()).trim(), { timeout: 10000 })
      .not.toBe("");

    const composerValue = await composer.inputValue();

    expect(composerValue.trim().length).toBeGreaterThan(0);
    expect(await readCenterBandText(wheel, "oneline-art")).toBe("");
    expect(await readCenterBandText(wheel, "oneline-title")).not.toBe("");
  });

  test("oneline roller keeps full width while scrolling", async ({ page }) => {
    const wheel = onelineWheel(page);
    const settledWidth = await wheel.evaluate((el) => el.getBoundingClientRect().width);
    expect(settledWidth).toBeGreaterThan(120);

    await wheelRoller(wheel, page, 320);

    const spinningWidth = await wheel.evaluate((el) => el.getBoundingClientRect().width);
    expect(Math.abs(spinningWidth - settledWidth)).toBeLessThanOrEqual(4);

    const title = await readCenterBandText(wheel, "oneline-title");
    expect(title.length).toBeGreaterThan(2);
  });
});
