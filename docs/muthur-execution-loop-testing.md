# MUTHUR Execution Loop — Codex Test Runbook (L-10 Phase 1)

Use this document to verify the MUTHUR tool execution loop end-to-end.

**Scope:** Local execution only. Phase 1 tools + safety gates + audit logs + execution pane UI.

**Doctrine under test:** Observe honestly. Execute deliberately. Verify visibly.

---

## Prerequisites

1. Repo root: `f:\dev\echo-mirage-cyberdeck`
2. Dependencies installed: `pnpm install`
3. For API/UI tests, dev server running:
   ```powershell
   cd f:\dev\echo-mirage-cyberdeck
   pnpm dev
   ```
4. Default dev URL: `http://127.0.0.1:3050` (`pnpm dev` via `scripts/next-dev.mjs`; health sidecar on `:3051/health`)

**Important:** Execution state is a **server singleton** (one in-memory loop per dev-server process). Restarting `pnpm dev` clears runtime state but keeps audit JSONL on disk.

---

## Quick automated gate (run first)

From repo root:

```powershell
pnpm exec tsc --noEmit
pnpm exec tsx scripts/probe-muthur-execution-loop.ts
pnpm build
```

### Expected

| Command | Pass criteria |
|---------|---------------|
| `tsc --noEmit` | Exit 0, no errors |
| `probe-muthur-execution-loop.ts` | Prints `probe-muthur-execution-loop: PASS`, exit 0 |
| `pnpm build` | Exit 0 (warnings from unrelated deps are OK) |

**Do not claim UI or live API tests passed if only these commands were run.**

---

## API tests (requires `pnpm dev`)

Base URL used below: `http://127.0.0.1:3050`

Use PowerShell `Invoke-RestMethod` or `curl.exe`.

### T1 — GET runtime state

```powershell
Invoke-RestMethod http://127.0.0.1:3050/api/muthur/execution
```

**Expect:**
- `ok: true`
- `state.execution_mode` is `"observe"` (default)
- `state.loop_status` is `"idle"` (when nothing running)
- `state.queue` is an array
- `state.heartbeat_at` is an ISO timestamp

---

### T2 — Set mode to execute

```powershell
$body = @{ op = "set_mode"; mode = "execute" } | ConvertTo-Json
Invoke-RestMethod http://127.0.0.1:3050/api/muthur/execution -Method POST -ContentType "application/json" -Body $body
```

**Expect:** `state.execution_mode` → `"execute"`

---

### T3 — Enqueue + wait: `wait` then allowlisted shell

```powershell
$body = @{
  op = "enqueue"
  mode = "execute"
  wait = $true
  taskLabel = "codex-test-batch"
  actions = @(
    @{ type = "wait"; payload = @{ ms = 50 }; source = "system" },
    @{ type = "shell_command"; payload = @{ command = "git status --short" }; source = "system" }
  )
} | ConvertTo-Json -Depth 6

Invoke-RestMethod http://127.0.0.1:3050/api/muthur/execution -Method POST -ContentType "application/json" -Body $body
```

**Expect:**
- `ok: true`
- `results` length = 2
- Both actions `status: "completed"`
- Shell result has structured fields: `result.success`, `result.duration_ms`, optional `result.stdout`, `result.exit_code`
- `state.queue_length` = 0 after completion

---

### T4 — Observe mode blocks until approval

```powershell
# Set observe
$mode = @{ op = "set_mode"; mode = "observe" } | ConvertTo-Json
Invoke-RestMethod http://127.0.0.1:3050/api/muthur/execution -Method POST -ContentType "application/json" -Body $mode

# Enqueue write (no wait)
$enqueue = @{
  op = "enqueue"
  taskLabel = "codex-blocked-write"
  actions = @(
    @{
      type = "write_file"
      source = "system"
      payload = @{ path = ".muthur/logs/codex-test.txt"; content = "codex probe" }
    }
  )
} | ConvertTo-Json -Depth 6

$r = Invoke-RestMethod http://127.0.0.1:3050/api/muthur/execution -Method POST -ContentType "application/json" -Body $enqueue
$actionId = $r.created[0].id
```

**Expect:**
- `created[0].status` = `"blocked"`
- `state.queue_length` ≥ 1
- File `.muthur/logs/codex-test.txt` does **not** exist yet

Approve:

