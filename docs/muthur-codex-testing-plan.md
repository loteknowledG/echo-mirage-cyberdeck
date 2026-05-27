# MUTHUR Codex Testing Plan (L-10 + L-11 + L-12)

Master test plan for Codex agents validating the MUTHUR execution loop (Phase 1), verification layer (Phase 2), and browser verification bridge (Phase 3).

**Repo:** `f:\dev\echo-mirage-cyberdeck`  
**Dev URL:** `http://127.0.0.1:3050` (not 3000)  
**Health sidecar:** `http://127.0.0.1:3051/health`

**Doctrine under test:** Observe honestly. Execute deliberately. Verify visibly.

**Critical rule:** Execution success ≠ verification success. A passing shell command or successful `open_url` must **not** be reported as a verified app.

---

## Detailed runbooks (use for step commands)

| Phase | Document |
|-------|----------|
| L-10 Execution loop | [`docs/muthur-execution-loop-testing.md`](muthur-execution-loop-testing.md) |
| L-11 Verification layer | [`docs/muthur-verification-layer-testing.md`](muthur-verification-layer-testing.md) |
| L-12 Browser bridge | [`docs/muthur-browser-verification-testing.md`](muthur-browser-verification-testing.md) |

This plan defines **order, pass criteria, and reporting**. Use the runbooks for copy-paste API/UI commands.

---

## Prerequisites

1. `pnpm install` completed at repo root
2. Playwright Chromium installed (required for L-11 browser bridge):
   ```powershell
   pnpm exec playwright install chromium
   ```
3. Dev server running for API/UI/verification tests:
   ```powershell
   cd f:\dev\echo-mirage-cyberdeck
   pnpm dev
   ```
4. Record at test start:
   - Date
   - Git commit / branch (`git rev-parse --short HEAD`)
   - Whether worktree is dirty
   - Base URL used

---

## Phase 0 — Automated gates (no browser)

Run from repo root **before** any live API/UI claims.

```powershell
cd f:\dev\echo-mirage-cyberdeck
pnpm exec tsc --noEmit
pnpm exec tsx scripts/probe-muthur-execution-loop.ts
pnpm build
```

After dev server is up (Phases 1–3), also run:

```powershell
pnpm exec tsx scripts/probe-muthur-verification-layer.ts
pnpm exec tsx scripts/probe-muthur-browser-verification.ts
```

| Step | Pass criteria |
|------|---------------|
| Typecheck | Exit 0 |
| `probe-muthur-execution-loop.ts` | Prints `PASS`, exit 0 |
| Build | Exit 0 (pre-existing dependency warnings OK) |

**Stop and report FAIL if Phase 0 fails.** Do not continue to Phase 1.

---

## Phase 1 — Execution loop (L-10)

**Requires:** `pnpm dev` on `:3050`

Run API tests **T1–T9** from [`muthur-execution-loop-testing.md`](muthur-execution-loop-testing.md).

### Minimum required (smoke)

| ID | Test | Must pass |
|----|------|-----------|
| T1 | GET `/api/muthur/execution` state | Yes |
| T2 | Set mode `execute` | Yes |
| T3 | Enqueue `wait` + allowlisted shell | Yes |
| T4 | Observe mode → approve write | Yes |
| T5 | Deny blocked write | Yes |
| T6a | Unsupported `click` fails honestly | Yes |
| T6b | `screenshot` completes with real PNG path | Yes |
| T6c | Remote `open_url` fails (localhost only) | Yes |
| T7 | Non-allowlisted shell blocked/fails | Yes |
| T8 | Stop / pause / resume / clear queue | Yes |
| T9 | `read_file` in workspace | Yes |

### Audit (L-10)

Confirm append-only JSONL under `.muthur/logs/`:
- `tool-actions.jsonl`
- `execution-session.jsonl`
- `safety-events.jsonl` (on approve/deny)

Each line must be valid JSON.

### UI (L-10)

1. Open `http://127.0.0.1:3050/cyberdeck`
2. Open **MUTHUR Execution** pane (tab convert or context menu)
3. While running T3 via API, confirm pane shows active → completed actions
4. While running T4, confirm **APPROVE** / **DENY** controls work

---

## Phase 2 — Verification layer (L-11)

**Requires:** Phase 1 passed + dev server + Playwright

```powershell
pnpm exec tsx scripts/probe-muthur-verification-layer.ts
```

