import { expect, test, type Locator, type Page } from "@playwright/test";

const DESKTOP_VIEWPORT = { width: 1280, height: 900 };

function dialerRoot(page: Page): Locator {
  return page.locator("[data-phone-dialer]");
}

async function ensureIdleDialer(page: Page) {
  const response = await page.request.get("/api/property-manager/call-sessions");
  expect(response.ok()).toBeTruthy();
  const body = (await response.json()) as {
    active?: { id: string } | null;
    incoming?: { id: string } | null;
  };

  const sessionId = body.active?.id ?? body.incoming?.id;
  if (!sessionId) return;

  const hangUp = await page.request.post(
    `/api/property-manager/call-sessions/${encodeURIComponent(sessionId)}/actions`,
    { data: { action: "hang_up" } },
  );
  expect(hangUp.ok()).toBeTruthy();
}

async function openDialer(page: Page) {
  const dialer = page.getByTestId("property-manager-phone-dialer");
  if (!(await dialer.isVisible().catch(() => false))) {
    const fab = page.getByTestId("property-manager-phone-dialer-fab");
    await expect(fab).toBeVisible({ timeout: 30000 });
    await fab.click();
  }
  await expect(dialer).toBeVisible();
  return dialer;
}

async function expectAsciiKeypadButton(dialer: Locator, digit: string, letters?: string) {
  const label = letters ? `${digit}, ${letters}` : digit;
  const button = dialer.getByRole("button", { name: label, exact: true });
  await expect(button).toBeVisible();

  const frame = button.locator(".ascii-morph-btn-frame");
  await expect(frame).toBeVisible();

  const faceText = await frame.innerText();
  expect(faceText.split("\n").length).toBeGreaterThanOrEqual(3);
  expect(faceText).toContain("┌");
  expect(faceText).toContain("└");
  expect(faceText).toMatch(new RegExp(`│\\s*${digit.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*│`));

  const styles = await frame.evaluate((element) => {
    const computed = getComputedStyle(element);
    return {
      whiteSpace: computed.whiteSpace,
      fontFamily: computed.fontFamily,
      lineHeight: computed.lineHeight,
    };
  });
  expect(styles.whiteSpace).toBe("pre");
  expect(styles.fontFamily.toLowerCase()).toMatch(/mono|cascadia|courier/);
  expect(Number.parseFloat(styles.lineHeight)).toBeLessThanOrEqual(12);
}

async function openCyberdeck(page: Page) {
  await page.setViewportSize(DESKTOP_VIEWPORT);
  await page.goto("/cyberdeck", { waitUntil: "domcontentloaded" });
  await page.locator("cyberdeck-rail-tab").first().waitFor({ state: "visible", timeout: 120000 });
  const skipBoot = page.getByRole("button", { name: "Skip" });
  if (await skipBoot.isVisible().catch(() => false)) {
    await skipBoot.click();
  }
  await expect(page.getByPlaceholder("Enter command or message...")).toBeVisible({ timeout: 30000 });
}

async function openCallCenterTab(page: Page) {
  const input = page.getByPlaceholder("Enter command or message...");
  await input.fill("new tab named pm-call glyph CC");
  await input.press("Enter");
  await expect(page.getByText(/TAB_CREATED.*pm-call/i)).toBeVisible({ timeout: 15000 });

  await input.fill("/tab convert to call-center");
  await input.press("Enter");
  await expect(page.getByText(/TAB_CONVERTED.*CALL-CENTER/i)).toBeVisible({ timeout: 15000 });
  await expect(page.getByText("TRAINING SIM // DRAG PHONE ANYWHERE IN PANE")).toBeVisible({
    timeout: 30000,
  });
}

test.beforeEach(async ({ page }) => {
  await ensureIdleDialer(page);
});

test("floating phone dialer keypad renders asciimorphism boxes on property manager", async ({ page }) => {
  await page.setViewportSize(DESKTOP_VIEWPORT);
  await page.goto("/property-manager", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("property-manager-case-viewer")).toBeVisible({ timeout: 30000 });

  await openDialer(page);
  const dialer = dialerRoot(page);
  await expectAsciiKeypadButton(dialer, "5", "JKL");

  const display = dialer.locator('[aria-live="polite"]');
  const before = await display.innerText();
  await dialer.getByRole("button", { name: "2, ABC", exact: true }).click();
  await expect(display).not.toHaveText(before);

  await expect(dialer.locator(".dialer-keypad-btn").first()).toHaveScreenshot(
    "phone-dialer-keypad-asciimorphism.png",
    { animations: "disabled", maxDiffPixels: 120 },
  );
});

test("property manager dialer stays usable after hang-up", async ({ page }) => {
  await page.setViewportSize(DESKTOP_VIEWPORT);
  await page.goto("/property-manager", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("property-manager-case-viewer")).toBeVisible({ timeout: 30000 });

  await openDialer(page);
  const dialer = dialerRoot(page);
  await expectAsciiKeypadButton(dialer, "3", "DEF");

  await dialer.getByRole("button", { name: "7, PQRS", exact: true }).click();
  const display = dialer.locator('[aria-live="polite"]');
  await expect(display).toContainText("7");

  const callButton = dialer.getByRole("button", { name: /^Call$/i });
  await expect(callButton).toBeEnabled();
  await callButton.click();

  const hangUp = dialer.getByRole("button", { name: "Hang up" });
  await expect(hangUp).toBeVisible({ timeout: 15000 });
  await hangUp.click();

  await expect(dialer.getByRole("button", { name: "3, DEF", exact: true })).toBeEnabled({
    timeout: 15000,
  });
  await expect(page.getByText("Loading phone state")).toHaveCount(0);
  await dialer.getByRole("button", { name: "9, WXYZ", exact: true }).click();
  await expect(display).toContainText("9");
});

test("call center tab dialer keypad renders asciimorphism boxes", async ({ page }) => {
  await openCyberdeck(page);
  await openCallCenterTab(page);

  await openDialer(page);
  const dialer = dialerRoot(page);
  await expectAsciiKeypadButton(dialer, "8", "TUV");
});
