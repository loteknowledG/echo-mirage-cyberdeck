# Echo Mirage Survey Satellite (browser extension)

Chrome/Edge MV3 extension that captures **active tab text** and delivers it to an open Echo Mirage cyberdeck tab — no clipboard, no Playwright. Complements **Echo Satellite** (screenshots) with DOM recon for Survey / MUTHUR.

## Install (developer)

1. Generate icons (once): `pnpm survey:extension:icons`
2. Open `chrome://extensions` → **Developer mode** → **Load unpacked**
3. Select `apps/echo-mirage-survey-extension`

## Use

1. Open Echo Mirage cyberdeck (`http://127.0.0.1:3050/cyberdeck` or production URL).
2. Browse the target page in another tab.
3. Click the extension → **Send active tab to Survey**.

Page context lands in Survey chat / MUTHUR archive as `SURVEY SATELLITE // RECEIVED · browser page capture`. A green receipt toast appears on cyberdeck when ingest succeeds.

Delivery uses MAIN-world `chrome.scripting.executeScript` plus `window.postMessage` (CSP-safe). Inline `<script>` injection is avoided because Vercel CSP blocks it and caused false “Delivered” with no toast.

## Architecture

```
[target tab] --executeScript--> [extension background]
                                      |
                                      v
[mirage cyberdeck tab] <--content script-- CustomEvent
                                      |
                                      v
              survey-extension-page-context.client.ts → notifySurveyMuthurArchive
```

Mirage URL patterns: `127.0.0.1:*`, `localhost:*`, `echo-mirage-cyberdeck.vercel.app`.

## Files

| File | Role |
|------|------|
| `background.js` | Capture active tab, find Mirage tabs, deliver |
| `content-mirage.js` | Bridge to `echo-mirage:survey-extension-page-context` |
| `popup.*` | Operator UI |

Cyberdeck listener: `SurveyExtensionPageContextHost` in `cyberdeck-page-client.tsx`.