| Step | Pass criteria |
|------|---------------|
| Verification probe | `PASS` (or `SKIP` only if dev server genuinely unreachable — note in report) |

Run manual tests **V1–V5** from [`muthur-verification-layer-testing.md`](muthur-verification-layer-testing.md).

### Minimum required (smoke)

| ID | Test | Must pass |
|----|------|-----------|
| V1 | Shell → status `completed` (NOT `verified`) | Yes |
| V2 | `verify_route` `/cyberdeck` → `verified` + receipt + screenshot | Yes |
| V3 | Bad route → `verification_failed` (honest, receipt still written) | Yes |
| V4 | `verification-receipts.jsonl` + receipt JSON files exist | Yes |
| V5 | UI shows verification checks + receipt path | Yes |

### V2 expected checks (all PASS)

When verifying `/cyberdeck`:

- `route_loads`
- `text_exists` (`Memory Atlas`)
- `button_visible` (`cyberdeck-rail-tab`)
- `no_console_errors`
- `screenshot_captured`
- `api_returns_200`

Evidence paths:
- Screenshot: `.muthur/screenshots/`
- Receipt JSON: `.muthur/receipts/verification/`

---

## Phase 3 — Browser verification bridge (L-12)

**Requires:** Phase 2 passed + dev server + Playwright

```powershell
pnpm exec tsx scripts/probe-muthur-browser-verification.ts
```

| Step | Pass criteria |
|------|---------------|
| Browser probe | `PASS` (or `SKIP` only if dev server genuinely unreachable — note in report) |

Run manual tests **B1–B9** from [`muthur-browser-verification-testing.md`](muthur-browser-verification-testing.md).

### Minimum required (smoke)

| ID | Test | Must pass |
|----|------|-----------|
| B1 | Local `open_url` → `completed` + real PNG in `.muthur/screenshots/` | Yes |
| B2 | `screenshot` metadata (width, height, captured_at) | Yes |
| B3 | Remote `open_url` blocked + `browser_url_blocked` in safety-events | Yes |
| B4 | `get_console_errors` structured entries | Yes |
| B5 | `verify_route_loaded` / `verify_page_text` / `verify_console_clean` | Yes |
| B6 | Approved routes `/cyberdeck`, `/preview`, `/` (root may honestly fail — redirects to `/cyberdeck`) | Yes |
| B7 | `verification-receipts.jsonl` L-12 fields | Yes |
| B8 | `click` → `unsupported` | Yes |
| B9 | Distinction: `open_url` = completed vs `verify_route` = verified | Yes |

### UI (L-12)

1. MUTHUR Execution pane shows `[ VERIFIED ]` / `[ VERIFICATION FAILED ]` badge
2. Console error count visible
3. Clickable screenshot preview works
4. `GET /api/muthur/screenshot?name=<basename>` returns PNG

---

## Phase 4 — Distinction test (king test)

This is the most important manual assertion. Codex **must** run both and compare.

### A. Execute only (no proof)

```powershell
$body = @{
  op = "enqueue"
  mode = "execute"
  wait = $true
  actions = @(
    @{ type = "shell_command"; source = "system"; payload = @{ command = "git status --short" } }
  )
} | ConvertTo-Json -Depth 6
Invoke-RestMethod http://127.0.0.1:3050/api/muthur/execution -Method POST -ContentType "application/json" -Body $body
```

**Expect:** `status: "completed"`. No `verification` block. No `verified`.

### B. Execute + verify (proof)

```powershell
$body = @{
  op = "verify_route"
  route = "/cyberdeck"
  mode = "execute"
  wait = $true
} | ConvertTo-Json -Depth 6
Invoke-RestMethod http://127.0.0.1:3050/api/muthur/execution -Method POST -ContentType "application/json" -Body $body
```

**Expect:** `status: "verified"`. `verification.passed: true`. Receipt + screenshot paths present.

**FAIL the run** if A and B produce the same terminal status or if B returns `completed` instead of `verified`.

---

## Phase 5 — Negative / safety spot checks

Pick at least two:

| Test | Input | Must NOT happen |
|------|-------|-----------------|
| Shell escape | `rm -rf /` | Silent success |
| Path escape | `read_file` outside workspace | Content returned |
| Remote URL | `open_url` to non-localhost | Navigation succeeds |
| Fake verify | Claim PASS without receipt/screenshot for V2 | — |

---

## Screenshots (optional but recommended)

