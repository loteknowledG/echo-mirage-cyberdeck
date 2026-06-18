# L-UX-CADRE-001 — MUTHUR / CADRE / POWERFIST UX Realignment

**Status:** In progress (Phase A)  
**Priority:** High

## Objective

Realign the MUTHUR, CADRE, and POWERFIST user experience around command orchestration rather than runtime management. The operator interacts primarily with MUTHUR while maintaining visibility into CADRE activity. Manual override lives in external POWERFIST (Electrobun floater / phone PWA), not the in-deck `rola-dex` mock.

## Mental model

```text
Operator → MUTHUR → CADRE → Result
                ↑
         POWERFIST (external override — later)
```

## Constraints (agreed)

1. Do **not** wire the in-deck `rola-dex` / POWERFIST pane into runtime control.
2. Do **not** build external POWERFIST in this repo.
3. Echo Mirage exposes **stable `CadreEvent` types and `/api/cadre/events`** for future POWERFIST consumers.
4. CADRE becomes **workforce visibility + activity stream**, not a runtime control center.
5. Runtime Start / Stop / Restart removed from primary CADRE UX or hidden under **Advanced diagnostics** only.
6. Significant CADRE events mirror into **MUTHUR history/archive**.
7. Current runtime hosting architecture remains functional.

## Phase A (this slice)

- [x] Stable `CadreEvent` type
- [x] Internal event bus + `cadre` signal source
- [x] Server event log + `GET /api/cadre/events`
- [x] SSE `cadre_event` stream for live clients
- [x] Filtered CADRE activity stream UI
- [x] MUTHUR archive for significant events
- [x] Runtime controls moved to Advanced section
- [x] Probe + verification checklist

## Phase B (next)

- Workforce-oriented agent rows (role, assignment, verification state)
- Unify OPERATORS pane with live CADRE state

## Phase C (later)

- External POWERFIST consumes `/api/cadre/events` + override APIs

## Acceptance criteria

1. Operator can complete normal CADRE workflows without primary runtime controls.
2. CADRE displays workforce-oriented status and a live activity stream.
3. Significant events appear in MUTHUR archive.
4. Runtime controls available under Advanced diagnostics only.
5. Existing runtime hosting remains functional.
