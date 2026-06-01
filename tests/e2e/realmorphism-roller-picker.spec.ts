import { expect, test, type Locator, type Page } from "@playwright/test";

const DESKTOP_VIEWPORT = { width: 1280, height: 720 };
const BOOT_KEY = "echo-mirage-boot-completed-v1";
const ROLLER_TYPES = ["compact", "expand", "showroom"] as const;

async function openKit(page: Page) {
  await page.addInitScript((bootKey) => {
    window.localStorage.setItem(bootKey, "1");
  }, BOOT_KEY);

  await page.setViewportSize(DESKTOP_VIEWPORT);
  await page.goto("/cyberdeck", { waitUntil: "domcontentloaded", timeout: 120000 });
  await page
    .locator(
      'textarea[placeholder*="command"], input[placeholder*="command"], input[placeholder*="COMMAND"]',
    )
    .first()
    .waitFor({ state: "visible", timeout: 120000 });

  const railTab = page.locator("cyberdeck-rail-tab").first();
  await railTab.click({ button: "right" });
  await page.getByRole("menuitem", { name: /Open Realmorphism kit/i }).click();
  await expect(page.locator("[data-registry-kit-scroll]")).toBeVisible({ timeout: 15000 });
}

function picker(page: Page, rollerType: (typeof ROLLER_TYPES)[number]) {
  return page.locator(`[data-testid="realm-roller-picker"][data-roller-type="${rollerType}"]`);
}

async function scrollPickerIntoView(roller: Locator) {
  await roller.scrollIntoViewIfNeeded();
  await expect(roller).toBeVisible({ timeout: 15000 });
}

async function assertSingleSelected(roller: Locator) {
  await expect(roller.locator('[data-testid="realm-roller-picker-option"][data-selected="true"]')).toHaveCount(
    1,
  );
}

async function readSelectedValue(roller: Locator) {
  const selected = roller.locator('[data-testid="realm-roller-picker-option"][data-selected="true"]');
  await expect(selected).toHaveCount(1);
  return selected.getAttribute("data-option-value");
}

async function wheelPicker(roller: Locator, page: Page, deltaY: number) {
  await roller.scrollIntoViewIfNeeded();
  const box = await roller.boundingBox();
  expect(box).toBeTruthy();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.wheel(0, deltaY);
  await page.waitForTimeout(100);
}

async function waitForCatalog(roller: Locator) {
  await expect
    .poll(async () => roller.locator('[data-testid="realm-roller-picker-option"]').count(), {
      timeout: 15000,
    })
    .toBeGreaterThan(1);
}

async function assertLoopWrap(
  roller: Locator,
  page: Page,
  deltaY: number,
  maxSpins: number,
) {
  const start = await readSelectedValue(roller);
  expect(start).toBeTruthy();

  const seen = new Set<string>([start!]);
  let wrapped = false;

  for (let spin = 0; spin < maxSpins; spin += 1) {
    await wheelPicker(roller, page, deltaY);
    await assertSingleSelected(roller);
    const current = await readSelectedValue(roller);
    expect(current).toBeTruthy();
    seen.add(current!);
    if (current === start && seen.size > 1) {
      wrapped = true;
      break;
    }
  }

  expect(seen.size).toBeGreaterThan(1);
  expect(wrapped).toBe(true);
}

test.describe("Realmorphism Kit roller pickers — loop regression gate", () => {
  test.beforeEach(async ({ page }) => {
    await openKit(page);
  });

  for (const rollerType of ROLLER_TYPES) {
    test(`${rollerType} picker has exactly one selected option when settled`, async ({ page }) => {
      const roller = picker(page, rollerType);
      await scrollPickerIntoView(roller);
      await waitForCatalog(roller);
      await assertSingleSelected(roller);
    });

    test(`${rollerType} picker loops forward across catalog boundary`, async ({ page }) => {
      const roller = picker(page, rollerType);
      await scrollPickerIntoView(roller);
      await waitForCatalog(roller);

      const itemCount = await roller.locator('[data-testid="realm-roller-picker-option"]').count();
      expect(itemCount).toBeGreaterThan(1);

      const maxSpins = itemCount + 4;
      await assertLoopWrap(roller, page, 480, maxSpins);
    });

    test(`${rollerType} picker loops backward across catalog boundary`, async ({ page }) => {
      const roller = picker(page, rollerType);
      await scrollPickerIntoView(roller);
      await waitForCatalog(roller);

      const itemCount = await roller.locator('[data-testid="realm-roller-picker-option"]').count();
      expect(itemCount).toBeGreaterThan(1);

      const maxSpins = itemCount + 4;
      await assertLoopWrap(roller, page, -480, maxSpins);
    });
  }
});
