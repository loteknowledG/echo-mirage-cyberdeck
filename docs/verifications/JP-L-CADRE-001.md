# JP-L-CADRE-001 -- Live UI Terminal Host Verification

## Verdict

**PASS** (probe + live UI)

The Cadre Terminal Host Framework works through the live Cyberdeck UI and does not require provider uplink.

---

## Commands

```powershell
pnpm probe:cadre-host
pnpm exec tsc --noEmit
```

Result:

```text
PASS
PASS
```

---

## Live UI Target

```text
http://127.0.0.1:3050/cyberdeck
```

Browser:

```text
Playwright fallback
```

The in-app browser surface was unavailable in this session, so the permitted Playwright fallback was used.

---

## Acceptance

| ID | Check | Result |
|----|-------|--------|
| 1 | Cyberdeck loads with HTTP 200, command input visible, response channel mounted, Diagnostics collapsed | PASS |
| 2 | Cadre pane opens from the `+` tab menu and displays MUTHUR, CODEX, CURSOR, OPENCODE, PI | PASS |
| 3 | `GET /api/cadre/runtimes` returns `CADRE HOST READY` and runtime slots | PASS |
| 4 | CODEX starts through UI START via `POST /api/cadre/start` | PASS |
| 5 | Terminal output appears and `GET /api/cadre/stream` is active | PASS |
| 6 | CODEX stops through UI STOP via `POST /api/cadre/stop` | PASS |
| 7 | CODEX restarts through UI RESTART with STOPPED to RUNNING transition | PASS |
| 8 | CODEX RUNNING state persists through Cadre pane refresh | PASS |
| 9 | Invalid OpenRouter provider state does not affect Cadre host | PASS |
| 10 | START, RUNNING, OUTPUT, STOP, STOPPED lifecycle occurs without stall, provider errors, or runtime crashes | PASS |

---

## Evidence

Cadre pane displayed:

```text
CADRE HOST READY
STREAM LIVE
MUTHUR
CODEX
CURSOR
OPENCODE
PI
```

Runtime registry returned:

```text
CADRE HOST READY
CODEX
CURSOR
OPENCODE
PI
```

CODEX start response:

```json
{
  "ok": true,
  "runtime": {
    "id": "codex",
    "name": "CODEX",
    "status": "running",
    "terminalType": "codex"
  }
}
```

Visible terminal output included:

```text
[CADRE] spawning CODEX host
[CODEX] CADRE HOST STUB ONLINE
[CODEX] awaiting operator directives (observation only)
[CODEX] heartbeat
```

CODEX stop response:

```json
{
  "ok": true,
  "runtime": {
    "id": "codex",
    "name": "CODEX",
    "status": "stopped",
    "terminalType": "codex"
  }
}
```

RESTART issued:

```text
POST /api/cadre/stop
POST /api/cadre/start
```

and returned CODEX to:

```text
RUNNING
```

Provider independence was verified with:

```text
active_provider=openrouter
key_openrouter=invalid-cadre-verifier-key
```

The Cadre pane continued to show CODEX RUNNING and terminal output. No invalid API key text appeared.

Negative routing assertion:

```text
POST /api/cyberdeck-chat was not used.
```

Cleanup:

```text
CODEX stopped
CURSOR stopped
OPENCODE stopped
PI stopped
```

---

## Decision Record

Successful verification creates:

```text
ADR-CADRE-001 -- Cadre Runtimes Are Hosted As Visible Operator Stations
```

---

## Related

* L-CADRE-001 -- Terminal Host Framework
* L-MEM-005 -- Memory Atlas Retrieval Pipeline
* L-MEM-006 -- Entity & Relationship Atlas
* ADR-MEM-001 -- Deterministic Memory Atlas Routing Before Provider Uplink
* ADR-MEM-002 -- Project Continuity Graph
* ADR-CADRE-001 -- Cadre Runtimes Are Hosted As Visible Operator Stations
