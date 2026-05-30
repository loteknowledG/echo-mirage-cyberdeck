import { expect, test } from "@playwright/test";

async function skipBootIfPresent(page: import("@playwright/test").Page) {
  const skipBoot = page.getByRole("button", { name: "Skip" });
  if (await skipBoot.isVisible().catch(() => false)) {
    await skipBoot.click();
    await expect(skipBoot).toBeHidden();
  }
}

async function sendDeckCommand(page: import("@playwright/test").Page, text: string) {
  const input = page
    .locator(
      'textarea[placeholder*="command"], input[placeholder*="command"], input[placeholder*="COMMAND"], input[placeholder*="GATEWAY"]',
    )
    .first();
  await input.waitFor({ state: "visible", timeout: 15000 });
  await expect(input).toBeEnabled({ timeout: 15000 });
  await input.click();
  await input.fill(text);
  await input.press("Enter");
}

/** Focused card chrome must intersect the matrix viewport (not scrolled off-screen). */
async function expectFocusedCardVisibleInMatrix(page: import("@playwright/test").Page) {
  const visible = await page.evaluate(() => {
    const matrix = document.querySelector(".powerfist-preview-root .matrix");
    const card = document.querySelector(
      ".powerfist-preview-root .cardSlide.is-selected .card",
    );
    if (!matrix || !card) return { ok: false, reason: "missing nodes" };
    const m = matrix.getBoundingClientRect();
    const r = card.getBoundingClientRect();
    const ok =
      r.width > 48 &&
      r.height > 48 &&
      r.bottom > m.top + 8 &&
      r.top < m.bottom - 8 &&
      r.right > m.left + 8 &&
      r.left < m.right - 8;
    return {
      ok,
      reason: ok
        ? "ok"
        : `card box ${Math.round(r.width)}x${Math.round(r.height)} @ ${Math.round(r.top)}`,
      title: card.querySelector(".cardTitle")?.textContent?.trim() ?? "",
    };
  });
  expect(visible.ok, visible.reason).toBe(true);
  expect(visible.title.length).toBeGreaterThan(0);
  return visible.title;
}

test.describe("Rola Dex / Preview matrix", () => {
  test("/preview route shows focused card inside matrix", async ({ page }) => {
    await page.goto("/preview", { waitUntil: "domcontentloaded" });
    await expect(page.getByText("POWERFIST MATRIX")).toBeVisible({ timeout: 15000 });
    const title = await expectFocusedCardVisibleInMatrix(page);
    expect(title).toContain("Capture");
    await expect(page.locator(".powerfist-preview-root .card")).toHaveCount(18);
  });

  test("cyberdeck rola-dex tab shows focused card inside matrix", async ({ page }) => {
    await page.goto("/cyberdeck", { waitUntil: "domcontentloaded", timeout: 120000 });
    await skipBootIfPresent(page);
    await page.waitForSelector("cyberdeck-rail-tab", { timeout: 120000 });
    await sendDeckCommand(page, "tab: rola-dex");
    await expect(page.locator(".cyberdeck-rola-dex-pane")).toBeVisible({ timeout: 30000 });
    await expect(page.getByText("POWERFIST MATRIX")).toBeVisible({ timeout: 15000 });
    await expectFocusedCardVisibleInMatrix(page);
  });

  test("deck and card controls update focused card", async ({ page }) => {
    await page.goto("/preview", { waitUntil: "domcontentloaded" });
    await expect(page.getByText("POWERFIST MATRIX")).toBeVisible();

    await page.getByRole("button", { name: "Deck ↓" }).click();
    await expect(page.getByText(/POWERFIST MATRIX.*Diagnostics Deck/i)).toBeVisible({
      timeout: 5000,
    });
    await expectFocusedCardVisibleInMatrix(page);

    await page.getByRole("button", { name: "Card →" }).click();
    await expectFocusedCardVisibleInMatrix(page);
  });

  test("diagonal drag from matrix moves deck and card together", async ({ page }) => {
    await page.goto("/preview", { waitUntil: "domcontentloaded" });
    await expect(page.getByText("POWERFIST MATRIX")).toBeVisible();

    const before = await page.evaluate(() => ({
      deck: document.querySelector(".powerfist-preview-root .status strong")?.textContent?.trim(),
      card: document
        .querySelectorAll(".powerfist-preview-root .status strong")[1]
        ?.textContent?.trim(),
    }));

    const matrix = page.locator(".powerfist-preview-root .matrix");
    const box = await matrix.boundingBox();
    expect(box).not.toBeNull();

    const startX = box!.x + box!.width * 0.5;
    const startY = box!.y + box!.height * 0.55;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 80, startY + 80, { steps: 12 });
    await page.mouse.up();

    await expect
      .poll(async () => {
        const after = await page.evaluate(() => ({
          deck: document
            .querySelector(".powerfist-preview-root .status strong")
            ?.textContent?.trim(),
          card: document
            .querySelectorAll(".powerfist-preview-root .status strong")[1]
            ?.textContent?.trim(),
        }));
        const deckMoved = after.deck !== before.deck;
        const cardMoved = after.card !== before.card;
        return deckMoved && cardMoved;
      })
      .toBe(true);

    await expectFocusedCardVisibleInMatrix(page);
  });
});
