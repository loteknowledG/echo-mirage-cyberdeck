# MUTHUR Browser Verification Bridge — Codex Test Runbook (L-12)

Use this document to verify MUTHUR's **real** browser observation bridge: local navigation, PNG screenshots, console inspection, verification receipts, and honest failures.

**Prerequisites:** L-10 execution loop passing. L-11 verification layer passing. Dev server on `http://127.0.0.1:3050`.

**Doctrine under test:** Execution is not proof. Verification is proof.

**Critical rule:** A successful `open_url` or `screenshot` is **execution evidence**, not app verification. Only `verified` status (with checks + receipt) counts as proof the app works.

---

## Prerequisites

1. Repo root: `f:\dev\echo-mirage-cyberdeck`
2. Dependencies: `pnpm install`
3. Playwright Chromium (required):
   ```powershell
   pnpm exec playwright install chromium
   ```
4. Dev server running (separate terminal):
   ```powershell
   cd f:\dev\echo-mirage-cyberdeck
   pnpm dev
   ```
5. Record at test start:
   - Date
   - Git commit (`git rev-parse --short HEAD`)
   - Dirty worktree? (`git status --short`)
   - Base URL (default `http://127.0.0.1:3050`)

**Note:** Execution state is a server singleton. Restarting `pnpm dev` clears in-memory queue but keeps audit JSONL and screenshots on disk.

---

## Phase 0 — Automated gates (run first)

From repo root:

```powershell
cd f:\dev\echo-mirage-cyberdeck
pnpm exec tsc --noEmit
pnpm exec tsx scripts/probe-muthur-execution-loop.ts
pnpm exec tsx scripts/probe-muthur-verification-layer.ts
pnpm exec tsx scripts/probe-muthur-browser-verification.ts
pnpm build
```

| Command | Pass criteria |
|---------|---------------|
| `tsc --noEmit` | Exit 0 |
| `probe-muthur-execution-loop.ts` | Prints `PASS`, exit 0 |
| `probe-muthur-verification-layer.ts` | Prints `PASS` (or `SKIP` only if dev server down — note in report) |
| `probe-muthur-browser-verification.ts` | Prints `PASS` (or `SKIP` only if dev server down — note in report) |
| `pnpm build` | Exit 0 |

**Stop and report FAIL if typecheck or build fails.** Do not claim browser verification works based on Phase 0 alone if the browser probe was `SKIP`.

---

## Phase 1 — API tests (requires `pnpm dev`)

Base URL: `http://127.0.0.1:3050`

Use PowerShell `Invoke-RestMethod` unless noted.

### B1 — Local `open_url` navigates and captures screenshot

```powershell
$body = @{
  op = "enqueue"
  mode = "execute"
  wait = $true
  taskLabel = "codex-b1-open-url"
  actions = @(
    @{
      type = "open_url"
      source = "codex"
      payload = @{
        route = "/cyberdeck"
        base_url = "http://127.0.0.1:3050"
        screenshot_label = "codex-open-url"
      }
    }
  )
} | ConvertTo-Json -Depth 8

$r = Invoke-RestMethod http://127.0.0.1:3050/api/muthur/execution -Method POST -ContentType "application/json" -Body $body
$r.results[0] | ConvertTo-Json -Depth 8
```

**Expect:**
- `status` = `"completed"` (execution only — NOT `verified`)
- `result.success` = `true`
- `result.screenshot_path` points to an existing file under `.muthur/screenshots/`
- `result.metadata.url` contains `/cyberdeck`
- `result.metadata.console_error_count` is a number

**Verify PNG on disk:**

```powershell
$path = $r.results[0].result.screenshot_path
Test-Path $path
Format-Hex -Path $path -Count 4
```

**Expect:** File exists. First bytes are PNG signature (`89 50 4E 47`).

---

### B2 — `screenshot` returns structured metadata

```powershell
$body = @{
  op = "enqueue"
  mode = "execute"
  wait = $true
  actions = @(
    @{ type = "screenshot"; source = "codex"; payload = @{ label = "codex-screenshot" } }
  )
} | ConvertTo-Json -Depth 6

$r = Invoke-RestMethod http://127.0.0.1:3050/api/muthur/execution -Method POST -ContentType "application/json" -Body $body
$r.results[0].result.metadata.screenshot
```

**Expect:**
- `screenshot_path` under `.muthur/screenshots/`
- `width` > 0
- `height` > 0
- `captured_at` is ISO timestamp
- PNG file exists on disk

