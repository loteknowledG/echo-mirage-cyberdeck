# Quest 1 — NVMe operating base verification

**Status:** **PASSED** (2026-08-10)  
**Authoritative clone:** `C:\dev\echo-mirage-cyberdeck`  
**Branch:** `cursor/voice-lab-mechanicus-wip` @ `01c33e5` (post–PR #109 merge)  
**Evidence PR:** [#109 merged](https://github.com/loteknowledG/echo-mirage-cyberdeck/pull/109) (merge commit `01c33e5`)  
**Recovery copy (unchanged):** `F:\dev\echo-mirage-cyberdeck`  
**Benchmark temp (preserve):** `C:\temp\quest0-nvme-echo-mirage-b219c91`

---

## Dev server ports (operator testing)

| Port | Role | Operator URL |
|------|------|----------------|
| **3050** | **Next.js app — Cyberdeck UI** | **http://localhost:3050/cyberdeck** |
| 3051 | Readiness sidecar only (`/health`) | http://localhost:3051/health — not the app |
| 3052 | PowerFist WebSocket | ws://localhost:3052 |

Use **3050** for all Cyberdeck / Voice Lab operator checks. `:3051` confirms dev harness readiness only.

---

## Setup

| Item | Receipt |
|------|---------|
| Branch | `cursor/voice-lab-mechanicus-wip` @ `b219c91` at clone; synced to `01c33e5` |
| Clone method | `git clone` from origin (not robocopy) |
| `node_modules` | **Fresh `pnpm install`** on NVMe |
| `.env.local` | Copied from F: source (3339 bytes) |
| Node | v24.17.0 |
| pnpm | 10.33.2 |

---

## Production builds (fresh install)

| Run | Wall | `run-webpack` (trace) | Exit |
|-----|------|------------------------|------|
| **Cold** | **318.6 s (5m 19s)** | 205.6 s | 0 |
| **Warm** | **263.6 s (4m 24s)** | 166.8 s | 0 |

vs USB F: warm **1973 s (32m 53s)** — **~7.5× improvement** on NVMe.

---

## Branch integration (correct order)

1. Local NVMe clone fast-forwarded evidence commits for development (`b219c91` → `860cfbf`).
2. **PR #109 merged** on GitHub with **merge commit** (preserves head commits `50f3e4e`, `8b1b10d`, `860cfbf`).
3. NVMe clone synchronized — **no pre-merge push**:

   ```powershell
   cd C:\dev\echo-mirage-cyberdeck
   git pull --ff-only origin cursor/voice-lab-mechanicus-wip
   ```

   Result: `860cfbf` → `01c33e5` fast-forward; **in sync with `origin`**.

---

## Operator acceptance checklist

| Check | Status | Notes |
|-------|--------|-------|
| Cursor workspace `C:\dev\echo-mirage-cyberdeck` | **PASS** | Authoritative base |
| `pnpm dev` | **PASS** | App **:3050**; sidecar **:3051/health** |
| Load **http://localhost:3050/cyberdeck** | **PASS** | Shell hydrated |
| Open Voice Lab from rail (+ → Voice Lab) | **PASS** | Tab opened |
| Preview Mechanicus | **PASS** | Status: `Played mechanicus-voice.` |
| Preview does not assign MUTHUR | **PASS** | `echo-mirage-muthur-voice-lab-enabled-v1` stayed `null` until explicit toggle |
| MUTHUR active-voice toggle | **PASS** | Toggle off→on (`1`)→off (`0`) updates localStorage |
| `/api/tts` mechanicus-voice | **PASS** | API smoke (Edge fallback when Coderobo unavailable) |
| PR #109 merged + NVMe `git pull --ff-only` | **PASS** | @ `01c33e5` |

### Environmental degradation (recorded, non-blocking)

| Signal | Cause | Blocks Quest 1? |
|--------|-------|-----------------|
| Survey `502` @ `100.66.91.18:3050` | Tailscale / remote Echo unreachable | No |
| PowerFist `403` @ `/api/powerfist/pair` | Expected off localhost / pairing gate | No |

These are operational/environmental, not NVMe build-performance regressions.

---

## Quest 1 exit gate — **PASSED**

```text
Quest 0: PASSED
Quest 1: PASSED
Authoritative development base: C:\dev\echo-mirage-cyberdeck
Recovery copies: retained (F: repo + C:\temp benchmark)
Next: Quest 2 — measured reversible build improvements
```

---

## Cursor / Codex routing

- **Engineering implementation:** `C:\dev\echo-mirage-cyberdeck`
- **Planning continuity (this thread):** may remain rooted at `F:\dev\voice-lab` — do not edit F: USB repo for new work

Do not delete `F:\dev\echo-mirage-cyberdeck` or `C:\temp\quest0-nvme-echo-mirage-b219c91` until explicit cleanup.
