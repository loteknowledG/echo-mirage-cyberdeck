import { expect, test, type Locator, type Page } from "@playwright/test";

const DESKTOP_VIEWPORT = { width: 1280, height: 720 };
const BOOT_KEY = "echo-mirage-boot-completed-v1";

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
  await sendDeckCommand(page, "new tab named figlet audit glyph G");
  await expect(page.getByText(/TAB_CREATED.*figlet audit/i)).toBeVisible({ timeout: 15000 });

  const auditTab = page.locator("cyberdeck-rail-tab").filter({ hasText: "G" }).last();
  await auditTab.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Ascii" }).click();

  await expect(page.locator('[data-pointer-target="glyph-channel"]')).toBeVisible({
    timeout: 30000,
  });
}

function glyphChannelPane(page: Page) {
  return page.locator('[data-pointer-target="glyph-channel"]');
}

function figletFontRoller(page: Page) {
  return glyphChannelPane(page).locator('[aria-label="Figlet font"]');
}

function renderEngineRoller(page: Page) {
  return glyphChannelPane(page).locator('[aria-label="Render engine"]');
}

/** Font name in the centered selection band of the y-axis roller. */
async function readCenteredFontName(roller: Locator): Promise<string> {
  return roller.evaluate((el) => {
    const rowPx =
      Number.parseFloat(getComputedStyle(el).getPropertyValue("--float-wheel-row-px")) || 28;
    const panelRect = el.getBoundingClientRect();
    const centerY = panelRect.top + panelRect.height / 2;

    for (const span of el.querySelectorAll("span")) {
      const rect = span.getBoundingClientRect();
      if (rect.height < 1) continue;
      const spanCenter = rect.top + rect.height / 2;
      if (Math.abs(spanCenter - centerY) > rowPx / 2) continue;
      const text = span.textContent?.trim() ?? "";
      if (text.length > 0) return text;
    }

    return "";
  });
}

/**
 * Regression guard for figlet toolbar roller visibility:
 * panel must be wide/opaque and show a readable centered font name.
 */
async function expectFigletFontRollerVisible(page: Page) {
  const roller = figletFontRoller(page);
  await expect(roller).toBeVisible({ timeout: 15000 });

  await expect
    .poll(async () => readCenteredFontName(roller), { timeout: 10000 })
    .not.toBe("");

  const layout = await roller.evaluate((el) => {
    const panel =
      el.querySelector(".rounded.border") ??
      el.querySelector('[class*="rounded"]') ??
      el;
    const box = panel.getBoundingClientRect();
    const style = getComputedStyle(panel);
    const labelSpan = [...panel.querySelectorAll("span")].find((span) => {
      const text = span.textContent?.trim() ?? "";
      const rect = span.getBoundingClientRect();
      return text.length > 0 && rect.width > 24 && rect.height >= 6;
    });
    const labelBox = labelSpan?.getBoundingClientRect();
    return {
      panelWidth: Math.max(box.width, (panel as HTMLElement).offsetWidth),
      labelWidth: labelBox?.width ?? 0,
      labelHeight: labelBox?.height ?? 0,
      opacity: Number.parseFloat(style.opacity),
      background: style.backgroundColor,
    };
  });

  expect(layout.panelWidth, "figlet font roller should span toolbar width").toBeGreaterThanOrEqual(80);
  expect(layout.labelWidth, "figlet font label should be readable width").toBeGreaterThan(40);
  expect(layout.labelHeight, "figlet font label should be readable height").toBeGreaterThan(6);
  expect(layout.opacity, "figlet font roller must not be fully transparent").toBeGreaterThan(0.5);
  expect(layout.background, "figlet font roller panel should not be transparent").not.toBe(
    "rgba(0, 0, 0, 0)",
  );

  return readCenteredFontName(roller);
}

async function expectRollerNoOverflowChrome(roller: Locator) {
  const metrics = await roller.evaluate((el) => {
    const panel =
      el.querySelector(".rounded.border") ??
      el.querySelector('[class*="rounded"]') ??
      el;
    const panelStyle = getComputedStyle(panel);
    const labelSpan = [...panel.querySelectorAll("span")].find((span) => {
      const text = span.textContent?.trim() ?? "";
      const rect = span.getBoundingClientRect();
      return text.length > 0 && rect.width > 24 && rect.height >= 6;
    });
    const labelStyle = labelSpan ? getComputedStyle(labelSpan) : null;
    const autoOverflowNodes = [...panel.querySelectorAll("*")].filter((node) => {
      const style = getComputedStyle(node);
      return style.overflowX === "auto" || style.overflowX === "scroll";
    }).length;
    return {
      panelOverflowX: panelStyle.overflowX,
      panelOverflowY: panelStyle.overflowY,
      labelOverflowX: labelStyle?.overflowX ?? "",
      autoOverflowNodes,
    };
  });
  expect(metrics.panelOverflowX).not.toBe("visible");
  expect(metrics.panelOverflowY).not.toBe("visible");
  expect(metrics.labelOverflowX).not.toBe("auto");
  expect(metrics.labelOverflowX).not.toBe("scroll");
  expect(metrics.autoOverflowNodes).toBe(0);
}

async function expectRollerWidthStableWhileScrolling(
  roller: Locator,
  page: Page,
  readLabel: (roller: Locator) => Promise<string>,
) {
  const settledWidth = await roller.evaluate((el) => el.getBoundingClientRect().width);
  expect(settledWidth).toBeGreaterThan(120);

  await roller.hover();
  await page.mouse.wheel(0, 240);
  await page.waitForTimeout(200);

  const spinningWidth = await roller.evaluate((el) => el.getBoundingClientRect().width);
  expect(Math.abs(spinningWidth - settledWidth)).toBeLessThanOrEqual(4);

  await expect.poll(async () => readLabel(roller), { timeout: 8000 }).not.toBe("");
  const spinningLabel = await readLabel(roller);
  expect(spinningLabel.length).toBeGreaterThan(2);
}

async function wheelRoller(roller: Locator, page: Page, deltaY: number) {
  await roller.hover();
  await page.mouse.wheel(0, deltaY);
  await page.waitForTimeout(500);
}

test.describe("Glyph channel Figlet font roller", () => {
  test.beforeEach(async ({ page }) => {
    await openCyberdeck(page);
    await openGlyphChannelTab(page);
  });

  test("FIGLET engine shows visible font roller in glyph toolbar", async ({ page }) => {
    await expect(renderEngineRoller(page)).toBeVisible();
    const font = await expectFigletFontRollerVisible(page);
    expect(font).toMatch(/ANSI Shadow|All|Standard/i);
  });

  test("font roller scrolls to a different figlet font", async ({ page }) => {
    const roller = figletFontRoller(page);
    const initialFont = await expectFigletFontRollerVisible(page);

    await wheelRoller(roller, page, 200);
    await expect
      .poll(async () => readCenteredFontName(roller), { timeout: 5000 })
      .not.toBe(initialFont);
  });

  test("figlet roller keeps full width with no overflow chrome while scrolling", async ({ page }) => {
    const roller = figletFontRoller(page);
    await expectFigletFontRollerVisible(page);
    await expectRollerNoOverflowChrome(roller);
    await expectRollerWidthStableWhileScrolling(roller, page, readCenteredFontName);
  });
});
