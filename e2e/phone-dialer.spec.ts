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

type FaceTransform = { translateX: number; translateY: number };

async function faceTransform(button: Locator): Promise<FaceTransform> {
  return button.locator(".ascii-btn-face").evaluate((element) => {
    const matrix = new DOMMatrix(getComputedStyle(element).transform);
    return { translateX: matrix.m41, translateY: matrix.m42 };
  });
}

async function expectAsciiKeypadButton(dialer: Locator, digit: string, letters?: string) {
  const label = letters ? `${digit}, ${letters}` : digit;
  const button = dialer.getByRole("button", { name: label, exact: true });
  await expect(button).toBeVisible();

  const frame = button.locator(".ascii-btn-face");
  await expect(frame).toBeVisible();
  await expect(button.locator(":scope > span")).toHaveCount(0);

  const faceText = await frame.innerText();
  expect(faceText.split("\n").length).toBe(4);
  expect(faceText).toContain("┌");
  expect(faceText).toContain("└");
  expect(faceText).toMatch(new RegExp(`│\\s*${digit.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*│`));

  const shadowText = await button.locator(".ascii-btn-shadow").innerText();
  const shadowBottom = shadowText.split("\n").at(-1) ?? "";
  expect(shadowBottom.endsWith(" ")).toBeTruthy();
  expect(shadowBottom.trimEnd().endsWith("▓")).toBeTruthy();
  if (letters) {
    expect(faceText).toContain(letters);
    const buttonBox = await button.boundingBox();
    const faceBox = await frame.boundingBox();
    expect(buttonBox).not.toBeNull();
    expect(faceBox).not.toBeNull();
    if (buttonBox && faceBox) {
      const buttonRight = buttonBox.x + buttonBox.width;
      const buttonBottom = buttonBox.y + buttonBox.height;
      const faceRight = faceBox.x + faceBox.width;
      const faceBottom = faceBox.y + faceBox.height;
      expect(faceBox.x).toBeGreaterThanOrEqual(buttonBox.x - 1);
      expect(faceBox.y).toBeGreaterThanOrEqual(buttonBox.y - 1);
      expect(faceRight).toBeLessThanOrEqual(buttonRight + 1);
      expect(faceBottom).toBeLessThanOrEqual(buttonBottom + 1);
    }
  }

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
  expect(Number.parseFloat(styles.lineHeight)).toBeLessThanOrEqual(18);
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

test("dialer keypad keys are uniform height including 1 * #", async ({ page }) => {
  await page.setViewportSize(DESKTOP_VIEWPORT);
  await page.goto("/property-manager", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("property-manager-case-viewer")).toBeVisible({ timeout: 30000 });

  await openDialer(page);
  const dialer = dialerRoot(page);
  const one = dialer.getByRole("button", { name: "1", exact: true });
  const five = dialer.getByRole("button", { name: "5, JKL", exact: true });
  const star = dialer.getByRole("button", { name: "*", exact: true });
  const hash = dialer.getByRole("button", { name: "#", exact: true });

  const [oneBox, fiveBox, starBox, hashBox] = await Promise.all([
    one.boundingBox(),
    five.boundingBox(),
    star.boundingBox(),
    hash.boundingBox(),
  ]);
  for (const box of [oneBox, fiveBox, starBox, hashBox]) {
    expect(box).not.toBeNull();
  }
  if (oneBox && fiveBox && starBox && hashBox) {
    expect(oneBox.height).toBeCloseTo(fiveBox.height, 0);
    expect(starBox.height).toBeCloseTo(fiveBox.height, 0);
    expect(hashBox.height).toBeCloseTo(fiveBox.height, 0);
    expect(oneBox.width).toBeCloseTo(fiveBox.width, 0);
  }

  const oneFace = await one.locator(".ascii-btn-face").innerText();
  expect(oneFace.split("\n").length).toBe(4);
  expect(oneFace).toMatch(/│ {5}│/);
});

test("floating dialer fits led display keypad and call without scrolling", async ({ page }) => {
  await page.setViewportSize(DESKTOP_VIEWPORT);
  await page.goto("/property-manager", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("property-manager-case-viewer")).toBeVisible({ timeout: 30000 });

  await openDialer(page);
  const dialer = dialerRoot(page);
  const body = page.getByTestId("property-manager-phone-dialer-body");
  const led = dialer.locator('[aria-live="polite"]');
  const call = dialer.getByRole("button", { name: /^Call$/i });

  await expect(led).toBeVisible();
  await expect(call).toBeVisible();

  const fits = await body.evaluate((element) => ({
    scrollHeight: element.scrollHeight,
    clientHeight: element.clientHeight,
  }));
  expect(fits.scrollHeight).toBeLessThanOrEqual(fits.clientHeight + 1);
});

test("dialer keypad face lifts on hover and presses without hiding shadow", async ({ page }) => {
  await page.setViewportSize(DESKTOP_VIEWPORT);
  await page.goto("/property-manager", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("property-manager-case-viewer")).toBeVisible({ timeout: 30000 });

  await openDialer(page);
  const dialer = dialerRoot(page);
  const button = dialer.getByRole("button", { name: "5, JKL", exact: true });
  const shadow = button.locator(".ascii-btn-shadow");

  const atRest = await faceTransform(button);
  expect(atRest.translateY).toBeCloseTo(0, 0);
  expect(atRest.translateX).toBeCloseTo(0, 0);

  await button.hover();
  await page.waitForTimeout(280);
  const hovered = await faceTransform(button);
  expect(hovered.translateY).toBeLessThan(atRest.translateY - 2);
  expect(hovered.translateX).toBeLessThan(atRest.translateX);

  await button.hover();
  await page.waitForTimeout(80);
  const box = await button.boundingBox();
  expect(box).not.toBeNull();
  if (box) {
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await expect
      .poll(async () => (await faceTransform(button)).translateY, { timeout: 2000 })
      .toBeGreaterThan(2);
    await expect(shadow).toBeVisible();
    const shadowOpacity = await shadow.evaluate((element) => getComputedStyle(element).opacity);
    expect(Number.parseFloat(shadowOpacity)).toBeGreaterThan(0.4);
    await page.mouse.up();
  }
});

test("floating phone dialer keypad renders rail ascii boxes on property manager", async ({ page }) => {
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
    "phone-dialer-keypad-rail-ascii.png",
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

test("call center tab dialer keypad renders rail ascii boxes", async ({ page }) => {
  await openCyberdeck(page);
  await openCallCenterTab(page);

  await openDialer(page);
  const dialer = dialerRoot(page);
  await expectAsciiKeypadButton(dialer, "8", "TUV");
});
