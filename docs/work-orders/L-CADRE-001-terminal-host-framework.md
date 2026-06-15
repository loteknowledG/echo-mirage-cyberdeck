# L-CADRE-001 — Terminal Host Framework

## Status

IMPLEMENTED

## Owner

MUTHUR / Cadre

## Era

2 — Bridge

## Purpose

Establish a Terminal Host Framework capable of embedding multiple long-running AI runtimes inside Echo Mirage for observation only (spawn, display, observe, terminate).

## Deliverables

- Cadre pane (`src/components/cyberdeck/cadre-pane-body.tsx`)
- Runtime registry (`src/lib/cadre/runtime-registry.ts`)
- Runtime manager (`src/lib/server/cadre-runtime-manager.server.ts`)
- APIs: `GET /api/cadre/runtimes`, `POST /api/cadre/start`, `POST /api/cadre/stop`, `GET /api/cadre/stream`
- Probe: `pnpm probe:cadre-host`

## Phase 1 Scope

Host visibility only — no orchestration, delegation, HAT, or continuity transfer.

## Verification

```powershell
pnpm probe:cadre-host
pnpm exec tsc --noEmit
```

Browser: open Cadre pane, start CODEX, observe RUNNING + output, stop CODEX, observe STOPPED. Pane should show `CADRE HOST READY`.
