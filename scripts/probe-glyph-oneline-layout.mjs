import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";

const BOOT_KEY = "echo-mirage-boot-completed-v1";

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.addInitScript((key) => localStorage.setItem(key, "1"), BOOT_KEY);
  await page.goto("http://127.0.0.1:3050/cyberdeck", { waitUntil: "domcontentloaded", timeout: 120000 });

  const input = page
    .locator('textarea[placeholder*="command"], input[placeholder*="command"], input[placeholder*="COMMAND"], input[placeholder*="GATEWAY"]')
    .first();
  await input.waitFor({ state: "visible", timeout: 120000 });
  await input.fill("new tab named layout probe glyph G");
  await input.press("Enter");
  await page.waitForTimeout(800);

  const auditTab = page.locator("cyberdeck-rail-tab").filter({ hasText: "G" }).last();
  await auditTab.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Ascii" }).click();
  await page.locator('[data-pointer-target="glyph-channel"]').waitFor({ state: "visible", timeout: 60000 });

  const pane = page.locator('[data-pointer-target="glyph-channel"]');
  const engine = pane.locator('[aria-label="Render engine"]');

  for (let i = 0; i < 8; i += 1) {
    const label = await engine.evaluate((el) => {
      const centerY = el.getBoundingClientRect().top + el.getBoundingClientRect().height / 2;
      for (const span of el.querySelectorAll("span")) {
        const rect = span.getBoundingClientRect();
        if (rect.height < 1) continue;
        if (Math.abs(rect.top + rect.height / 2 - centerY) > rect.height) continue;
        return span.textContent?.trim() ?? "";
      }
      return "";
    });
    if (/1\s*line/i.test(label)) break;
    await engine.hover();
    await page.mouse.wheel(0, 120);
    await page.waitForTimeout(350);
  }

  await page.waitForTimeout(1500);
  const wheel = pane.locator('[aria-label="One-line ASCII art"]');
  await wheel.waitFor({ state: "visible", timeout: 30000 });

  const metrics = await page.evaluate(() => {
    const paneEl = document.querySelector('[data-pointer-target="glyph-channel"]');
    const composer = paneEl?.querySelector(".glyph-channel-composer");
    const toolbarRow = composer?.querySelector(".border-t");
    const engine = paneEl?.querySelector('[aria-label="Render engine"]');
    const wheel = paneEl?.querySelector('[aria-label="One-line ASCII art"]');
    const zoom = paneEl?.querySelector('[aria-label="Decrease display zoom"]');
    const send = paneEl?.querySelector('[aria-label="Render"]');
    const rect = (el) => (el ? el.getBoundingClientRect() : null);
    return {
      composer: rect(composer),
      toolbarRow: rect(toolbarRow),
      engine: rect(engine),
      wheel: rect(wheel),
      zoom: rect(zoom),
      send: rect(send),
      wheelHtml: wheel?.outerHTML?.slice(0, 500),
    };
  });

  await mkdir("output/playwright", { recursive: true });
  await page.screenshot({ path: "output/playwright/glyph-oneline-layout-probe.png" });
  await writeFile("output/playwright/glyph-oneline-layout-probe.json", JSON.stringify(metrics, null, 2));
  console.log(JSON.stringify(metrics, null, 2));
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
