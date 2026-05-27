# MUTHUR Verification Layer — Codex Test Runbook (L-11)

**Prerequisite:** L-10 execution loop passing. Dev server on `http://127.0.0.1:3050`.

**Key doctrine:** A successful command does **not** equal a verified app.

---

## Automated gates

```powershell
cd f:\dev\echo-mirage-cyberdeck
pnpm exec tsc --noEmit
pnpm exec tsx scripts/probe-muthur-execution-loop.ts
pnpm dev   # separate terminal, if not already running
pnpm exec tsx scripts/probe-muthur-verification-layer.ts
pnpm build
```

| Command | Pass criteria |
|---------|---------------|
| `probe-muthur-verification-layer.ts` | `PASS` or `SKIP` if dev server down |
| Verification probe result | Action status `verified`, receipt file exists |

---

## V1 — Execution without verification stays `completed`

```powershell
$body = @{
  op = "enqueue"
  mode = "execute"
  wait = $true
  actions = @(
    @{ type = "shell_command"; source = "system"; payload = @{ command = "git status --short" } }
  )
} | ConvertTo-Json -Depth 6

$r = Invoke-RestMethod http://127.0.0.1:3050/api/muthur/execution -Method POST -ContentType "application/json" -Body $body
```

**Expect:**
- `results[0].status` = `"completed"` (NOT `verified`)
- No `verification` block required
- No receipt_path required

This proves execution ≠ verification.

---

## V2 — Verify `/cyberdeck` loads (first win)

```powershell
$body = @{
  op = "verify_route"
  route = "/cyberdeck"
  mode = "execute"
  wait = $true
  taskLabel = "codex-verify-cyberdeck"
} | ConvertTo-Json -Depth 6

$r = Invoke-RestMethod http://127.0.0.1:3050/api/muthur/execution -Method POST -ContentType "application/json" -Body $body
$r.results[0] | ConvertTo-Json -Depth 8
```

**Expect:**
- `status` = `"verified"` (NOT merely `completed`)
- `verification.passed` = `true`
- Checks include:
  - `route_loads` PASS
  - `text_exists` PASS (`Memory Atlas`)
  - `button_visible` PASS (`cyberdeck-rail-tab`)
  - `no_console_errors` PASS
  - `screenshot_captured` PASS
  - `api_returns_200` PASS
- `receipt_path` points to existing JSON under `.muthur/receipts/verification/`
- Screenshot under `.muthur/screenshots/`

---

## V3 — Failed verification is honest

Stop dev server or point at bad route:

```powershell
$body = @{
  op = "verify_route"
  route = "/this-route-does-not-exist-404"
  mode = "execute"
  wait = $true
} | ConvertTo-Json -Depth 6

$r = Invoke-RestMethod http://127.0.0.1:3050/api/muthur/execution -Method POST -ContentType "application/json" -Body $body
```

**Expect:**
- `status` = `"verification_failed"`
- `verification.passed` = `false`
- Receipt still written (failed verification is evidence)

---

## V4 — Audit + receipt files

```powershell
Get-Content f:\dev\echo-mirage-cyberdeck\.muthur\logs\verification-receipts.jsonl -Tail 3
Get-ChildItem f:\dev\echo-mirage-cyberdeck\.muthur\receipts\verification | Select-Object -Last 3
Get-ChildItem f:\dev\echo-mirage-cyberdeck\.muthur\screenshots | Select-Object -Last 3
```

**Expect:** Valid JSONL lines with `verification_passed`, `receipt_path`, `evidence_paths`.

---

## V5 — UI shows verification state

1. Open MUTHUR Execution pane during V2
2. Confirm action shows `VERIFIED` (not just completed)
3. Verification check list visible
4. Receipt path visible

---

## Reporting template

```markdown
## L-11 Verification test report

- [ ] V1 shell completes without verified status
- [ ] V2 /cyberdeck verify_route → verified + receipt + screenshot
- [ ] V3 failed route → verification_failed (honest)
- [ ] V4 audit JSONL + receipt files
- [ ] V5 UI shows verification details

Verdict: PASS / FAIL / PARTIAL
```

---

## Known limitations

- Browser bridge requires Playwright Chromium (`pnpm exec playwright install chromium`)
- `open_url` limited to localhost
- Verification probe skips if dev server unreachable
- Electron embedded browser is separate from server Playwright bridge
