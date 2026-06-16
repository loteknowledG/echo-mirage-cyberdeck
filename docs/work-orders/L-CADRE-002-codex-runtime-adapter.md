# L-CADRE-002 — Codex Runtime Adapter

## Status

IMPLEMENTED

## Purpose

Replace the Phase 1 Codex stub with a real Codex CLI terminal host (PTY-backed) while preserving the Cadre pane lifecycle contract.

## Deliverables

- `src/lib/server/cadre/adapters/codex-runtime-adapter.server.ts`
- Updated `src/lib/server/cadre-runtime-manager.server.ts` (adapter routing)
- Updated `src/lib/cadre/runtime-registry.ts` (`adapter` metadata)
- Probe: `pnpm probe:codex-runtime-adapter`

## Safety

Observation only — no MUTHUR command injection, delegation, or orchestration.

## Verification

```powershell
pnpm exec tsc --noEmit
pnpm probe:codex-runtime-adapter
```
