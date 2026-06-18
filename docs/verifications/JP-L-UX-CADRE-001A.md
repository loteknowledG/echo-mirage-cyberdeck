# JP-L-UX-CADRE-001A — Phase A verification

**Work order:** `docs/work-orders/L-UX-CADRE-001-muthur-cadre-powerfist-ux-realignment.md`

## Automated

```bash
pnpm probe:cadre-events
```

Expect: `probe:cadre-events PASS`

## Manual checklist (CADRE pane)

- [ ] Open **CADRE** tab — subtitle reads `WORKFORCE VISIBILITY // ACTIVITY STREAM`
- [ ] Primary panel shows **CADRE ACTIVITY STREAM** (not terminal output)
- [ ] **START / STOP / RESTART** are under **ADVANCED DIAGNOSTICS** only
- [ ] Expand Advanced → start **CURSOR** runtime → activity stream shows `[CURSOR] …` lines
- [ ] Terminal output appears only inside Advanced (no raw spam in activity stream)

## MUTHUR history

- [ ] After a significant event (runtime started/stopped, verification pass), open **MUTHUR** chat
- [ ] Diagnostics or chat history contains `CADRE // <ACTOR> // <message>`
- [ ] Stream connect/disconnect lines do **not** flood MUTHUR history

## External API (future POWERFIST)

- [ ] `GET /api/cadre/events` returns `{ ok: true, events: CadreEvent[] }`
- [ ] SSE `/api/cadre/stream` emits `event: cadre_event` payloads

## Out of scope (Phase A)

- In-deck POWERFIST runtime wiring
- External Electrobun POWERFIST app
- Full workforce assignment model (Phase B)