```powershell
$approve = @{ op = "approve"; actionId = $actionId } | ConvertTo-Json
Invoke-RestMethod http://127.0.0.1:3050/api/muthur/execution -Method POST -ContentType "application/json" -Body $approve

Start-Sleep -Seconds 2
Invoke-RestMethod http://127.0.0.1:3050/api/muthur/execution
```

**Expect after approve:**
- Queue drains; action moves to `completed_actions`
- `.muthur/logs/codex-test.txt` exists with content `codex probe`

---

### T5 — Deny blocked action

```powershell
$mode = @{ op = "set_mode"; mode = "observe" } | ConvertTo-Json
Invoke-RestMethod http://127.0.0.1:3050/api/muthur/execution -Method POST -ContentType "application/json" -Body $mode

$enqueue = @{
  op = "enqueue"
  actions = @(
    @{
      type = "write_file"
      source = "system"
      payload = @{ path = ".muthur/logs/codex-denied.txt"; content = "should not write" }
    }
  )
} | ConvertTo-Json -Depth 6

$r = Invoke-RestMethod http://127.0.0.1:3050/api/muthur/execution -Method POST -ContentType "application/json" -Body $enqueue
$id = $r.created[0].id

$deny = @{ op = "deny"; actionId = $id } | ConvertTo-Json
Invoke-RestMethod http://127.0.0.1:3050/api/muthur/execution -Method POST -ContentType "application/json" -Body $deny
```

**Expect:**
- Action `status: "cancelled"` in `completed_actions`
- `.muthur/logs/codex-denied.txt` does **not** exist

---

### T6 — Honest failure vs real capabilities (L-11 aware)

**Important:** After L-11, `screenshot` and localhost `open_url` are **real** actions. T6 tests honest failure for still-unsupported types and policy blocks — not fake success.

#### T6a — Unsupported action type (`click`)

```powershell
$body = @{
  op = "enqueue"
  mode = "execute"
  wait = $true
  actions = @(
    @{ type = "click"; payload = @{ x = 1; y = 2 }; source = "system" }
  )
} | ConvertTo-Json -Depth 6

$r = Invoke-RestMethod http://127.0.0.1:3050/api/muthur/execution -Method POST -ContentType "application/json" -Body $body
```

**Expect:**
- `results[0].status` = `"unsupported"` (NOT `"completed"`)
- `results[0].result.success` = false
- No fake success message

#### T6b — `screenshot` is real (L-11)

```powershell
$body = @{
  op = "enqueue"
  mode = "execute"
  wait = $true
  actions = @(
    @{ type = "open_url"; payload = @{ route = "/cyberdeck" }; source = "system" },
    @{ type = "screenshot"; payload = @{ label = "t6b" }; source = "system" }
  )
} | ConvertTo-Json -Depth 6

$r = Invoke-RestMethod http://127.0.0.1:3050/api/muthur/execution -Method POST -ContentType "application/json" -Body $body
```

**Expect:**
- Screenshot action `status` = `"completed"` (NOT `unsupported`)
- `result.screenshot_path` points to an existing PNG under `.muthur/screenshots/`

#### T6c — Remote `open_url` blocked (localhost only)

```powershell
$body = @{
  op = "enqueue"
  mode = "execute"
  wait = $true
  actions = @(
    @{ type = "open_url"; payload = @{ url = "https://example.com" }; source = "system" }
  )
} | ConvertTo-Json -Depth 6

$r = Invoke-RestMethod http://127.0.0.1:3050/api/muthur/execution -Method POST -ContentType "application/json" -Body $body
```

**Expect:**
- `status` = `"failed"` (NOT `"completed"`)
- Error mentions localhost restriction / Phase 2 policy
- No pretend navigation success

---

### T7 — Shell safety: non-allowlisted command fails

```powershell
$body = @{
  op = "enqueue"
  mode = "execute"
  wait = $true
  actions = @(
    @{ type = "shell_command"; payload = @{ command = "rm -rf /" }; source = "system" }
  )
} | ConvertTo-Json -Depth 6

$r = Invoke-RestMethod http://127.0.0.1:3050/api/muthur/execution -Method POST -ContentType "application/json" -Body $body
```

**Expect:**
- Action ends `failed` or stays `blocked` depending on mode
- Must NOT execute destructive command
- Error mentions allowlist / not allowlisted

