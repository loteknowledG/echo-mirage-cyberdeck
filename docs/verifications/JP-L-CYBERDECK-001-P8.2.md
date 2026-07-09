# JP-L-CYBERDECK-001-P8.2 — Survey Hub Socket Rename (Judicial Receipt)

**Work order:** [L-CYBERDECK-001](../work-orders/L-CYBERDECK-001-cyberdeck-app-extraction.md)  
**Phase:** P8.2 — Rename `powerfist-remote-socket` → `survey-hub-socket` (D8.2)  
**Branch:** `cursor/p8.2-survey-hub-socket-rename`  
**Base:** `main` @ P8.1 merge `e1e1475`

---

## Verdict

**PASS** — Mirage hub WebSocket client moved to `survey-hub-socket.ts`; `powerfist-remote-socket.ts` is a one-release re-export shim; consumers and boundary probes updated; survey probes green.

---

## Changes

| Area | Action |
|------|--------|
| `survey-hub-socket.ts` | Canonical module (implementation) |
| `powerfist-remote-socket.ts` | `@deprecated` re-export shim |
| Consumers | Import from `survey-hub-socket` (9 modules) |
| Probes / boundary | Forbid both paths in `cyberdeck-app`; deck socket must use `survey-hub-socket` |

---

## Checklist

| ID | Check | Result |
|----|-------|--------|
| V-P8.2-01 | `survey-hub-socket.ts` is canonical | PASS |
| V-P8.2-02 | Shim re-exports from canonical module | PASS |
| V-P8.2-03 | `tsc` + survey probes | PASS |

---

## Evidence

```text
survey-hub-socket.ts: 509 lines (canonical)
powerfist-remote-socket.ts: 2 lines (shim)
tsc --noEmit exit 0
probe:survey-hub PASS
```

---

## Sign-off

- [x] Judicial PASS
- [ ] Merge to `main`
- [ ] **P8.3 HEAD** (delete dead embed/pane loaders)
