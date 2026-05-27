# L-12 — MUTHUR Browser Verification Bridge

**Status:** Verified (Codex PASS 2026-05-26)  
**Doctrine:** Execution is not proof. Verification is proof.

## Architecture

```
MUTHUR Execution Loop
  └─ action-runner (open_url, screenshot, get_console_errors, verify_*)
       └─ browser-policy.ts   — localhost allowlist, URL resolution
       └─ browser-session.ts  — Playwright singleton session
            ├─ openRoute()           → navigate + track active page
            ├─ captureScreenshot()   → PNG → .muthur/screenshots/
            ├─ getSessionConsole*()  → structured console entries
            └─ closeBrowserSession()
  └─ verification-runner → checks (route_loads, text_exists, no_console_errors, …)
  └─ verification-receipts → .muthur/logs/verification-receipts.jsonl
```

- **Local-only:** Playwright headless Chromium; no cloud browsers.
- **Operator-supervised:** Same execution modes (observe / suggest / execute) and approval gates as L-10.
- **Auditable:** Blocked URLs → `safety-events.jsonl`; verification → `verification-receipts.jsonl`.

## Safety policy

| Allowed | Blocked |
|---------|---------|
| `http://127.0.0.1:*` | Remote domains |
| `http://localhost:*` | Arbitrary external URLs |

Blocked `open_url` attempts:

- Fail with explicit error (no fake navigation)
- Append `browser_url_blocked` to `.muthur/logs/safety-events.jsonl`

`click` remains **unsupported** (returns `status: unsupported`).

## Verification flow

1. **Execution phase** — e.g. `open_url`, `shell_command`, `write_file`
2. If `verify_after` or explicit checks → status `awaiting_verification`
3. **Verification phase** — `verify_route_loaded`, `verify_page_text`, `verify_console_clean`, or `verify_condition`
4. Receipt written; final status `verified` or `verification_failed`

Execution success and verification success are reported separately in receipts and UI.

## Approved routes

- `/`
- `/cyberdeck`
- `/preview`

## Validation

```powershell
pnpm exec tsc --noEmit
pnpm build
pnpm exec tsx scripts/probe-muthur-browser-verification.ts
```

Requires dev server at `http://127.0.0.1:3050`.

**Codex runbook:** [`docs/muthur-browser-verification-testing.md`](../muthur-browser-verification-testing.md)

## Evidence paths

- Screenshots: `.muthur/screenshots/*.png`
- Receipts JSONL: `.muthur/logs/verification-receipts.jsonl`
- Safety blocks: `.muthur/logs/safety-events.jsonl`
- Screenshot preview API: `GET /api/muthur/screenshot?name=<basename>`

## Known limitations (L-12)

- No autonomous clicking or typing
- No remote internet navigation
- Single shared browser session (sequential verification)
- Text checks use body innerText (not OCR / visual AI)
- Screenshot preview is inline toggle, not a gallery

## L-13 recommendations

- Multi-route verification batches for `/`, `/preview` with route-specific expected text
- Persist browser session metadata in execution pane (active URL indicator)
- Optional dev-server health gate before verification enqueue
- DOM selector assertions beyond custom elements
- Verification diff (before/after screenshots)
