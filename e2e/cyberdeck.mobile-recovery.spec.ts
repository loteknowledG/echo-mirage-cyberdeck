import { expect, test } from "@playwright/test";

test.use({
  viewport: { width: 390, height: 844 },
  userAgent:
    "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36",
});

test("mobile Cyberdeck sanitizes legacy Mirage queue state during startup", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const surveyTab = {
      id: "survey-mobile-recovery",
      label: "Survey",
      glyph: "◉",
      kind: "survey",
    };

    window.localStorage.setItem(
      "echo-mirage-workspace-v1",
      JSON.stringify({
        activeModuleId: null,
        customTabs: [surveyTab],
        activeCustomTabId: surveyTab.id,
      })
    );
    window.localStorage.setItem(
      "echo-mirage-ui-state-v1",
      JSON.stringify({
        server: "m",
        navRailContext: "gateway",
        customTabs: [surveyTab],
        activeCustomTabId: surveyTab.id,
      })
    );
    window.localStorage.setItem(
      "echo-mirage-survey-mirage-items-v1",
      JSON.stringify([
        {
          id: "legacy-item",
          title: "Legacy capture",
          prompt: { legacy: true },
          transcript: 5,
          source: "capture",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ])
    );
    window.localStorage.setItem("echo-mirage-survey-mirage-item-index-v1", "0");
  });

  await page.goto("/cyberdeck", { waitUntil: "domcontentloaded" });

  const restoredSurveyTab = page.locator(
    '[data-server-tab="survey-mobile-recovery"] .ascii-btn'
  );
  await expect(restoredSurveyTab).toBeVisible({ timeout: 120_000 });
  await restoredSurveyTab.click();

  await expect(page.locator('[data-pointer-target="survey"]')).toBeVisible({
    timeout: 120_000,
  });
  await expect(
    page.locator('[data-testid="survey-mirage-capture-preview"]')
  ).toBeVisible({ timeout: 120_000 });
  await expect(page.getByText("CYBERDECK // APP ERROR")).toHaveCount(0);
});
