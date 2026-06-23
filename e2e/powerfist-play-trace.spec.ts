import { expect, test, type Locator } from "@playwright/test";

async function centerOf(locator: Locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return {
    x: (box?.x ?? 0) + (box?.width ?? 0) / 2,
    y: (box?.y ?? 0) + (box?.height ?? 0) / 2,
  };
}

test("powerfist card long press prepares push without blocking swipe", async ({ page }) => {
  await page.goto("/preview");

  const card = page.getByTestId("card-slide-0-0");
  await expect(card).toBeVisible();

  const start = await centerOf(card);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await expect(card.locator(".card.is-arming")).toHaveCount(1);
  await page.waitForTimeout(980);
  await expect(card.locator(".card.is-arming")).toHaveCount(0);
  await page.mouse.up();
  await expect(card.locator(".card.is-armed")).toHaveCount(1);
  const openCard = page.getByTestId("powerfist-open-card");
  await expect(openCard).toContainText("Prepared // Locked");
  await expect(openCard.getByRole("button", { name: "Push" })).toBeVisible();
  const moveCardsLeft = page.getByRole("button", { name: "Move cards left" });
  await expect(moveCardsLeft).toHaveCount(0);
  await openCard.getByRole("button", { name: "Close" }).click();
  await expect(card.locator(".card.is-armed")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Move cards left" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Move cards left" })).toBeEnabled();
  await page.waitForTimeout(450);

  const dragStart = await centerOf(page.locator(".deckSlide.is-selected .cardSlide.is-selected"));
  await page.mouse.move(dragStart.x + 50, dragStart.y);
  await page.mouse.down();
  await page.mouse.move(dragStart.x - 50, dragStart.y, { steps: 4 });
  await page.mouse.up();
  await expect(page.getByTestId("powerfist-push-receipt")).toHaveCount(0);
});