---

### B3 — Remote URL blocked + safety audit

```powershell
$body = @{
  op = "enqueue"
  mode = "execute"
  wait = $true
  actions = @(
    @{
      type = "open_url"
      source = "codex"
      payload = @{ url = "https://example.com" }
    }
  )
} | ConvertTo-Json -Depth 6

$r = Invoke-RestMethod http://127.0.0.1:3050/api/muthur/execution -Method POST -ContentType "application/json" -Body $body
$r.results[0] | ConvertTo-Json -Depth 6
```

**Expect:**
- `status` = `"failed"`
- `result.success` = `false`
- `result.stderr` mentions localhost limitation
- **No** screenshot path for remote navigation

**Safety log:**

```powershell
Get-Content f:\dev\echo-mirage-cyberdeck\.muthur\logs\safety-events.jsonl -Tail 5
```

**Expect:** A line containing `browser_url_blocked` with the blocked URL.

---

### B4 — `get_console_errors` returns structured entries

Run B1 first (or any navigation), then:

```powershell
$body = @{
  op = "enqueue"
  mode = "execute"
  wait = $true
  actions = @(
    @{ type = "get_console_errors"; source = "codex"; payload = @{} }
  )
} | ConvertTo-Json -Depth 6

$r = Invoke-RestMethod http://127.0.0.1:3050/api/muthur/execution -Method POST -ContentType "application/json" -Body $body
$r.results[0].result.metadata.entries | Select-Object -First 3
```

**Expect:**
- `metadata.entries` is an array (may be empty if console clean)
- Each entry (if present) has: `message`, `source`, `severity`, `timestamp`
- `metadata.count` matches error count

---

### B5 — Verification action types

#### B5a — `verify_route_loaded`

```powershell
$body = @{
  op = "enqueue"
  mode = "execute"
  wait = $true
  actions = @(
    @{
      type = "verify_route_loaded"
      source = "codex"
      payload = @{ route = "/cyberdeck"; base_url = "http://127.0.0.1:3050" }
    }
  )
} | ConvertTo-Json -Depth 6

$r = Invoke-RestMethod http://127.0.0.1:3050/api/muthur/execution -Method POST -ContentType "application/json" -Body $body
```

**Expect:** `status` = `"verified"`, checks include `route_loads` PASS and `screenshot_captured` PASS.

#### B5b — `verify_page_text`

```powershell
$body = @{
  op = "enqueue"
  mode = "execute"
  wait = $true
  actions = @(
    @{
      type = "verify_page_text"
      source = "codex"
      payload = @{
        route = "/cyberdeck"
        text = "Memory Atlas"
        base_url = "http://127.0.0.1:3050"
      }
    }
  )
} | ConvertTo-Json -Depth 6

$r = Invoke-RestMethod http://127.0.0.1:3050/api/muthur/execution -Method POST -ContentType "application/json" -Body $body
```

**Expect:** `status` = `"verified"`, `text_exists` check PASS.

#### B5c — `verify_console_clean`

```powershell
$body = @{
  op = "enqueue"
  mode = "execute"
  wait = $true
  actions = @(
    @{
      type = "verify_console_clean"
      source = "codex"
      payload = @{ max_console_errors = 0 }
    }
  )
} | ConvertTo-Json -Depth 6

$r = Invoke-RestMethod http://127.0.0.1:3050/api/muthur/execution -Method POST -ContentType "application/json" -Body $body
```

**Expect:** `status` = `"verified"` if console clean, or `"verification_failed"` if errors present — both are honest outcomes with receipt.

---

### B6 — Approved routes smoke

Run `verify_route` for each approved route:

| Route | Command | Minimum expect |
|-------|---------|----------------|
| `/cyberdeck` | `op: verify_route`, `route: /cyberdeck` | `verified`, full check suite (see L-11 V2) |
| `/` | `op: verify_route`, `route: /` | Honest `verification_failed` with receipt — app redirects `/` → `/cyberdeck` (`src/app/page.tsx`) |
| `/preview` | `op: verify_route`, `route: /preview` | `verified` or honest `verification_failed` with receipt |

```powershell
$body = @{
  op = "verify_route"
  route = "/preview"
  mode = "execute"
  wait = $true
  taskLabel = "codex-b6-preview"
} | ConvertTo-Json -Depth 6

Invoke-RestMethod http://127.0.0.1:3050/api/muthur/execution -Method POST -ContentType "application/json" -Body $body
```

