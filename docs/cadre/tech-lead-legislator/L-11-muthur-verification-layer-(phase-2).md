# L-11 — MUTHUR Verification Layer (Phase 2)

## Directive

Phase 1 proved MUTHUR can **execute** honestly. Phase 2 proves MUTHUR can **verify** honestly.

**Core question:** “Did the thing actually work?”

Execution success ≠ verified success.

---

## Capabilities

### 1. `verify_condition` action

Checks:
- `route_loads`
- `text_exists`
- `button_visible`
- `no_console_errors`
- `screenshot_captured`
- `api_returns_200`

### 2. Browser bridge (server-side Playwright)

- `open_url` — localhost routes only
- `screenshot` — saves to `.muthur/receipts/screenshots/`
- `get_console_errors` — session console error list

### 3. Verification receipts

Each verified task writes:
- execution result
- verification outcome
- evidence paths (screenshots)
- JSON receipt under `.muthur/receipts/verification/`
- JSONL line in `.muthur/logs/verification-receipts.jsonl`
- SQLite receipt via `Memory.addReceipt()`

### 4. Status lifecycle

`completed → awaiting_verification → verified | verification_failed`

Actions with `verify_after: true` or `verify_checks[]` enter verification after execution.

### 5. First win

```json
POST /api/muthur/execution
{ "op": "verify_route", "route": "/cyberdeck", "wait": true }
```

Expected proof:
- Browser opened route
- Screenshot saved
- Console errors counted
- Page text / selector detected
- Receipt written

---

## Key files

| File | Role |
|------|------|
| `src/lib/muthur/execution/verification-types.ts` | Check schema |
| `src/lib/muthur/execution/browser-bridge.server.ts` | Playwright session |
| `src/lib/muthur/execution/verification-runner.server.ts` | Check runner |
| `src/lib/muthur/execution/verification-receipts.server.ts` | Receipt writer |
| `scripts/probe-muthur-verification-layer.ts` | Automated probe |

---

## Doctrine

Observe honestly. Execute deliberately. **Verify visibly.**
