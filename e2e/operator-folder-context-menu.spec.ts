import { expect, test, type Page } from "@playwright/test";

async function openCyberdeck(page: Page) {
  await page.goto("/cyberdeck", { waitUntil: "domcontentloaded" });
  await page.locator("cyberdeck-rail-tab").first().waitFor({ state: "visible", timeout: 120000 });
  const skipBoot = page.getByRole("button", { name: "Skip" });
  if (await skipBoot.isVisible().catch(() => false)) await skipBoot.click();
}

test("operator folder tree replaces generic context actions with copy file path", async ({ page }) => {
  await page.addInitScript(() => {
    (window as Window & { copiedOperatorPath?: string; echoMirageClipboard?: { writeText(text: string): void } })
      .echoMirageClipboard = {
      writeText(text: string) {
        (window as Window & { copiedOperatorPath?: string }).copiedOperatorPath = text;
      },
    };
    (window as Window & { echoMirageOpen?: unknown }).echoMirageOpen = {
      async pickConvertDocument() {
        return { canceled: true };
      },
      async pickOperatorFolder() {
        return { canceled: false, folderPath: "C:\\workspace\\docs", name: "docs" };
      },
      async listOperatorFolder(_rootPath: string, _relativePath: string, pathPrefix: string) {
        return {
          ok: true,
          nodes: [{ name: "readme.md", path: `${pathPrefix}/readme.md`, kind: "file" }],
        };
      },
      async readOperatorFile() {
        return { ok: false };
      },
      async writeOperatorFile() {
        return { ok: false };
      },
    };
  });
  await openCyberdeck(page);

  const input = page.locator('input[placeholder*="GATEWAY"], input[placeholder*="command"], input[placeholder*="COMMAND"]').first();
  await input.fill("new tab named files glyph F");
  await input.press("Enter");
  await expect(page.getByText("TAB_CREATED // files // GLYPH F")).toBeVisible({ timeout: 10000 });

  const filesTab = page.locator("cyberdeck-rail-tab").nth(3);
  await filesTab.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Document", exact: true }).click();
  await page.getByRole("button", { name: "Open folders" }).click();
  await page.getByRole("button", { name: "ADD FOLDER" }).click();
  await page.getByText("docs", { exact: true }).click();

  const file = page.getByText("readme.md", { exact: true });
  await expect(file).toBeVisible();
  await expect(file.locator("xpath=ancestor::button[1]").locator('img[data-vscode-icon="file_type_markdown.svg"]')).toBeVisible();
  await file.click({ button: "right" });

  await expect(page.getByRole("menu", { name: "Folder tree actions" })).toBeVisible();
  await expect(page.getByRole("menu", { name: "Gateway pane actions" })).toHaveCount(0);
  await page.getByRole("menuitem", { name: "COPY FILE PATH" }).click();

  await expect.poll(() => page.evaluate(() => (window as Window & { copiedOperatorPath?: string }).copiedOperatorPath)).toBe(
    "C:\\workspace\\docs\\readme.md",
  );
});
