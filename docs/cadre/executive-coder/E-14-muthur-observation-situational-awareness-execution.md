# E-14 - MUTHUR Observation and Situational Awareness Execution Order

## Authority

- Legislation: `docs/cadre/tech-lead-legislator/L-14-muthur-observation-&-situational-awareness-act.md`
- Executor: CODEX
- Reviewer: CURSOR
- Verification authority: MUTHUR

## Implemented Scope

MUTHUR receives a bounded, read-only operational observation channel:

- `GET/POST /api/muthur/observation` stores and exposes visible cockpit snapshots, retaining latest state per surface so concurrent views do not overwrite verification evidence.
- Property Manager publishes visible transcript, classification, ticket, unit, escalation, and continuity status.
- Cyberdeck publishes active tab/pane, visible document excerpt, visible conversation status, and operator continuity markers.
- Property Manager explicitly labels the capability `OBSERVE // READ ONLY`.

## Execution Boundary

New action: `observe_operator_pane`.

- It may run while execution mode remains `observe`.
- It does not click, type, edit, dispatch, browse, deploy, or change workflow state.
- Its action result includes `authority: READ_ONLY_OBSERVATION` and `read_only: true`.
- Retrieval is recorded in the existing MUTHUR tool-actions audit stream.
- Existing actions keep their prior confirmation and execution policy.

## Cursor Verification Work Order

1. Run `pnpm test:predeploy`.
2. Open `/property-manager`, run an emergency scenario, and verify `OBSERVE // READ ONLY` is visible.
3. Confirm `GET /api/muthur/observation` returns the currently visible route, transcript state, warning, ticket, and selected unit.
4. Enqueue `observe_operator_pane` in `observe` mode and verify it completes without approval while the mode remains `observe`.
5. Confirm a write or shell action has not gained the same exception.
6. Open `/cyberdeck`, change tabs or open a visible Operator document, and verify the observation snapshot changes only to visible context.
7. Confirm mobile layout tests still pass and no pane redesign was introduced.

## Required Evidence

- Predeploy output including `probe-muthur-observation: PASS`.
- Observation JSON from Property Manager and Cyberdeck.
- MUTHUR Execution pane action row for `observe_operator_pane`.
- `.muthur/logs/tool-actions.jsonl` entry showing read-only retrieval.
- Desktop and mobile screenshots showing no shell regression.

## Codex Execution Verification

- [x] `pnpm exec tsc --noEmit` passed after regenerating malformed `.next/dev/types` cache.
- [x] `pnpm probe:muthur-observation` passed, including the negative assertion that `write_file` remains blocked in `observe` mode.
- [x] `pnpm exec playwright test e2e/property-manager.spec.ts e2e/operator-folder-context-menu.spec.ts --reporter=line --workers=1` passed (`5/5`).
- [x] `pnpm test:predeploy` passed (`12/12` browser tests plus production build).

Build warnings remain outside E-14 scope: the existing `middleware` deprecation notice, ambiguous Tailwind easing class, and Google Photos dynamic dependency warning were non-blocking.

## Verdict Template

- [ ] `pnpm test:predeploy` passes
- [ ] Visible read-only authority label passes
- [ ] Property Manager snapshot accuracy passes
- [ ] Cyberdeck Operator snapshot accuracy passes
- [ ] Observe-mode retrieval completes without authority escalation
- [ ] Existing mutation/shell policy remains bounded
- [ ] Audit trace exists
- [ ] Mobile regression protections pass

**Overall verdict:** `PASS / FAIL`

**Findings:**

**Evidence paths:**
