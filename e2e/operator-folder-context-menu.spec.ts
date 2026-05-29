import { expect, test, type Page } from "@playwright/test";

async function openCyberdeck(page: Page) {
  await page.goto("/cyberdeck", { waitUntil: "domcontentloaded" });
  await page.locator("cyberdeck-rail-tab").first().waitFor({ state: "visible", timeout: 120000 });
  const skipBoot = page.getByRole("button", { name: "Skip" });
  if (await skipBoot.isVisible().catch(() => false)) await skipBoot.click();
}

test("operator folder tree replaces generic context actions with copy file path", async ({ page }) => {
  await page.addInitScript(() => {
    if (!window.sessionStorage.getItem("operator-folder-context-menu-storage-seeded")) {
      window.localStorage.removeItem("echo-mirage-operator-folder-pane-open-v1");
      window.localStorage.removeItem("echo-mirage-operator-folder-pane-width-v1");
      window.localStorage.removeItem("echo-mirage-operator-folder-pane-state-v1");
      window.sessionStorage.setItem("operator-folder-context-menu-storage-seeded", "1");
    }
    let listCount = 0;
    (window as Window & {
      copiedOperatorPath?: string;
      echoMirageClipboard?: { readText(): Promise<string>; writeText(text: string): Promise<{ ok: boolean }> };
    })
      .echoMirageClipboard = {
      async readText() {
        return (window as Window & { copiedOperatorPath?: string }).copiedOperatorPath ?? "";
      },
      async writeText(text: string) {
        (window as Window & { copiedOperatorPath?: string }).copiedOperatorPath = text;
        return { ok: true };
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
        listCount += 1;
        const nodes: Array<{ name: string; path: string; kind: "file" | "folder" }> = [
          { name: "readme.md", path: `${pathPrefix}/readme.md`, kind: "file" },
        ];
        if (listCount > 1) {
          nodes.push({ name: "saved-note.md", path: `${pathPrefix}/saved-note.md`, kind: "file" });
        }
        return {
          ok: true,
          nodes,
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
  await expect(page.getByRole("button", { name: "Open folders" })).toBeVisible({ timeout: 120000 });
  await page.getByRole("button", { name: "Open folders" }).click();
  const resizeHandle = page.getByRole("separator", { name: "Resize folder pane" });
  await expect(resizeHandle).toBeVisible();
  const resizeBox = await resizeHandle.boundingBox();
  expect(resizeBox).not.toBeNull();
  await page.mouse.move(resizeBox!.x + resizeBox!.width / 2, resizeBox!.y + resizeBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(resizeBox!.x - 70, resizeBox!.y + resizeBox!.height / 2);
  await page.mouse.up();
  await expect
    .poll(() => page.evaluate(() => Number(window.localStorage.getItem("echo-mirage-operator-folder-pane-width-v1"))))
    .toBeGreaterThan(176);
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

  await file.click({ button: "right" });
  await page.getByRole("menuitem", { name: "REFRESH" }).click();
  await expect(page.getByText("readme.md", { exact: true })).toBeVisible();
  await expect(page.getByText("saved-note.md", { exact: true })).toBeVisible();

  await page.waitForTimeout(500);
  await page.reload({ waitUntil: "domcontentloaded" });
  const skipBoot = page.getByRole("button", { name: "Skip" });
  if (await skipBoot.isVisible().catch(() => false)) await skipBoot.click();

  await expect(page.getByText("docs", { exact: true })).toBeVisible();
  await expect(page.getByText("readme.md", { exact: true })).toBeVisible();
});
