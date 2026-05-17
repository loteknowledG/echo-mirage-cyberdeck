# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: cyberdeck.smoke.spec.ts >> cyberdeck renders and switches required alpha modules
- Location: e2e\cyberdeck.smoke.spec.ts:28:5

# Error details

```
Error: expect(locator).toHaveCount(expected) failed

Locator:  locator('cyberdeck-rail-tab')
Expected: 3
Received: 4
Timeout:  10000ms

Call log:
  - Expect "toHaveCount" with timeout 10000ms
  - waiting for locator('cyberdeck-rail-tab')
    13 × locator resolved to 4 elements
       - unexpected value "4"

```

# Page snapshot

```yaml
- generic [ref=e1]:
  - generic [ref=e3]:
    - complementary "Server rail" [ref=e4]:
      - generic [ref=e7] [cursor=pointer]: ┌───┐ │ Ø │ └───┘
      - generic [ref=e10] [cursor=pointer]: ┌───┐ │ μ │▓ └───┘▓ ▓▓▓▓▓
      - generic [ref=e13] [cursor=pointer]: ┌───┐ │ ◈ │▓ └───┘▓ ▓▓▓▓▓
      - generic [ref=e16] [cursor=pointer]: ┌───┐ │ § │▓ └───┘▓ ▓▓▓▓▓
      - button "+" [ref=e18] [cursor=pointer]
    - generic [ref=e19]:
      - generic [ref=e21]:
        - banner [ref=e23]:
          - generic [ref=e24]: "STATUS: NOMINAL ECHO MIRAGE"
          - generic [ref=e25]: _ _ _ _ _ ╱╲ ╲ ╱╲ ╲ ╱ ╱╲ ╱ ╱╲ ╱╲ ╲ ╱ ╲ ╲ ╱ ╲ ╲ ╱ ╱ ╱ ╱ ╱ ╱╱ ╲ ╲ ╱ ╱╲ ╲ ╲ ╱ ╱╲ ╲ ╲ ╱ ╱_╱ ╱ ╱ ╱╱ ╱╲ ╲ ╲ ╱ ╱ ╱╲ ╲_╲ ╱ ╱ ╱╲ ╲ ╲ ╱ ╱╲ ╲__╱ ╱ ╱╱ ╱ ╱╲ ╲ ╲ ╱ ╱_╱_ ╲╱_╱ ╱ ╱ ╱ ╲ ╲_╲ ╱ ╱╲ ╲___╲╱ ╱╱ ╱ ╱ ╲ ╲_╲ ╱ ╱____╱╲ ╱ ╱ ╱ ╲╱_╱ ╱ ╱ ╱╲╱___╱ ╱╱ ╱ ╱ ╱ ╱ ╱ ╱ ╱╲____╲╱ ╱ ╱ ╱ ╱ ╱ ╱ ╱ ╱ ╱╱ ╱ ╱ ╱ ╱ ╱ ╱ ╱ ╱______ ╱ ╱ ╱________ ╱ ╱ ╱ ╱ ╱ ╱╱ ╱ ╱___╱ ╱ ╱ ╱ ╱ ╱_______╲╱ ╱ ╱_________╲╱ ╱ ╱ ╱ ╱ ╱╱ ╱ ╱____╲╱ ╱ ╲╱__________╱╲╱____________╱╲╱_╱ ╲╱_╱ ╲╱_________╱
        - generic [ref=e27]:
          - generic [ref=e28]:
            - generic [ref=e29]: "[SYS]"
            - generic [ref=e31]:
              - text: ENTER OPENCODE KEY BELOW. create one by visiting
              - link "OpenCode console" [ref=e32] [cursor=pointer]:
                - /url: https://opencode.ai
              - text: .
          - generic [ref=e33]:
            - generic [ref=e34]: "[SYS]"
            - generic [ref=e35]: "MODEL_TEST OPENCODE/deepseek-v4-flash-free: HTTP_429 RATE_LIMIT"
          - generic [ref=e36]:
            - generic [ref=e37]: "[SYS]"
            - generic [ref=e38]: "MODEL_TEST OPENCODE/deepseek-v4-flash-free: HTTP_429 RATE_LIMIT"
        - contentinfo [ref=e39]:
          - generic [ref=e40]:
            - generic [ref=e41]:
              - generic: $
              - textbox "Enter command or message..." [ref=e42]
            - generic [ref=e43]:
              - button "DISCONNECTED" [ref=e44] [cursor=pointer]
              - generic [ref=e45]:
                - button "Voice on" [ref=e46] [cursor=pointer]:
                  - img [ref=e47]
                - button "Send" [disabled] [ref=e51]:
                  - img [ref=e52]
      - separator "Drag to resize. Double-click to reset." [ref=e55]
      - generic "Gateway" [active] [ref=e58]:
        - banner [ref=e59]:
          - generic [ref=e60]: _ _ _ _ _ _ _ ╱╲_╲╱╲_╲ _ ╱╲ ╲ ╱╲ ╲ ╱ ╱╲ ╱╲ ╲ ╱╲ ╲ ╱ ╱ ╱ ╱ ╱╱╲_╲ ╲ ╲ ╲ ╱ ╲ ╲ ╱ ╱ ╲ ╱ ╲ ╲ ╱ ╲ ╲ ╱╲ ╲╱ ╲ ╲╱ ╱ ╱ ╱╲ ╲_╲ ╱ ╱╲ ╲ ╲ ╱ ╱ ╱╲ ╲ ╱ ╱╲ ╲_╲ ╱ ╱╲ ╲ ╲ ╱ ╲____╲__╱ ╱ ╱ ╱╲╱_╱ ╱ ╱ ╱╲ ╲_╲ ╱ ╱ ╱╲ ╲ ╲ ╱ ╱ ╱╲╱_╱ ╱ ╱ ╱╲ ╲_╲ ╱ ╱╲╱________╱ ╱ ╱ ╱ ╱ ╱ ╱_╱ ╱ ╱ ╱ ╱ ╱ ╲ ╲ ╲ ╱ ╱ ╱ ______ ╱ ╱_╱_ ╲╱_╱ ╱ ╱ ╱╲╱_╱╱ ╱ ╱ ╱ ╱ ╱ ╱ ╱ ╱__╲╱ ╱ ╱ ╱ ╱___╱ ╱╲ ╲ ╱ ╱ ╱ ╱╲_____╲ ╱ ╱____╱╲ ╱ ╱ ╱ ╱ ╱ ╱ ╱ ╱ ╱ ╱ ╱ ╱_____╱ ╱ ╱ ╱_____╱ ╱╲ ╲ ╱ ╱ ╱ ╲╱____ ╱╱ ╱╲____╲╱ ╱ ╱ ╱ ╱ ╱ ╱___╱ ╱ ╱__ ╱ ╱ ╱╲ ╲ ╲ ╱ ╱_________╱╲ ╲ ╲ ╱ ╱ ╱_____╱ ╱ ╱╱ ╱ ╱______ ╲╱_╱ ╱ ╱ ╱╱╲__╲╱_╱___╲╱ ╱ ╱ ╲ ╲ ╲╱ ╱ ╱_ __╲ ╲_╲╱ ╱ ╱______╲╱ ╱╱ ╱ ╱_______╲ ╲╱_╱ ╲╱_________╱╲╱_╱ ╲_╲╱╲_╲___╲ ╱____╱_╱╲╱___________╱ ╲╱__________╱
        - paragraph [ref=e61]: Command. Catalog. Operators. Memory Atlas. Voice Lab. Flight Log. Settings. Craftwerk Cyberdeck Corporation. ChatGPT // Lead. Cursor // Dev. Codex // Test. Samus-Manus // Memory. ASCII. REALMORPH.
        - generic [ref=e63]:
          - generic [ref=e64]:
            - generic [ref=e66]: OPERATOR_DOC_SURFACE
            - button "PASTE" [ref=e69] [cursor=pointer]
          - generic [ref=e70]: DROP OR PASTE CODE, TEXT, MARKDOWN, OR IMAGE FILES HERE TO VIEW AND EDIT THEM.
  - alert [ref=e71]
```

