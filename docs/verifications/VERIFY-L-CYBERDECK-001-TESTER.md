# VERIFY-L-CYBERDECK-001 — Tester / Judicial Agent Orders

**Authority:** Independent of implementer  
**Legislator:** [L-CYBERDECK-001](../work-orders/L-CYBERDECK-001-cyberdeck-app-extraction.md)  
**Conductor status:** [L-CYBERDECK-001-CONDUCTOR](../work-orders/L-CYBERDECK-001-CONDUCTOR.md)  

---

## Your role

You are the **tester / judicial agent**. You verify; you do not implement unless explicitly reassigned after a FAIL.

1. Read [VERIFY-L-CYBERDECK-001.md](./VERIFY-L-CYBERDECK-001.md) (protocol)
2. Read the **phase brief** for the slice under review
3. Run every command; paste evidence
4. Write verdict to the matching **JP-** receipt
5. Update conductor status (or tell the human to ping the tech-lead agent)

---

## Verdict vocabulary

| Verdict | Meaning |
|---------|---------|
| **PASS** | All required checks green — next phase may start |
| **PARTIAL PASS** | Required green; optional gaps documented — conductor decides |
| **FAIL** | Block next phase; implementer reworks |

---

## Phase briefs

| Phase | Execute this brief | Write receipt |
|-------|-------------------|---------------|
| **P0** | [VERIFY-L-CYBERDECK-001-P0.md](./VERIFY-L-CYBERDECK-001-P0.md) | [JP-L-CYBERDECK-001-P0.md](./JP-L-CYBERDECK-001-P0.md) |
| **P1.1** | [VERIFY-L-CYBERDECK-001-P1.1.md](./VERIFY-L-CYBERDECK-001-P1.1.md) | [JP-L-CYBERDECK-001-P1.1.md](./JP-L-CYBERDECK-001-P1.1.md) |
| **P2.1** | [VERIFY-L-CYBERDECK-001-P2.1.md](./VERIFY-L-CYBERDECK-001-P2.1.md) | [JP-L-CYBERDECK-001-P2.1.md](./JP-L-CYBERDECK-001-P2.1.md) |
| **P2.2** | [VERIFY-L-CYBERDECK-001-P2.2.md](./VERIFY-L-CYBERDECK-001-P2.2.md) | [JP-L-CYBERDECK-001-P2.2.md](./JP-L-CYBERDECK-001-P2.2.md) |
| **P2.3** | [VERIFY-L-CYBERDECK-001-P2.3.md](./VERIFY-L-CYBERDECK-001-P2.3.md) · [TESTER paste](./TESTER-L-CYBERDECK-001-P2.3.md) | [JP-L-CYBERDECK-001-P2.3.md](./JP-L-CYBERDECK-001-P2.3.md) |
| P2.4+ | Per [L-CYBERDECK-001](../work-orders/L-CYBERDECK-001-cyberdeck-app-extraction.md) | JP-P2.x |

---

## Standard command stack

```powershell
cd f:\dev\echo-mirage-cyberdeck
pnpm exec tsc --noEmit
pnpm probe:cyberdeck-compile-scope
```

**UI phases (P1+):** add `pnpm probe:cyberdeck-extraction-smoke` (fast, no LLM). Full indicate/surface path: `pnpm e2e:smoke`.

Add phase probes from the brief (e.g. P2 adds `pnpm probe:muthur-command-console`).

---

## Strict boundaries

### You MAY

- Run probes and read files
- `git diff` / `git log` to confirm scope
- Reject PRs that only raise ratchet ceilings
- Mark FAIL if `cyberdeck-app.tsx` gains static pane imports

### You MUST NOT

- “Quick fix” extraction failures during verification
- Approve without running `probe:cyberdeck-compile-scope`
- Skip JP receipt update
- Start the next phase yourself

---

## P0 prompt (copy-paste for Cursor tester agent)

```text
You are the judicial verifier for L-CYBERDECK-001 phase P0.

Follow exactly:
  docs/verifications/VERIFY-L-CYBERDECK-001.md
  docs/verifications/VERIFY-L-CYBERDECK-001-P0.md

Run all required checks. Update:
  docs/verifications/JP-L-CYBERDECK-001-P0.md

with verdict PASS | PARTIAL PASS | FAIL, checklist table, and probe stdout.

Then update conductor:
  docs/work-orders/L-CYBERDECK-001-CONDUCTOR.md

Set P0 judicial status and whether P1 is unblocked.
Do not write application code.
```

---

## P1.1 prompt (when developer finishes first extraction PR)

```text
Verify L-CYBERDECK-001 phase P1.1 (custom tab model extraction).

1. Read docs/cadre/executive-coder/E-CYBERDECK-001-extraction-execution.md § P1.1
2. Confirm new file exists: src/features/cyberdeck/workspace/custom-tab-model.ts
3. Confirm cyberdeck-app.tsx imports from it; behavior unchanged
4. Run: tsc --noEmit, probe:cyberdeck-compile-scope
5. Confirm ratchet lowered (lines/imports) OR FAIL if ceilings were only bumped
6. Write docs/verifications/JP-L-CYBERDECK-001-P1.1.md
7. Update L-CYBERDECK-001-CONDUCTOR.md

No implementation unless FAIL rework assigned.
```

---

## Failure escalation

| Situation | Action |
|-----------|--------|
| FAIL on ratchet / scope | JR note in JP; implementer reworks |
| FAIL on tsc | FAIL — block merge |
| PARTIAL (compile time not measured) | Conductor may allow P1 in dev-only track |
| Constitutional conflict with L-UI-001 | Escalate to human + tech lead |

---

## Related

- Developer orders: [E-CYBERDECK-001-extraction-execution.md](../cadre/executive-coder/E-CYBERDECK-001-extraction-execution.md)
- Cadre judicial prefixes: [cadre-constitutional-work-order-system.md](../cadre/cadre-constitutional-work-order-system.md)
