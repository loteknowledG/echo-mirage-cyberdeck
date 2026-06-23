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
async function expectPowerfistReady(page: import("@playwright/test").Page) {
  await expect(page.getByTestId("preview-matrix")).toBeVisible({ timeout: 15000 });
  await expect(page.getByLabel("PowerFist target pane")).toBeVisible();
}

async function armSelectedCard(page: import("@playwright/test").Page) {
  const card = page.locator(".deckSlide.is-selected .cardSlide.is-selected .card");
  const box = await card.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(980);
  await page.mouse.up();
  await expect(page.getByTestId("powerfist-open-card")).toBeVisible();
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
  expect(visible.title?.length ?? 0).toBeGreaterThan(0);
  return visible.title;
}

async function expectFocusedCardContainedInMatrix(page: import("@playwright/test").Page) {
  const contained = await page.evaluate(() => {
    const matrix = document.querySelector(".powerfist-preview-root .matrix");
    const card = document.querySelector(
      ".powerfist-preview-root .cardSlide.is-selected .card",
    );
    if (!matrix || !card) return { ok: false, reason: "missing nodes" };
    const m = matrix.getBoundingClientRect();
    const r = card.getBoundingClientRect();
    const ok = r.top >= m.top && r.bottom <= m.bottom;
    return {
      ok,
      reason: ok
        ? "ok"
        : `card vertical box ${Math.round(r.top)}..${Math.round(r.bottom)} outside matrix ${Math.round(m.top)}..${Math.round(m.bottom)}`,
    };
  });
  expect(contained.ok, contained.reason).toBe(true);
}

async function expectFocusedCardCenteredInActiveHand(page: import("@playwright/test").Page) {
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const deck = document.querySelector(".powerfist-preview-root .deckSlide.is-selected");
        const hand = deck?.querySelector(".handViewport")?.getBoundingClientRect();
        const card = deck?.querySelector(".cardSlide.is-selected .card")?.getBoundingClientRect();
        if (!hand || !card) return Number.POSITIVE_INFINITY;
        return Math.abs(card.left + card.width / 2 - (hand.left + hand.width / 2));
      }),
    )
    .toBeLessThanOrEqual(2);
}

async function dragCompactCard(
  page: import("@playwright/test").Page,
  direction: "left" | "right",
) {
  const hand = page.locator(".powerfist-preview-root .handViewport").first();
  const box = await hand.boundingBox();
  expect(box).not.toBeNull();
  const y = box!.y + box!.height * 0.5;
  const startX = direction === "left" ? box!.x + box!.width * 0.8 : box!.x + box!.width * 0.2;
  const endX = direction === "left" ? box!.x + box!.width * 0.2 : box!.x + box!.width * 0.8;
  await page.mouse.move(startX, y);
  await page.mouse.down();
  await page.mouse.move(endX, y, { steps: 8 });
  await page.mouse.up();
}