# Test source

```ts
  1  | import { expect, test } from "@playwright/test";
  2  | 
  3  | async function createAuditTab(page: import("@playwright/test").Page) {
  4  |   const input = page.locator('input[placeholder*="GATEWAY"], input[placeholder*="command"], input[placeholder*="COMMAND"]').first();
  5  |   await input.waitFor({ state: "visible", timeout: 10000 });
  6  |   await input.click();
  7  |   await input.fill("new tab named audit glyph A");
  8  |   await expect(input).toHaveValue("new tab named audit glyph A");
  9  |   await input.press("Enter");
  10 |   await expect(page.getByText("TAB_CREATED // audit // GLYPH A")).toBeVisible({ timeout: 10000 });
  11 | }
  12 | 
  13 | async function openAuditSurface(page: import("@playwright/test").Page, surface: string) {
  14 |   const auditTab = page.locator("cyberdeck-rail-tab").nth(3);
  15 |   await auditTab.waitFor({ state: "visible", timeout: 10000 });
  16 |   await auditTab.click({ button: "right" });
  17 |   await page.getByRole("menuitem", { name: surface }).click();
  18 | }
  19 | 
  20 | async function sendDeckCommand(page: import("@playwright/test").Page, text: string) {
  21 |   const input = page.locator('input[placeholder*="GATEWAY"], input[placeholder*="command"], input[placeholder*="COMMAND"]').first();
  22 |   await input.waitFor({ state: "visible", timeout: 10000 });
  23 |   await input.click();
  24 |   await input.fill(text);
  25 |   await input.press("Enter");
  26 | }
  27 | 
  28 | test("cyberdeck renders and switches required alpha modules", async ({ page }) => {
  29 |   try {
  30 |     await page.goto("/cyberdeck", { waitUntil: "load", timeout: 30000 });
  31 |   } catch {
  32 |     await page.goto("/cyberdeck", { waitUntil: "domcontentloaded", timeout: 30000 });
  33 |   }
  34 |   await page.waitForSelector("cyberdeck-rail-tab", { timeout: 20000 });
  35 |   const response = await page.reload({ waitUntil: "domcontentloaded" });
  36 |   expect(response).not.toBeNull();
  37 |   expect(response!.status()).toBeLessThan(500);
  38 | 
> 39 |   await expect(page.locator("cyberdeck-rail-tab")).toHaveCount(3, { timeout: 10000 });
     |                                                    ^ Error: expect(locator).toHaveCount(expected) failed
  40 |   await expect(page.getByText(/STATUS: (NOMINAL|ASCII) ECHO MIRAGE/)).toBeVisible({ timeout: 10000 });
  41 |   const body = page.locator("body");
  42 |   await expect(body).toContainText("Memory Atlas", { timeout: 10000 });
  43 |   await expect(body).toContainText("Voice Lab", { timeout: 10000 });
  44 |   await expect(body).toContainText("Flight Log", { timeout: 10000 });
  45 | 
  46 |   await sendDeckCommand(page, "MUTHUR, indicate the command input area.");
  47 |   await expect(page.locator('[data-computer-use-indicate-marker="ring"]')).toHaveCount(1, { timeout: 5000 });
  48 |   await expect(page.locator('[data-computer-use-indicate-overlay="true"]')).toHaveCSS("pointer-events", "none");
  49 | 
  50 |   await sendDeckCommand(page, "MUTHUR, highlight the Voice Lab panel.");
  51 |   await expect(page.locator("[data-computer-use-indicate-marker]")).toHaveCount(2, { timeout: 5000 });
  52 | 
  53 |   await sendDeckCommand(page, "MUTHUR, clear indicators.");
  54 |   await expect(page.locator("[data-computer-use-indicate-marker]")).toHaveCount(0, { timeout: 5000 });
  55 | 
  56 |   await createAuditTab(page);
  57 | 
  58 |   await openAuditSurface(page, "Catalog");
  59 |   await expect(page.getByText("ECHO MIRAGE SERIES // CRAFTWERK CYBERDECK CORPORATION")).toBeVisible();
  60 |   await expect(page.getByText("[VIEW]").first()).toBeVisible();
  61 |   await expect(page.getByText("[CONFIGURE]").first()).toBeVisible();
  62 |   const firstCard = page.locator("article").filter({ hasText: "Echo Mirage Mark I" }).first();
  63 |   const cardBox = await firstCard.locator(".aspect-square").boundingBox();
  64 |   expect(cardBox).not.toBeNull();
  65 |   expect(Math.abs(cardBox!.width - cardBox!.height)).toBeLessThanOrEqual(1);
  66 |   await expect(firstCard.locator("img[alt='Echo Mirage Mark I cover']")).toHaveJSProperty("complete", true);
  67 | 
  68 |   await openAuditSurface(page, "Operators");
  69 |   await expect(page.getByText("CHATGPT // LEAD", { exact: true })).toBeVisible();
  70 |   await expect(page.getByText("CURSOR // DEV", { exact: true })).toBeVisible();
  71 |   await expect(page.getByText("CODEX // TEST", { exact: true })).toBeVisible();
  72 |   await expect(page.getByText("SAMUS-MANUS // MEMORY", { exact: true })).toBeVisible();
  73 |   await expect(page.getByText(/ONLINE|THINKING|REVIEWING|IDLE|BLOCKED/).first()).toBeVisible();
  74 | 
  75 |   await openAuditSurface(page, "Flight Log");
  76 |   await expect(page.getByText("OPERATIONS TRACE // LOCAL BUS")).toBeVisible();
  77 |   await expect(page.getByText("DECK :: cold start :: SUCCESS")).toBeVisible();
  78 | 
  79 |   await openAuditSurface(page, "Settings");
  80 |   await expect(page.getByText("REALMORPHISM / ASCII OVERRIDE")).toBeVisible();
  81 | 
  82 |   const modeSwitch = page.getByRole("switch", { name: /ASCII mode on|Realmorphism mode on/ });
  83 |   await expect(modeSwitch).toBeVisible();
  84 |   const deckRoot = page.locator("[data-deck-mode]").first();
  85 |   await expect(deckRoot).toHaveAttribute("data-deck-mode", /^(realmorphism|ascii)$/);
  86 |   const initialMode = await deckRoot.getAttribute("data-deck-mode");
  87 |   await modeSwitch.click();
  88 |   await expect(deckRoot).not.toHaveAttribute("data-deck-mode", initialMode!);
  89 | });
  90 | 
```