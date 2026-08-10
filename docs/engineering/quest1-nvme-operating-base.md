# Quest 1 — NVMe operating base verification

**Status:** PASSED (initial verification)  
**Date:** 2026-08-10  
**Clone:** `C:\dev\echo-mirage-cyberdeck`  
**Sibling:** `C:\dev\realmorphism`  
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

## Quest 1 exit gate checklist

- [x] NVMe clone at `C:\dev\echo-mirage-cyberdeck`
- [x] Branch `cursor/voice-lab-mechanicus-wip` @ `b219c91`
- [x] Fresh `pnpm install`
- [x] `.env.local` restored
- [x] `tsc --noEmit` clean
- [x] Production build passes (cold **5m 19s**, warm **4m 24s**)
- [ ] Dev server smoke (`pnpm dev`) — operator acceptance
- [ ] Remote push/pull from NVMe clone — operator acceptance
- [ ] Quest 0 evidence branch pushed / merged