Save under `test-results/` when running UI tests:

- `muthur-execution-ui-active.png`
- `muthur-execution-ui-blocked.png`
- `muthur-execution-ui-verified.png`

Note browser console error count during UI verification (target: 0 new errors).

---

## Master report template

Copy, fill, and return to the operator:

```markdown
## MUTHUR Codex test report (L-10 + L-11 + L-12)

- Date:
- Commit/branch:
- Tester: Codex
- Base URL:

### Phase 0 — Automated
- [ ] tsc --noEmit
- [ ] probe-muthur-execution-loop.ts
- [ ] probe-muthur-verification-layer.ts
- [ ] probe-muthur-browser-verification.ts
- [ ] pnpm build

### Phase 1 — Execution (L-10)
- [ ] T1 GET state
- [ ] T2 set mode
- [ ] T3 wait + shell
- [ ] T4 observe + approve
- [ ] T5 deny
- [ ] T6a unsupported (`click`) honest
- [ ] T6b screenshot real evidence
- [ ] T6c remote open_url blocked
- [ ] T7 shell allowlist
- [ ] T8 interrupt controls
- [ ] T9 read_file
- [ ] Audit JSONL valid
- [ ] Execution pane UI

### Phase 2 — Verification (L-11)
- [ ] probe-muthur-verification-layer.ts
- [ ] V1 shell → completed (not verified)
- [ ] V2 verify_route /cyberdeck → verified
- [ ] V3 bad route → verification_failed
- [ ] V4 receipt + JSONL evidence
- [ ] V5 UI verification details

### Phase 3 — Browser bridge (L-12)
- [ ] probe-muthur-browser-verification.ts
- [ ] B1 local open_url + PNG
- [ ] B2 screenshot metadata
- [ ] B3 remote blocked + safety audit
- [ ] B4 console errors structured
- [ ] B5 verify action types
- [ ] B6 approved routes
- [ ] B7 receipt JSONL fields
- [ ] B8 click unsupported
- [ ] B9 distinction (open_url vs verify_route)
- [ ] UI badges + screenshot preview

### Phase 4 — Distinction test
- [ ] A: shell = completed only
- [ ] B: verify_route = verified with proof
- [ ] A and B differ correctly

### Phase 5 — Safety spot checks
- [ ] (list which ran)

### Evidence paths
- Latest screenshot (.muthur/screenshots/):
- Latest receipt:

### Failures / notes:


### Verdict: PASS / FAIL / PARTIAL
```

---

## Verdict rules

| Verdict | When |
|---------|------|
| **PASS** | Phase 0 pass + all minimum L-10/L-11/L-12 smoke pass + distinction test pass |
| **PARTIAL** | Phase 0 pass + core execution works but browser verification skipped (e.g. dev server down, Playwright missing) — list blockers |
| **FAIL** | Any Phase 0 failure, safety regression, fake success, fake PNG, remote URL navigated, or distinction test wrong |

---

## Do not claim (common false positives)

- Native OpenAI tool rounds in chat (requires `ENABLE_AUTOMATION = true`)
- Card Table card execution (still separate from this loop)
- Electron embedded browser equals server Playwright bridge
- `completed` means the app was verified
- PASS based only on Phase 0 without live API/UI for L-11/L-12
- **`screenshot` returning `unsupported`** — after L-11, screenshot is implemented; use B8/T6a (`click`) for unsupported checks
- **`open_url` success = verified app** — open_url is execution; use `verify_route` or verify_* actions for proof
- Screenshots under `.muthur/receipts/screenshots/` — L-12 uses `.muthur/screenshots/`

---

## Verified runs

| Date | Commit | Verdict | Notes |
|------|--------|---------|-------|
| 2026-05-26 | `0217ba2` (dirty) | **PASS** | Codex — full L-10+L-11 after T6 plan fix. Distinction test passed. Initial FAIL was test-plan drift only. |
| 2026-05-26 | post-L-12 fixes (dirty) | **PASS** | Codex — L-12 probe retest. B5/B6/UI regressions fixed. `/` honest `verification_failed` on redirect to `/cyberdeck`. `probe-muthur-browser-verification.ts` PASS. |

---

## Quick one-liner for Codex

> Follow `docs/muthur-codex-testing-plan.md` in order: Phase 0 → L-10 runbook T1–T9 → L-11 runbook V1–V5 → L-12 runbook B1–B9 → distinction test → fill master report template.
