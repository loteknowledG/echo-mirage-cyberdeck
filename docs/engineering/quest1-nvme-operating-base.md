# Quest 1 — NVMe operating base verification

**Status:** GO — operator checks substantially passed (automated); push pending PR #109 merge  
**Date:** 2026-08-10  
**Authoritative clone:** `C:\dev\echo-mirage-cyberdeck`  
**Branch:** `cursor/voice-lab-mechanicus-wip` @ `8b1b10d` (includes Quest 0/1 docs via fast-forward)  
**Evidence PR:** https://github.com/loteknowledG/echo-mirage-cyberdeck/pull/109  
**Recovery copy (unchanged):** `F:\dev\echo-mirage-cyberdeck`  
**Benchmark temp (preserve):** `C:\temp\quest0-nvme-echo-mirage-b219c91`

## Setup

| Item | Receipt |
|------|---------|
| Branch | `cursor/voice-lab-mechanicus-wip` @ `b219c91` |
| Clone method | `git clone` from origin (not robocopy) |
| `node_modules` | **Fresh `pnpm install`** on NVMe (pnpm store reused from `%LOCALAPPDATA%`) |
| `.env.local` | Copied from F: source (3339 bytes) |
| Node | v24.17.0 |
| pnpm | 10.33.2 |
| Defender | RealTimeProtection on |

## Voice / Mechanicus WIP present

- `src/lib/cyberdeck/mechanicus-voice-profile.ts`
- `src/server/render-mechanicus-voice.ts`
- `src/app/api/tts/route.ts` (Mechanicus + Edge fallback)
- `pnpm exec tsc --noEmit` — **exit 0**

## Production builds (fresh install, no copied `.next`)

| Run | Wall | `run-webpack` (trace) | Exit | Notes |
|-----|------|------------------------|------|-------|
| **Cold** | **318.6 s (5m 19s)** | 205.6 s (3.4 min banner) | 0 | 21/21 static pages, full route table |
| **Warm** | **263.6 s (4m 24s)** | 166.8 s | 0 | `.next` retained |

Compare USB F: warm: **1973 s (32m 53s)** · NVMe Quest 0 warm (copied deps): **380 s**.

## Cursor / agent workflow

Open workspace: **`C:\dev\echo-mirage-cyberdeck`**

Do not delete `F:\dev\echo-mirage-cyberdeck` until explicit acceptance sign-off.

## Branch integration

| Branch | Role |
|--------|------|
| `cursor/quest0-build-baseline-nvme` | Quest 0/1 evidence (2 commits on top of voice branch) |
| `cursor/voice-lab-mechanicus-wip` | Voice Lab WIP + target integration branch |
| **PR #109** | Stacks evidence onto voice branch: https://github.com/loteknowledG/echo-mirage-cyberdeck/pull/109 |

NVMe clone fast-forwarded `cursor/voice-lab-mechanicus-wip` to include evidence commits locally (`b219c91` → `8b1b10d`).

## Operator acceptance checklist

| Check | Status | Notes |
|-------|--------|-------|
| Open project in Cursor at `C:\dev\echo-mirage-cyberdeck` | **Operator** | Automated tasks use this path |
| `pnpm dev` | **PASS** | Ready in ~6.6s; sidecar :3051 ok |
| Load `/cyberdeck` | **PASS** | HTTP 200; shell hydrated |
| Voice Lab / Mechanicus | **PARTIAL** | `/api/tts` mechanicus-voice **ok** (Edge fallback when Coderobo unavailable); UI Voice toggle present |
| MUTHUR assignment behavior | **PASS** | VOICE control visible; MUTHUR pane loaded |
| Browser/server errors | **PASS*** | Survey tailscale 502 + powerfist 403 are environmental/expected; no NVMe blockers |
| Git fetch/push | **PASS (dry-run)** | `git push --dry-run origin cursor/voice-lab-mechanicus-wip` → `b219c91..8b1b10d` |

\*Operator should confirm Voice Lab pane preview interactively after opening a Voice Lab tab from the rail.

## Quest 1 exit gate checklist

- [x] NVMe clone at `C:\dev\echo-mirage-cyberdeck`
- [x] Branch includes voice WIP + Quest 0/1 docs (`8b1b10d`)
- [x] Fresh `pnpm install`
- [x] `.env.local` restored
- [x] `tsc --noEmit` clean
- [x] Production build passes (cold **5m 19s**, warm **4m 24s**)
- [x] Dev server smoke (`pnpm dev`, `/cyberdeck` loads)
- [x] Mechanicus `/api/tts` smoke
- [x] Evidence PR opened (**#109**)
- [ ] Operator: interactive Voice Lab preview + confirm PR #109 merged before push to origin