**Allowlisted commands (only these may succeed as shell):**
- `pnpm exec tsc --noEmit`
- `pnpm build`
- `pnpm e2e`
- `git diff`
- `git status --short`
- `git log --oneline -10`

---

### T8 — Interrupt controls

Enqueue a slow wait without `wait: true`, then interrupt:

```powershell
$body = @{
  op = "enqueue"
  mode = "execute"
  actions = @(
    @{ type = "wait"; payload = @{ ms = 10000 }; source = "system" }
  )
} | ConvertTo-Json -Depth 6
Invoke-RestMethod http://127.0.0.1:3050/api/muthur/execution -Method POST -ContentType "application/json" -Body $body

$stop = @{ op = "stop" } | ConvertTo-Json
Invoke-RestMethod http://127.0.0.1:3050/api/muthur/execution -Method POST -ContentType "application/json" -Body $stop
```

**Expect:** `state.user_interrupt` = true, `loop_status` = `"stopped"`

Clear queue test:

```powershell
# Enqueue two waits without wait:true
$body = @{
  op = "enqueue"
  mode = "execute"
  actions = @(
    @{ type = "wait"; payload = @{ ms = 5000 }; source = "system" },
    @{ type = "wait"; payload = @{ ms = 5000 }; source = "system" }
  )
} | ConvertTo-Json -Depth 6
Invoke-RestMethod http://127.0.0.1:3050/api/muthur/execution -Method POST -ContentType "application/json" -Body $body

$clear = @{ op = "clear_queue" } | ConvertTo-Json
$r = Invoke-RestMethod http://127.0.0.1:3050/api/muthur/execution -Method POST -ContentType "application/json" -Body $clear
```

**Expect:** `removed` ≥ 0, pending queue emptied or cancelled

Pause / resume:

```powershell
$pause = @{ op = "pause" } | ConvertTo-Json
Invoke-RestMethod http://127.0.0.1:3050/api/muthur/execution -Method POST -ContentType "application/json" -Body $pause

$resume = @{ op = "resume" } | ConvertTo-Json
Invoke-RestMethod http://127.0.0.1:3050/api/muthur/execution -Method POST -ContentType "application/json" -Body $resume
```

**Expect:** `loop_status` transitions `paused` → `running` or `idle`

---

### T9 — read_file within workspace

```powershell
$body = @{
  op = "enqueue"
  mode = "execute"
  wait = $true
  actions = @(
    @{ type = "read_file"; payload = @{ path = "package.json" }; source = "system" }
  )
} | ConvertTo-Json -Depth 6

$r = Invoke-RestMethod http://127.0.0.1:3050/api/muthur/execution -Method POST -ContentType "application/json" -Body $body
```

**Expect:** `completed`, `result.stdout` contains `"name"` (package.json content)

---

## Audit log verification

After API tests, confirm append-only JSONL logs exist:

```powershell
Get-ChildItem f:\dev\echo-mirage-cyberdeck\.muthur\logs
Get-Content f:\dev\echo-mirage-cyberdeck\.muthur\logs\tool-actions.jsonl -Tail 5
Get-Content f:\dev\echo-mirage-cyberdeck\.muthur\logs\execution-session.jsonl -Tail 5
Get-Content f:\dev\echo-mirage-cyberdeck\.muthur\logs\safety-events.jsonl -Tail 5
```

**Expect files:**
- `execution-session.jsonl` — enqueue, mode changes, stop/pause events
- `tool-actions.jsonl` — per-action result, duration, approval status
- `safety-events.jsonl` — approve/deny entries

Each line must be valid JSON (JSONL format).

---

## UI tests (Cyberdeck, requires browser)

1. Open `http://127.0.0.1:3050/cyberdeck`
2. Convert or open a tab as **MUTHUR Execution**
   - Tab command example: `convert this tab to muthur-execution`
   - Or use tab context menu → **MUTHUR Execution**
3. Verify pane shows:
   - Mode buttons: OBSERVE / SUGGEST / EXECUTE
   - Controls: STOP, PAUSE, RESUME, CLEAR QUEUE
   - Sections: Active, Queue, Recent results
4. With pane open, run **T3** via API — pane should update within ~1s (poll interval 800ms):
   - Active action while running
   - Completed actions in Recent results
   - Elapsed time updates
