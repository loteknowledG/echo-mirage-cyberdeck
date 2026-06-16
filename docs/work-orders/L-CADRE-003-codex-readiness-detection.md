# L-CADRE-003 — Codex Runtime Readiness Detection

## Status

IMPLEMENTED

## Purpose

Distinguish Codex process existence from Codex usability via conservative PTY output inspection.

## Readiness States

- `unknown`
- `starting`
- `blocked_update_prompt`
- `blocked_auth`
- `ready`
- `errored`
- `stopped`

## Verification

```powershell
pnpm exec tsc --noEmit
pnpm probe:codex-readiness-detector
```