**Expect:** Terminal status is `verified` or `verification_failed` — never `completed`. Receipt always written.

---

### B7 — Verification receipts (JSONL)

```powershell
Get-Content f:\dev\echo-mirage-cyberdeck\.muthur\logs\verification-receipts.jsonl -Tail 3
Get-ChildItem f:\dev\echo-mirage-cyberdeck\.muthur\receipts\verification | Select-Object -Last 3
Get-ChildItem f:\dev\echo-mirage-cyberdeck\.muthur\screenshots | Select-Object -Last 5
```

**Expect JSONL fields (L-12):**
- `task_id`
- `url`
- `screenshot_path`
- `verification_checks` (array)
- `console_error_count`
- `verification_outcome` (`verified` or `verification_failed`)
- `execution_success`
- `receipt_path`

Each line must be valid JSON. Receipt JSON files must exist at `receipt_path`.

---

### B8 — `click` remains unsupported

```powershell
$body = @{
  op = "enqueue"
  mode = "execute"
  wait = $true
  actions = @(
    @{ type = "click"; source = "codex"; payload = @{ selector = "button" } }
  )
} | ConvertTo-Json -Depth 6

$r = Invoke-RestMethod http://127.0.0.1:3050/api/muthur/execution -Method POST -ContentType "application/json" -Body $body
```

**Expect:**
- `status` = `"unsupported"`
- `result.metadata.status` = `"unsupported"`
- No fake click success

---

### B9 — Distinction test (execution vs verification)

Run both and compare. **FAIL the run if outcomes are indistinguishable.**

#### A. Execution only (no proof)

```powershell
$body = @{
  op = "enqueue"
  mode = "execute"
  wait = $true
  actions = @(
    @{ type = "open_url"; source = "codex"; payload = @{ route = "/cyberdeck" } }
  )
} | ConvertTo-Json -Depth 6

$a = Invoke-RestMethod http://127.0.0.1:3050/api/muthur/execution -Method POST -ContentType "application/json" -Body $body
$a.results[0].status
```

**Expect:** `"completed"` — has screenshot path but NO `verification` block, NOT `verified`.

#### B. Verification (proof)

```powershell
$body = @{
  op = "verify_route"
  route = "/cyberdeck"
  mode = "execute"
  wait = $true
} | ConvertTo-Json -Depth 6

$b = Invoke-RestMethod http://127.0.0.1:3050/api/muthur/execution -Method POST -ContentType "application/json" -Body $body
$b.results[0].status
```

**Expect:** `"verified"` with `verification.passed: true`, receipt, and checks.

---

## Phase 2 — UI tests

1. Open `http://127.0.0.1:3050/cyberdeck`
2. Open **MUTHUR Execution** pane
3. Run B5a or B6 `/cyberdeck` via API while pane is visible

**Expect in pane:**
- Badge: `[ VERIFIED ]` or `[ VERIFICATION FAILED ]`
- Console line: `Console: N errors`
- Screenshot link: `Screenshot: <filename>.png` (clickable)
- Clicking screenshot toggles inline PNG preview
- Verification check list visible
- Receipt path visible

**Screenshot preview API:**

```powershell
$name = (Get-ChildItem f:\dev\echo-mirage-cyberdeck\.muthur\screenshots | Select-Object -Last 1).Name
Invoke-WebRequest "http://127.0.0.1:3050/api/muthur/screenshot?name=$name" -OutFile test-results\codex-screenshot-preview.png
Test-Path test-results\codex-screenshot-preview.png
```

**Expect:** HTTP 200, valid PNG saved.

Use the warm execution route (already loaded during polling):

```powershell
Invoke-WebRequest "http://127.0.0.1:3050/api/muthur/execution?screenshot=$name" -OutFile test-results\codex-screenshot-preview.png
```

Legacy alias still works: `GET /api/muthur/screenshot?name=<basename>`

Optional UI captures under `test-results/`:
- `muthur-browser-verified-badge.png`
- `muthur-browser-screenshot-preview.png`

---

## Phase 3 — Negative / safety spot checks

Pick at least two:

| Test | Input | Must NOT happen |
|------|-------|-----------------|
| Remote URL | `open_url` → `https://google.com` | Navigation succeeds |
| Path traversal | `/api/muthur/screenshot?name=../../etc/passwd` | File served |
| Fake verify | Claim PASS without PNG + receipt for B6 `/cyberdeck` | — |
| Fake screenshot | `screenshot_path` pointing to non-existent file | Report as PASS |
| Autonomous click | `click` action | `completed` or `verified` |

