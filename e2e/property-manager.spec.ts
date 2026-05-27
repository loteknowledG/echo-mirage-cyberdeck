import { expect, test, type Page } from "@playwright/test";

const MOBILE_VIEWPORT = { width: 390, height: 844 };
const DESKTOP_VIEWPORT = { width: 1280, height: 900 };

async function openPropertyManager(page: Page, viewport = DESKTOP_VIEWPORT) {
  await page.setViewportSize(viewport);
  await page.goto("/property-manager", { waitUntil: "domcontentloaded" });
  const demo = page.getByTestId("property-manager-demo");
  await expect(demo).toBeVisible({ timeout: 120000 });
  await expect(demo).toHaveAttribute("data-hydrated", "true", { timeout: 120000 });
  await page.getByRole("button", { name: "SPEAKER ON" }).click();
  await expect(page.getByRole("button", { name: "SPEAKER OFF" })).toBeVisible();
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
  }));
  expect(overflow.documentWidth).toBeLessThanOrEqual(overflow.viewportWidth);
}

test("property manager desktop intake classifies emergency and prepares mocked escalation", async ({ page }) => {
  await openPropertyManager(page);

  await page.getByPlaceholder("Speak, or type a simulated tenant call...").fill(
    "My name is Rosa Kim in unit 4B. Water is pouring through the ceiling. Call me at 555-010-4421.",
  );
  await page.getByRole("button", { name: "SEND TEXT" }).click();

  await expect(page.getByTestId("transcript")).toContainText("If there is fire, smoke, gas odor, or immediate danger");
  await expect(page.getByTestId("classification")).toHaveText("EMERGENCY");
  await expect(page.getByTestId("ticket-draft")).toContainText('"priority": "emergency"');
  await expect(page.getByTestId("ticket-draft")).toContainText('"tenant_name": "Rosa Kim"');
  await expect(page.getByTestId("ticket-draft")).toContainText('"unit": "4B"');
  await expect(page.getByTestId("escalation")).toHaveText("EMERGENCY ESCALATION");
  await expect(page.getByTestId("voice-state")).toHaveText("IDLE");

  await page.getByRole("button", { name: "MOCK VENDOR DISPATCH" }).click();
  await expect(page.getByTestId("dispatch-status")).toHaveText("MOCK ESCALATION QUEUED // ON-CALL MANAGER + MAINTENANCE");

  await page.getByRole("button", { name: "SIMULATE AUTH_REQUIRED" }).click();
  await expect(page.getByTestId("transcript").getByText("AUTH_REQUIRED // NO RETRY LOOP // SUPERVISOR REVIEW NEEDED")).toHaveCount(1);
});

test("property manager browser voice transcript produces a ticket without crashing", async ({ page }) => {
  await page.addInitScript(() => {
    class MockRecognition {
      continuous = false;
      interimResults = false;
      lang = "";
      onstart: (() => void) | null = null;
      onend: (() => void) | null = null;
      onerror: ((event: { error?: string }) => void) | null = null;
      onresult: ((event: unknown) => void) | null = null;
      start() {
        this.onstart?.();
        this.onresult?.({
          resultIndex: 0,
          results: [{ isFinal: false, 0: { transcript: "the sink is" } }],
        });
        (window as unknown as { completePropertyRecognition: () => void }).completePropertyRecognition = () => {
          this.onresult?.({
            resultIndex: 0,
            results: [{ isFinal: true, 0: { transcript: "This is Jordan in unit 210. My sink is leaking. My number is 555-010-8812." } }],
          });
        };
      }
      stop() {
        this.onend?.();
      }
      abort() {}
    }
    (window as unknown as { SpeechRecognition: typeof MockRecognition }).SpeechRecognition = MockRecognition;
  });
  await openPropertyManager(page);

  await page.getByTestId("talk-button").click();
  await expect(page.getByTestId("interim-transcript")).toContainText("the sink is");
  await page.evaluate(() => (window as unknown as { completePropertyRecognition: () => void }).completePropertyRecognition());
  await expect(page.getByTestId("classification")).toHaveText("MAINTENANCE");
  await expect(page.getByTestId("ticket-draft")).toContainText('"category": "plumbing"');
  await expect(page.getByTestId("mic-message")).toContainText("TICKET UPDATED");
});

test("property manager remains single-column and reachable on mobile", async ({ page }) => {
  await openPropertyManager(page, MOBILE_VIEWPORT);
  await expectNoHorizontalOverflow(page);
  await expect(page.getByTestId("property-nav")).toBeVisible();
  await expect(page.getByTestId("talk-button")).toBeVisible();
  await expect(page.getByPlaceholder("Speak, or type a simulated tenant call...")).toBeVisible();

  const panelGeometry = await page.evaluate(() => {
    const transcript = document.querySelector('[aria-label="Live call transcript"]')!.getBoundingClientRect();
    const ticket = document.querySelector('[aria-label="Ticket draft"]')!.getBoundingClientRect();
    return { transcriptBottom: transcript.bottom, ticketTop: ticket.top };
  });
  expect(panelGeometry.ticketTop).toBeGreaterThanOrEqual(panelGeometry.transcriptBottom);
  await page.getByRole("button", { name: "SIMULATE AUTH_REQUIRED" }).scrollIntoViewIfNeeded();
  await expect(page.getByRole("button", { name: "SIMULATE AUTH_REQUIRED" })).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));

  await expect(page.getByTestId("property-manager-demo")).toHaveScreenshot("property-manager-mobile.png", {
    animations: "disabled",
    maxDiffPixels: 50,
  });
});

test("required routes retain mobile overflow and composer protections", async ({ page }) => {
  await page.setViewportSize(MOBILE_VIEWPORT);
  await page.goto("/send", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("ECHO MIRAGE // SEND")).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.goto("/cyberdeck", { waitUntil: "domcontentloaded" });
  const skipBoot = page.getByRole("button", { name: "Skip" });
  if (await skipBoot.isVisible().catch(() => false)) await skipBoot.click();
  await expect(page.locator("cyberdeck-rail-tab").first()).toBeVisible({ timeout: 20000 });
  await expect(page.locator(".cyberdeck-chat-app > .cyberdeck-message-box")).toBeVisible({ timeout: 10000 });
  await expectNoHorizontalOverflow(page);
});
