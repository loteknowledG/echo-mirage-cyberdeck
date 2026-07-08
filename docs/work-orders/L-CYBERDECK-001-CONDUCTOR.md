# L-CYBERDECK-001 — Conductor Status Board

**Tech lead / conductor:** Primary Cursor agent (Legislator hat)  
**Legislator WO:** [L-CYBERDECK-001-cyberdeck-app-extraction.md](./L-CYBERDECK-001-cyberdeck-app-extraction.md)  
**Developer thread:** [E-CYBERDECK-001-extraction-execution.md](../cadre/executive-coder/E-CYBERDECK-001-extraction-execution.md)  
**Tester orders:** [VERIFY-L-CYBERDECK-001-TESTER.md](../verifications/VERIFY-L-CYBERDECK-001-TESTER.md)  

---

## How we run this in Cursor

```text
┌─────────────────┐     assigns      ┌──────────────────┐
│  Tech lead      │ ───────────────► │  Developer agent │
│  (conductor)    │                  │  E-CYBERDECK-001 │
└────────┬────────┘                  └────────┬─────────┘
         │                                   │ PR / slice done
         │ assigns                           ▼
         │                          ┌──────────────────┐
         └────────────────────────► │  Tester agent    │
                                    │  VERIFY-P* → JP  │
                                    └────────┬─────────┘
                                             │ PASS/FAIL
                                             ▼
                                    Conductor updates this file
                                    → next phase or rework
```

**Human operator:** Start a **new Cursor chat** for developer vs tester to keep roles clean. Paste the prompt blocks from VERIFY-TESTER or E-CYBERDECK-001.

---

## Phase status

| Phase | Implementer | Judicial | Conductor gate | Notes |
|-------|-------------|----------|----------------|-------|
| **P0** | Done | **PENDING** | Block P1 until JP-P0 PASS | Probe + receipts landed |
| P1.1 | **NEXT** | — | After P0 PASS | Custom tab model extract |
| P1.2 | Queued | — | After P1.1 PASS | Gateway + rail helpers |
| P1.3 | Queued | — | After P1.2 PASS | Operator drop utils |
| P2 | Blocked | — | After P1 complete | MUTHUR chat — critical path |
| P3–P8 | Blocked | — | Per work order | |

---

## Metrics ratchet (live)

| Metric | At P0 land | Ceiling (probe) | After P1 target |
|--------|----------:|----------------:|----------------:|
| `cyberdeck-app.tsx` lines | 9,089 | 9,100 | ≤ 7,600 |
| Import lines | 151 | 155 | ≤ 95 |

Source: `scripts/probe-cyberdeck-compile-scope.ts`  
Last probe: 2026-06-17 — PASS

---

## Current action items

| # | Owner | Action |
|---|-------|--------|
| 1 | **Tester agent** | Run [VERIFY-P0](../verifications/VERIFY-L-CYBERDECK-001-P0.md) → sign [JP-P0](../verifications/JP-L-CYBERDECK-001-P0.md) |
| 2 | **Conductor** | On JP-P0 PASS → set P1.1 as active in E-CYBERDECK-001 |
| 3 | **Developer agent** | Execute P1.1 only after #1 PASS |
| 4 | **Human** | Optional: capture cold `HEAD /cyberdeck` compile for L-10 baseline |

---

## Conductor decisions log

| Date | Decision |
|------|----------|
| 2026-06-17 | L-CYBERDECK-001 legislated; P0 implemented; judicial verify pending |
| 2026-06-17 | Three-agent split: E- dev, VERIFY tester, conductor status board |

---

## Prompt for tech lead (this agent, next turn)

When human says “conduct” or “what’s next”:

1. Read this file + latest `JP-L-CYBERDECK-001-P*.md`
2. Update phase table
3. Point human to the correct agent prompt (dev vs tester)
4. Do not implement P1 while P0 judicial status is PENDING unless human overrides

---

## Prompt for human — spawn tester now

```text
Verify L-CYBERDECK-001 P0. Read docs/verifications/VERIFY-L-CYBERDECK-001-TESTER.md and VERIFY-L-CYBERDECK-001-P0.md. Update JP-L-CYBERDECK-001-P0.md and L-CYBERDECK-001-CONDUCTOR.md. No code changes.
```

## Prompt for human — spawn developer after P0 PASS

```text
Implement L-CYBERDECK-001 P1.1 per docs/cadre/executive-coder/E-CYBERDECK-001-extraction-execution.md. Run tsc and probe:cyberdeck-compile-scope. Stop for verification.
```
