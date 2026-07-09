# JP-L-CYBERDECK-001-P8.1 — Survey Mission Type Cleanup (Judicial Receipt)

**Work order:** [L-CYBERDECK-001](../work-orders/L-CYBERDECK-001-cyberdeck-app-extraction.md)  
**Phase:** P8.1 — Remove deprecated `PowerfistMission*` type aliases (D8.1)  
**Branch:** `cursor/p8.1-survey-mission-type-cleanup`  
**Base:** `main` @ P7.4 merge `651b9c1`

---

## Verdict

**PASS** — Deprecated `PowerfistMission*` type and constant aliases removed; server modules use `SurveyMission*` types only; survey probes green.

---

## Changes

| Area | Action |
|------|--------|
| `powerfist-mission.types.ts` | Removed `PowerfistMissionKind`, `PowerfistMissionEnvelope`, `PowerfistMissionSolveDetail`, `POWERFIST_MISSION_SOLVE_EVENT`, `SILENT_CAPTURE_SOLVE_PROMPT` aliases |
| Server consumers | `SurveyMission*` types in mission store, WS server, hub bridge, pairing registry, ingest route |

Function names (`storePowerfistMission`, `broadcastPowerfistMissionSolve`, etc.) unchanged — rename deferred to later P8 slices.

---

## Checklist

| ID | Check | Result |
|----|-------|--------|
| V-P8.1-01 | Deprecated type aliases removed | PASS |
| V-P8.1-02 | No remaining `PowerfistMission*` type imports | PASS |
| V-P8.1-03 | `tsc` + survey probes | PASS |

---

## Evidence

```text
tsc --noEmit exit 0
probe:survey-hub PASS
probe:cyberdeck-compile-scope PASS
```

---

## Sign-off

- [x] Judicial PASS
- [ ] Merge to `main`
- [ ] **P8.2 HEAD** (`survey-hub-socket` rename + shim)
