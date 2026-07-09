# JP-L-CYBERDECK-001-P8.4 — Legacy Pairing UI Removal (Judicial Receipt)

**Work order:** [L-CYBERDECK-001](../work-orders/L-CYBERDECK-001-cyberdeck-app-extraction.md)  
**Phase:** P8.4 — Remove legacy pairing UI (D8.4)  
**Branch:** `cursor/p8.4-remove-legacy-pairing-ui`  
**Base:** `main` @ P8.3 merge `b82f480`

---

## Verdict

**PASS** — `isSurveyLegacyPairingEnabled()` and legacy pairing UI removed; Survey Hub is the only connect path; probes green. **P8 complete.**

---

## Changes

| Area | Action |
|------|--------|
| `survey-mirage-pairing-dock.tsx` | **Deleted** |
| `survey-pane-body.tsx` | Removed dock mount |
| `survey-powerfist-pane.tsx` | Removed legacy PIN form + team socket; Hub hint only |
| `survey-boundary.ts` | Removed `isSurveyLegacyPairingEnabled`; updated transport tree |
| `survey-team-status-probe.client.ts` | Removed legacy cred validation branches |

---

## Checklist

| ID | Check | Result |
|----|-------|--------|
| V-P8.4-01 | Legacy pairing dock removed | PASS |
| V-P8.4-02 | `isSurveyLegacyPairingEnabled` removed | PASS |
| V-P8.4-03 | `tsc` + survey probes | PASS |

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
- [x] **P8 complete** (P8.1–P8.4)
