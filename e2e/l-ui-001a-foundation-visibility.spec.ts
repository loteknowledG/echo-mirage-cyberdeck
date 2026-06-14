import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 1600, height: 1000 } });

async function skipBootIfPresent(page: import("@playwright/test").Page) {
  const skipBoot = page.getByRole("button", { name: "Skip" });
  if (await skipBoot.isVisible({ timeout: 5000 }).catch(() => false)) {
    await skipBoot.click();
    await expect(skipBoot).toBeHidden({ timeout: 15000 });
  }
}

async function sendDeckCommand(page: import("@playwright/test").Page, text: string) {
  const input = page.getByRole("textbox", { name: "MUTHUR command input" });
  await input.waitFor({ state: "visible", timeout: 30000 });
  await expect(input).toBeEnabled({ timeout: 30000 });
  await input.click();
  await input.fill(text);
  await input.press("Enter");
}

async function waitForMuthurComplete(page: import("@playwright/test").Page, timeoutMs = 180_000) {
  await expect(
    page.getByRole("button", { name: /MUTHUR complete/i }).or(page.getByText(/· MUTHUR complete/i)),
  ).toBeVisible({ timeout: timeoutMs });
}

async function activeProviderLabel(page: import("@playwright/test").Page): Promise<string> {
  const footer = page.getByRole("button", { name: /MUTHUR|NO_MODEL|deepseek|gpt|claude|openrouter/i }).first();
  return (await footer.innerText()).trim();
}

test.describe("L-UI-001A live foundation response visibility", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/cyberdeck", { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.waitForSelector(".cyberdeck-chat-app", { timeout: 120000 });
    await skipBootIfPresent(page);
  });

  test("page loads without fs boundary failure", async ({ page }) => {
    const body = await page.content();
    expect(body).not.toContain("Can't resolve 'fs'");
    expect(body).not.toContain("foundation-store");
    await expect(page.getByRole("textbox", { name: "MUTHUR command input" })).toBeVisible();
    await expect(page.locator(".cyberdeck-chat-app")).toBeVisible();
  });

  test("Test 1 — foundation origin query is visible and completes", async ({ page }) => {
    const provider = await activeProviderLabel(page);
    await sendDeckCommand(page, "Where did you come from?");
    const response = page.locator("[data-muthur-channel] [data-muthur-response]").last();
    await expect(response).toContainText(/Foundation-001/i, { timeout: 30000 });
    await expect(response).toContainText(/ORIGIN LINEAGE|origin artifact|Samus-Manus/i, {
      timeout: 30000,
    });
    await waitForMuthurComplete(page, 30000);
    await expect(response).toBeVisible();
    const diagnosticsToggle = page.locator("[data-muthur-diagnostics] button[aria-expanded]");
    if (await diagnosticsToggle.count()) {
      await expect(diagnosticsToggle.first()).toHaveAttribute("aria-expanded", "false");
    }
    await expect(page.getByText("Invalid API key")).toHaveCount(0);
    test.info().annotations.push({ type: "provider", description: provider });
  });

  test("Test 3 — diagnostics collapsed after foundation completion", async ({ page }) => {
    await sendDeckCommand(page, "Where did you come from?");
    await waitForMuthurComplete(page, 30000);
    const diagnosticsButton = page.locator("[data-muthur-diagnostics] button[aria-expanded]");
    if (await diagnosticsButton.count()) {
      await expect(diagnosticsButton.first()).toHaveAttribute("aria-expanded", "false");
    }
    await expect(page.locator("[data-muthur-channel] [data-muthur-response]").last()).toContainText(
      /Foundation-001/i,
    );
  });

  test("Test 2 — open L-ARCH-001.md reaches complete with visible response", async ({ page }) => {
    test.setTimeout(120_000);
    await sendDeckCommand(page, "open L-ARCH-001.md");
    const response = page.locator("[data-muthur-channel] [data-muthur-response]").last();
    await expect(response).toContainText(/Capability Authority Doctrine|L-ARCH-001/i, {
      timeout: 30000,
    });
    await expect(response).not.toContainText(/not currently open/i);
    await waitForMuthurComplete(page, 30000);
    await expect(response).toBeVisible();
    const diagnosticsButton = page.locator("[data-muthur-diagnostics] button[aria-expanded]");
    if (await diagnosticsButton.count()) {
      await expect(diagnosticsButton.first()).toHaveAttribute("aria-expanded", "false");
    }
  });
});