test.describe("Rola Dex / Preview matrix", () => {
  test("/preview route shows focused card inside matrix", async ({ page }) => {
    await page.goto("/preview", { waitUntil: "domcontentloaded" });
    await expectPowerfistReady(page);
    const title = await expectFocusedCardVisibleInMatrix(page);
    expect(title).toContain("Capture");
    await expect(page.locator(".powerfist-preview-root .card")).toHaveCount(54);
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
    await expectPowerfistReady(page);
    await expectFocusedCardVisibleInMatrix(page);
  });

  test("deck and card controls update focused card", async ({ page }) => {
    await page.goto("/preview", { waitUntil: "domcontentloaded" });
    await expectPowerfistReady(page);

    await page.getByRole("button", { name: "Move deck up" }).click();
    await page.waitForTimeout(450);
    await expectFocusedCardVisibleInMatrix(page);

    await page.getByRole("button", { name: "Move cards left" }).click();
    await page.waitForTimeout(450);
    await expectFocusedCardVisibleInMatrix(page);
  });

  test("single-card mode card controls move left and right", async ({ page }) => {
    await page.setViewportSize({ width: 420, height: 900 });
    await page.goto("/preview", { waitUntil: "domcontentloaded" });
    await expectPowerfistReady(page);
    await expect(page.locator(".powerfist-preview-root")).toHaveAttribute(
      "data-compact-cards",
      "true",
    );

    await page.getByRole("button", { name: "Move cards left" }).click();
    await expect(page.locator(".cardTitle", { hasText: "Request Codex Review" })).toBeVisible();

    await page.getByRole("button", { name: "Move cards right" }).click();
    await expect(page.locator(".cardTitle", { hasText: "Capture Builder Result" })).toBeVisible();
  });

  test("single-card mode matrix remains square while shrinking", async ({ page }) => {
    await page.setViewportSize({ width: 420, height: 900 });
    await page.goto("/preview", { waitUntil: "domcontentloaded" });
    await expectPowerfistReady(page);

    const wideCompactSize = await page.locator(".matrixStage").evaluate((stage) => {
      const box = stage.getBoundingClientRect();
      return { width: box.width, height: box.height };
    });
    expect(Math.abs(wideCompactSize.width - wideCompactSize.height)).toBeLessThanOrEqual(1);

    await page.setViewportSize({ width: 340, height: 900 });
    const narrowCompactSize = await page.locator(".matrixStage").evaluate((stage) => {
      const box = stage.getBoundingClientRect();
      return { width: box.width, height: box.height };
    });
    expect(Math.abs(narrowCompactSize.width - narrowCompactSize.height)).toBeLessThanOrEqual(1);
    expect(narrowCompactSize.width).toBeLessThan(wideCompactSize.width);
  });

  test("single-card mode horizontal drag moves between cards", async ({ page }) => {
    await page.setViewportSize({ width: 420, height: 900 });
    await page.goto("/preview", { waitUntil: "domcontentloaded" });
    await expectPowerfistReady(page);

    await dragCompactCard(page, "left");
    await expect(page.locator(".cardTitle", { hasText: "Request Codex Review" })).toBeVisible();
  });

  test("single-card mode repeated drags preserve direction and wraparound", async ({ page }) => {
    await page.setViewportSize({ width: 420, height: 900 });
    await page.goto("/preview", { waitUntil: "domcontentloaded" });
    await expectPowerfistReady(page);

    await dragCompactCard(page, "left");
    await expect(page.locator(".cardTitle", { hasText: "Request Codex Review" })).toBeVisible();
    await dragCompactCard(page, "left");
    await expect(page.locator(".cardTitle", { hasText: "Archive Outcome" })).toBeVisible();
    await dragCompactCard(page, "right");
    await expect(page.locator(".cardTitle", { hasText: "Request Codex Review" })).toBeVisible();
    await dragCompactCard(page, "right");
    await expect(page.locator(".cardTitle", { hasText: "Capture Builder Result" })).toBeVisible();
    await dragCompactCard(page, "right");
    await expect(page.locator(".cardTitle", { hasText: "Emergency Halt" })).toBeVisible();
  });

  test("single-card mode keeps nested horizontal carousel motion", async ({ page }) => {
    await page.setViewportSize({ width: 420, height: 900 });
    await page.goto("/preview", { waitUntil: "domcontentloaded" });
    await expectPowerfistReady(page);
    await expect(page.locator(".powerfist-preview-root .card")).toHaveCount(54);

    const hand = page.locator(".powerfist-preview-root .handViewport").first();
    const box = await hand.boundingBox();
    expect(box).not.toBeNull();
    const y = box!.y + box!.height * 0.5;
    await page.mouse.move(box!.x + box!.width * 0.8, y);
    await page.mouse.down();
    await page.mouse.move(box!.x + box!.width * 0.45, y, { steps: 6 });
    await expect
      .poll(async () =>
        page
          .locator(".powerfist-preview-root .handContainer")
          .first()
          .evaluate((container) => getComputedStyle(container).transform),
      )
      .not.toBe("none");
    await page.mouse.move(box!.x + box!.width * 0.2, y, { steps: 4 });
    await page.mouse.up();
    await expect(page.locator(".cardTitle", { hasText: "Request Codex Review" })).toBeVisible();
  });

  test("single-card mode preserves drag-free power swipe motion", async ({ page }) => {
    await page.setViewportSize({ width: 420, height: 900 });
    await page.goto("/preview", { waitUntil: "domcontentloaded" });
    await expectPowerfistReady(page);

    const hand = page.locator(".powerfist-preview-root .handViewport").first();
    const box = await hand.boundingBox();
    expect(box).not.toBeNull();
    const y = box!.y + box!.height * 0.5;
    await page.mouse.move(box!.x + box!.width * 0.75, y);
    await page.mouse.down();
    await page.mouse.move(box!.x + box!.width * 0.5, y, { steps: 4 });

    await expect
      .poll(async () =>
        page
          .locator(".powerfist-preview-root .handContainer")
          .first()
          .evaluate((container) => getComputedStyle(container).transform),
      )
      .not.toBe("none");
    const transformWhileDragging = await page
      .locator(".powerfist-preview-root .handContainer")
      .first()
      .evaluate((container) => getComputedStyle(container).transform);
    expect(transformWhileDragging).not.toBe("matrix(1, 0, 0, 1, 0, 0)");

    await page.mouse.move(box!.x + box!.width * 0.15, y, { steps: 2 });
    await page.mouse.up();
    const transformAfterRelease = await page
      .locator(".powerfist-preview-root .handContainer")
      .first()
      .evaluate((container) => getComputedStyle(container).transform);
    expect(transformAfterRelease).not.toBe("none");
    expect(transformAfterRelease).not.toBe("matrix(1, 0, 0, 1, 0, 0)");
    await page.waitForTimeout(1200);
    await expectFocusedCardVisibleInMatrix(page);
    await expectFocusedCardCenteredInActiveHand(page);
  });

  test("multi-card mode keeps the focused card inside the matrix", async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 900 });
    await page.goto("/preview", { waitUntil: "domcontentloaded" });
    await expectPowerfistReady(page);
    await expect(page.locator(".powerfist-preview-root")).toHaveAttribute(
      "data-compact-cards",
      "false",
    );
    await expectFocusedCardContainedInMatrix(page);
  });

  test("neighbor decks peek above and below the focused deck", async ({ page }) => {
    await page.goto("/preview", { waitUntil: "domcontentloaded" });
    await expectPowerfistReady(page);

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
    await expectPowerfistReady(page);

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

  test("composer only appears on armed cards that need tool input", async ({ page }) => {
    await page.setViewportSize({ width: 420, height: 900 });
    await page.goto("/preview", { waitUntil: "domcontentloaded" });
    await expectPowerfistReady(page);
    await expect(page.getByLabel("PowerFist instruction")).toHaveCount(0);
    await armSelectedCard(page);
    await expect(page.getByLabel("PowerFist instruction")).toHaveCount(0);
    await page.getByRole("button", { name: "Close" }).click();

    for (let i = 0; i < 5; i += 1) {
      await page.getByRole("button", { name: "Move deck down" }).click();
    }
    await page.getByRole("button", { name: "Move cards left" }).click();
    await armSelectedCard(page);
    const openCard = page.getByTestId("powerfist-open-card");
    await expect(openCard).toContainText("Open File");
    await expect(page.getByLabel("PowerFist instruction")).toBeVisible();
    await page.getByLabel("PowerFist instruction").fill("src/app/preview/preview-matrix.tsx");
  });

  test("glyph channel target exposes text, one-line ASCII, and figlet decks", async ({ page }) => {
    await page.setViewportSize({ width: 420, height: 900 });
    await page.goto("/preview", { waitUntil: "domcontentloaded" });
    await expectPowerfistReady(page);

    await page.getByLabel("PowerFist target pane").hover();
    for (let step = 0; step < 11; step += 1) {
      await page.mouse.wheel(0, 120);
      await page.waitForTimeout(90);
    }

    await expect(page.locator(".cardTitle", { hasText: "Render Plain Text" })).toBeVisible();
    await page.getByRole("button", { name: "Move deck up" }).click();
    await expect(page.locator(".cardSlide.is-selected .cardArtifactPreviewOneline")).toBeVisible();
    await page.getByRole("button", { name: "Move deck up" }).click();
    await expect(page.locator(".cardSlide.is-selected .cardArtifactPreviewFiglet")).toBeVisible();
  });

  test("long press prepares the card and reveals push on completion", async ({ page }) => {
    await page.setViewportSize({ width: 420, height: 900 });
    await page.goto("/preview", { waitUntil: "domcontentloaded" });
    const card = page.locator(".deckSlide.is-selected .cardSlide.is-selected .card");
    const box = await card.boundingBox();
    expect(box).not.toBeNull();

    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.down();
    await expect(card).toHaveClass(/is-arming/);
    await page.waitForTimeout(980);
    await expect(card).not.toHaveClass(/is-arming/);
    await page.mouse.up();
    await expect(card).toHaveClass(/is-armed/);
    const openCard = page.getByTestId("powerfist-open-card");
    await expect(openCard).toContainText("Prepared // Locked");
    const viewportFit = await page.evaluate(() => {
      const matrix = document.querySelector(".powerfist-preview-root .matrix")?.getBoundingClientRect();
      const open = document
        .querySelector('[data-testid="powerfist-open-card"]')
        ?.getBoundingClientRect();
      return matrix && open
        ? {
            heightDelta: Math.abs(matrix.height - open.height),
            widthDelta: Math.abs(matrix.width - open.width),
          }
        : null;
    });
    expect(viewportFit).not.toBeNull();
    expect(viewportFit?.heightDelta).toBeLessThanOrEqual(2);
    expect(viewportFit?.widthDelta).toBeLessThanOrEqual(2);
    await expect(openCard.getByRole("button", { name: "Close" })).toBeVisible();
    await page.evaluate(() => {
      window.addEventListener(
        "echo-mirage:powerfist-stack-push",
        (event) => {
          (window as typeof window & { __powerfistPush?: unknown }).__powerfistPush = (
            event as CustomEvent
          ).detail;
        },
        { once: true },
      );
    });
    await openCard.getByRole("button", { name: "Push" }).click();
    const pushReceipt = page.getByTestId("powerfist-push-receipt");
    await expect(pushReceipt).toContainText(/Pushed Capture Builder Result/i);
    await expect(card).not.toHaveClass(/is-armed/);
    await expect
      .poll(() =>
        page.evaluate(
          () => (window as typeof window & { __powerfistPush?: unknown }).__powerfistPush,
        ),
      )
      .toMatchObject({
        kind: "powerfist-stack-push",
        actor: "operator",
        card: {
          title: "Capture Builder Result",
          deckName: "Execution Deck",
        },
        targetPane: "OPERATOR",
      });
    await expect(pushReceipt).toHaveCount(0, { timeout: 3500 });
  });

  test("dragging the card remains a carousel swipe without pushing", async ({ page }) => {
    await page.setViewportSize({ width: 420, height: 900 });
    await page.goto("/preview", { waitUntil: "domcontentloaded" });
    const card = page.locator(".cardSlide.is-selected .card");
    const box = await card.boundingBox();
    expect(box).not.toBeNull();

    const y = box!.y + box!.height / 2;
    await page.mouse.move(box!.x + box!.width * 0.75, y);
    await page.mouse.down();
    await page.mouse.move(box!.x + box!.width * 0.25, y, { steps: 5 });
    await page.mouse.up();
    await expect(page.locator(".cardSlide.is-selected .cardTitle")).not.toHaveText(
      "Capture Builder Result",
    );
  });
});