---

## Reporting template

Copy, fill, return to operator:

```markdown
## L-12 Browser Verification test report

- Date:
- Commit/branch:
- Tester: Codex
- Base URL:
- Worktree dirty:

### Phase 0 — Automated
- [ ] tsc --noEmit
- [ ] probe-muthur-execution-loop.ts
- [ ] probe-muthur-verification-layer.ts
- [ ] probe-muthur-browser-verification.ts
- [ ] pnpm build

### Phase 1 — API
- [ ] B1 local open_url + real PNG
- [ ] B2 screenshot metadata (width/height/captured_at)
- [ ] B3 remote URL blocked + safety-events.jsonl
- [ ] B4 get_console_errors structured entries
- [ ] B5a verify_route_loaded
- [ ] B5b verify_page_text
- [ ] B5c verify_console_clean
- [ ] B6 routes /, /cyberdeck, /preview
- [ ] B7 verification-receipts.jsonl fields
- [ ] B8 click unsupported
- [ ] B9 distinction test (open_url completed vs verify_route verified)

### Phase 2 — UI
- [ ] Verification badge visible
- [ ] Console error count visible
- [ ] Screenshot preview works
- [ ] Receipt path visible

### Phase 3 — Safety spot checks
- [ ] (list which ran)

### Evidence paths
- Latest screenshot:
- Latest receipt:
- safety-events tail (if B3 ran):

### Failures / notes:


### Verdict: PASS / FAIL / PARTIAL
```

---

## Codex regression fixes (2026-05-26)

| Issue | Fix |
|-------|-----|
| B5b stale text snapshot | `text_exists` re-navigates when route mismatches or text missing; cyberdeck waits for `cyberdeck-rail-tab` |
| B6 `/` matches any URL via `includes("/")` | `urlMatchesRoute()` uses pathname equality; `/` only matches root |
| B6 `/` redirect honesty | `/` → `/cyberdeck` redirect yields `verification_failed`, not false `verified` |
| Cold screenshot preview clears pane | Preview uses warm `GET /api/muthur/execution?screenshot=` (same route as polling) |

**Re-test:** restart `pnpm dev` after pulling fixes, then re-run B5–B6 and UI preview.

---

---

## Verdict rules

| Verdict | When |
|---------|------|
| **PASS** | Phase 0 pass + all B1–B9 minimum pass + UI spot check pass + distinction test pass |
| **PARTIAL** | Phase 0 pass but browser probe SKIP (dev server down) or Playwright missing — list blockers |
| **FAIL** | Fake PNG, remote URL navigated, `click` succeeds, `open_url` reported as `verified`, missing safety audit on block, or distinction test wrong |

---

## Do not claim (common false positives)

- `open_url` success = app verified (it's execution only unless followed by verify actions)
- `completed` with screenshot = verification passed
- Electron embedded browser = server Playwright bridge
- Probe `SKIP` = full L-12 PASS
- Screenshots under `.muthur/receipts/screenshots/` — **L-12 path is `.muthur/screenshots/`**
- PASS without opening at least one PNG and confirming magic bytes
- PASS without `browser_url_blocked` in safety log after B3

---

## Evidence paths (L-12)

| Artifact | Location |
|----------|----------|
| Screenshots | `.muthur/screenshots/*.png` |
| Receipt JSON | `.muthur/receipts/verification/*.json` |
| Receipt JSONL | `.muthur/logs/verification-receipts.jsonl` |
| Safety blocks | `.muthur/logs/safety-events.jsonl` |
| Preview API | `GET /api/muthur/screenshot?name=<basename>` |

---

## Related runbooks

| Phase | Document |
|-------|----------|
| Master plan | [`docs/muthur-codex-testing-plan.md`](muthur-codex-testing-plan.md) |
| L-10 Execution | [`docs/muthur-execution-loop-testing.md`](muthur-execution-loop-testing.md) |
| L-11 Verification | [`docs/muthur-verification-layer-testing.md`](muthur-verification-layer-testing.md) |
| L-12 Directive | [`docs/cadre/tech-lead-legislator/L-12-muthur-browser-verification-bridge.md`](cadre/tech-lead-legislator/L-12-muthur-browser-verification-bridge.md) |
