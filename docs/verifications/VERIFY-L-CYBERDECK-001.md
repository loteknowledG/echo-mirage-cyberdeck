# VERIFY-L-CYBERDECK-001 — Verification Agent Protocol

**Audience:** Cursor agent (or human) assigned to **verify** implementation of [L-CYBERDECK-001](../work-orders/L-CYBERDECK-001-cyberdeck-app-extraction.md).  
**You are not the implementer.** Do not fix code unless the work order author explicitly asks for rework in the same turn.

---

## Your job

1. Read the phase-specific brief: `VERIFY-L-CYBERDECK-001-P<n>.md`
2. Run every command and file check listed there
3. Record evidence (command output, line counts, grep results)
4. Issue a verdict: **PASS**, **PARTIAL PASS**, or **FAIL**
5. Write or update the judicial receipt: `JP-L-CYBERDECK-001-P<n>.md`

If **FAIL** or **PARTIAL PASS**, file a rework note in the JP doc and stop — do not mark the work order phase closed.

---

## Verdict rules

| Verdict | When |
|---------|------|
| **PASS** | All required checks pass; no scope creep; ratchet thresholds respected |
| **PARTIAL PASS** | Required checks pass but optional checks failed (e.g. compile time not measured) or minor doc gaps |
| **FAIL** | Any required check fails, probe missing, behavior regression, or extraction broke L-10 invariants |

**P0 is probe-only** — no live UI required unless the phase brief says otherwise.

---

## Standard command stack (run when phase brief says so)

```powershell
cd f:\dev\echo-mirage-cyberdeck
pnpm exec tsc --noEmit
pnpm probe:cyberdeck-compile-scope
```

Phase-specific probes are listed in each `VERIFY-L-CYBERDECK-001-P*.md`.

---

## Output format (JP receipt)

Create or update `docs/verifications/JP-L-CYBERDECK-001-P<n>.md` with:

```markdown
# JP-L-CYBERDECK-001-P<n> — <Phase title>

## Verdict
**PASS** | **PARTIAL PASS** | **FAIL** — one-line reason

## Verifier
- Agent / human:
- Date:
- Git ref (optional): `git rev-parse --short HEAD`

## Commands run
(paste commands + exit codes)

## Checklist results
| ID | Check | Result | Evidence |
|----|-------|--------|----------|

## Metrics
(table from probe output)

## Rework required (if not PASS)
- bullet list

## Sign-off
- [ ] Safe to start next phase
```

---

## Phase index

| Phase | Verify brief | JP receipt | Implementer focus |
|-------|--------------|------------|-------------------|
| P0 | [VERIFY-P0](./VERIFY-L-CYBERDECK-001-P0.md) | [JP-P0](./JP-L-CYBERDECK-001-P0.md) | Baseline probe + ratchet |
| P1 | _(create when P1 starts)_ | _(create when P1 lands)_ | Pure module extraction |
| P2 | _(create when P2 starts)_ | _(create when P2 lands)_ | MUTHUR chat extraction |
| P3–P8 | per work order | per phase | see work order |

When a new phase starts, copy `VERIFY-L-CYBERDECK-001-P0.md` as a template and adjust deliverable IDs, probes, and ratchet ceilings from the work order.

---

## Invariants (every phase)

Do **not** allow regression on:

- `cyberdeck-page-client.tsx` must `dynamic()` import `cyberdeck-app` with `ssr: false`
- `pane-chunks.ts` must use `import()` per pane loader — no static pane bodies in `cyberdeck-app.tsx`
- MUTHUR channel separation ([L-UI-001](../work-orders/L-UI-001-response-visibility.md)) if P2+ touched chat
- Survey boundary ([survey-boundary.ts](../../src/lib/cyberdeck/survey-boundary.ts)) if P6+ touched

---

## What you must not do

- Approve a phase without running `pnpm probe:cyberdeck-compile-scope` (after P0 exists)
- Raise ratchet ceilings in the probe to make CI green (implementer must extract code instead)
- Treat “file exists” as “behavior correct” for P2+ without listed MUTHUR probes
- Merge implementer claims without pasting probe stdout

---

## Related

- Work order: [L-CYBERDECK-001](../work-orders/L-CYBERDECK-001-cyberdeck-app-extraction.md)
- Parent directive: [L-10](../cadre/tech-lead-legislator/L-10-cyberdeck-compile-refactor-directive.md)
- Cadre judicial prefixes: [cadre-constitutional-work-order-system.md](../cadre/cadre-constitutional-work-order-system.md)
