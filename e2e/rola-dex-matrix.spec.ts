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
    await sendDeckCommand(page, "new tab named rola audit glyph R");
    await expect(page.getByText(/TAB_CREATED.*rola audit/i)).toBeVisible({ timeout: 15000 });

    const auditTab = page.locator("cyberdeck-rail-tab").filter({ hasText: "R" }).last();
    await auditTab.click({ button: "right" });
    await page.getByRole("menuitem", { name: "Rola Dex" }).click();

    await expect(page.locator(".cyberdeck-rola-dex-pane")).toBeVisible({ timeout: 30000 });
    await expect(page.getByText("POWERFIST MATRIX")).toBeVisible({ timeout: 15000 });
    await expectFocusedCardVisibleInMatrix(page);
  });

  test("deck and card controls update focused card", async ({ page }) => {
    await page.goto("/preview", { waitUntil: "domcontentloaded" });
    await expect(page.getByText("POWERFIST MATRIX")).toBeVisible();

    await page.getByRole("button", { name: "Next deck" }).click();
    await expect(page.getByText(/POWERFIST MATRIX.*Diagnostics Deck/i)).toBeVisible({
      timeout: 5000,
    });
    await expectFocusedCardVisibleInMatrix(page);

    await page.getByRole("button", { name: "Next card" }).click();
    await expectFocusedCardVisibleInMatrix(page);
  });

  test("neighbor decks peek above and below the focused deck", async ({ page }) => {
    await page.goto("/preview", { waitUntil: "domcontentloaded" });
    await expect(page.getByText("POWERFIST MATRIX")).toBeVisible();

    const peek = await page.evaluate(() => {
      const matrix = document.querySelector(".powerfist-preview-root .matrix");
      if (!matrix) return { ok: false, reason: "no matrix" };
      const m = matrix.getBoundingClientRect();
      const slides = [...document.querySelectorAll(".powerfist-preview-root .deckSlide")];
      let neighborBands = 0;

      for (const slide of slides) {
        if (slide.classList.contains("is-selected")) continue;
        const r = slide.getBoundingClientRect();
        const visible = r.height > 24 && r.bottom > m.top + 4 && r.top < m.bottom - 4;
        if (visible) neighborBands += 1;
      }

      return { ok: neighborBands >= 1, neighborBands, matrixH: Math.round(m.height) };
    });

    expect(peek.ok, `expected >=1 neighbor deck band, got ${peek.neighborBands}`).toBe(true);
    await expectFocusedCardVisibleInMatrix(page);
  });

  test("horizontal drag on hand scrolls cards", async ({ page }) => {
    await page.goto("/preview", { waitUntil: "domcontentloaded" });
    await expect(page.getByText("POWERFIST MATRIX")).toBeVisible();

    const hand = page.locator(".powerfist-preview-root .handViewport").first();
    const box = await hand.boundingBox();
    expect(box).not.toBeNull();

    const y = box!.y + box!.height * 0.5;
    await page.mouse.move(box!.x + box!.width * 0.8, y);
    await page.mouse.down();
    await page.mouse.move(box!.x + box!.width * 0.2, y, { steps: 16 });
    await page.mouse.up();

    await page.waitForTimeout(400);

    const moved = await page.evaluate(() => {
      const handEmblaRoot = document.querySelector(
        ".powerfist-preview-root .handViewport .handContainer",
      ) as HTMLElement | null;
      if (!handEmblaRoot) return false;
      const transform = getComputedStyle(handEmblaRoot).transform;
      return transform !== "none" && transform !== "matrix(1, 0, 0, 1, 0, 0)";
    });
    expect(moved).toBe(true);
    await expectFocusedCardVisibleInMatrix(page);
  });
});