5. Run **T4** (blocked write) — pane shows blocked action with **APPROVE** / **DENY** buttons
6. Click **APPROVE** — action completes, file written
7. Click **DENY** on another blocked action — action cancelled, no file write

**Pass criteria:** UI reflects real API state only (no decorative fake running indicators).

---

## Legacy JSON chat path (optional integration test)

With dev server + Cyberdeck chat:

1. Ensure MUTHUR returns a legacy tool JSON body (plain text, not native tool_calls), e.g.:
   ```json
   {"tool":"bash","command":"git status --short"}
   ```
2. Chat handler should route through `/api/muthur/execution` (not direct `/api/execute-command`)
3. **Expect:** system line `EXECUTION // SHELL_COMMAND // QUEUED`, then structured result in assistant message
4. Non-allowlisted command should fail with blocked/failed message, not silent success

**Note:** OpenAI native tool rounds still require `ENABLE_AUTOMATION = true` in `src/lib/cyberdeck/automation-config.ts`. Do not claim native tool loop works while that flag is false.

---

## Negative tests (must fail honestly)

| Test | Input | Must NOT happen |
|------|-------|-----------------|
| Arbitrary shell | `shell_command: "del /f /q *"` | Success / execution |
| Path escape | `read_file` outside workspace | File content returned |
| Remote browser | `open_url` to `https://example.com` | Pretend navigation succeeded |
| Unsupported input | `click` | `status: completed` with success |
| Unstoppable loop | enqueue 20 waits, click STOP | Loop continues indefinitely |

---

## Reporting template (for Codex)

Copy and fill after testing:

```markdown
## MUTHUR Execution Loop test report

- Date:
- Commit/branch:
- Tester:

### Automated
- [ ] tsc --noEmit
- [ ] probe-muthur-execution-loop.ts
- [ ] pnpm build

### API (T1–T9)
- [ ] T1 GET state
- [ ] T2 set mode
- [ ] T3 wait + shell batch
- [ ] T4 observe + approve write
- [ ] T5 deny write
- [ ] T6a unsupported (`click`) honest
- [ ] T6b screenshot real PNG evidence
- [ ] T6c remote open_url blocked
- [ ] T7 shell allowlist rejection
- [ ] T8 stop / clear / pause / resume
- [ ] T9 read_file

### Audit logs
- [ ] tool-actions.jsonl appended
- [ ] execution-session.jsonl appended
- [ ] safety-events.jsonl on approve/deny

### UI
- [ ] Execution pane visible
- [ ] Live state matches API
- [ ] Approve/deny buttons work

### Failures / notes:


### Verdict: PASS / FAIL / PARTIAL
```

---

## Known limitations (do not fail tests for these)

- `ENABLE_AUTOMATION` defaults to `false` — native OpenAI tool rounds in chat disabled
- Card Table `attemptExecute()` still separate / blocked
- Browser bridge (L-11): `open_url` localhost only; `screenshot` real via Playwright
- `click`, `type_text`, `ask_user` — still unsupported
- Runtime state resets on dev-server restart
- Single-process singleton (not multi-instance)

---

## Key file references

| Area | Path |
|------|------|
| Loop runtime | `src/lib/muthur/execution/execution-loop.ts` |
| Action runner | `src/lib/muthur/execution/action-runner.ts` |
| Safety policy | `src/lib/muthur/execution/safety-policy.ts` |
| API route | `src/app/api/muthur/execution/route.ts` |
| Execution pane | `src/components/cyberdeck/muthur-execution-pane-body.tsx` |
| Probe script | `scripts/probe-muthur-execution-loop.ts` |
| L-10 spec | `docs/cadre/tech-lead-legislator/L-10-muthur-tool-execution-loop-(phase-1).md` |

---

## Verified run log

| Date | Commit | Verdict | Notes |
|------|--------|---------|-------|
| 2026-05-26 | `0217ba2` (dirty) | **PASS** | Codex — L-10 execution + L-11 verification + distinction test. T6 plan updated post-L-11 (`screenshot` real, `click` unsupported). |
| 2026-05-26 | `0217ba2` (dirty) | **PASS** | Codex — automated + API T1–T9 + audit JSONL + UI approve/deny. Screenshots in `test-results/`. T7: non-allowlisted shell blocked then fails on approval attempt. |
