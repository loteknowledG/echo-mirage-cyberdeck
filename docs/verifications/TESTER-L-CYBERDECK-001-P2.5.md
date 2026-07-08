# TESTER-L-CYBERDECK-001-P2.5 — Judicial Verifier Orders (paste into tester tab)

**Phase:** P2.5 — MUTHUR commander handlers + cognition bridge (**closes P2**)  
**Brief:** [VERIFY-L-CYBERDECK-001-P2.5](./VERIFY-L-CYBERDECK-001-P2.5.md)  
**Receipt:** [JP-L-CYBERDECK-001-P2.5](./JP-L-CYBERDECK-001-P2.5.md)

---

## Paste this into the tester agent

```text
L-CYBERDECK-001 P2.5 — Judicial verification (QUEUE HEAD — closes P2)

Independent tester only. Do NOT implement.

PR: https://github.com/loteknowledG/echo-mirage-cyberdeck/pull/47
Brief: docs/verifications/VERIFY-L-CYBERDECK-001-P2.5.md
Receipt: docs/verifications/JP-L-CYBERDECK-001-P2.5.md
Baseline: 6,766 lines, 142 imports (P2.4 merged)

---
STEP 0 — Checkout PR branch

cd f:\dev\echo-mirage-cyberdeck
git fetch origin
git checkout cursor/extract-p2.5-muthur-commander-handlers
git pull
gh pr view 47 --json number,url,headRefName,state,title

---
STEP 1 — Execute every check in VERIFY-L-CYBERDECK-001-P2.5.md

V-P2.5-01 Branch / PR / commit
V-P2.5-02 New modules (commander + cognition hooks)
V-P2.5-03 Handler bodies removed from app (zero inline handler bodies)
V-P2.5-04 Probes + tsc (all exit 0)
V-P2.5-05 Line reduction from 6,766
V-P2.5-06 Scope creep (git diff main...HEAD --stat)
V-P2.5-07 Manual smoke: posture, commander, mission, delegation, inhabitant, help/send/stop regression, cognition

Key spot-checks:
  - use-muthur-commander-handlers.ts + use-muthur-cognition-bridge.ts exist
  - app has no const handleMuthur* / const emitMuthurCognition bodies
  - app calls useMuthurCommanderHandlers; passes props to MuthurChatColumn
  - tsc + compile-scope + muthur probes green
  - lines dropped from 6,766 (probe ceiling lowered to actual)

---
STEP 2 — Write JP-L-CYBERDECK-001-P2.5.md + comment on PR #47

---
STEP 3 — Update CONDUCTOR (P2.5 PASS/FAIL; if PASS → P2 complete, P3.1 unblocked)

BOUNDARIES: MAY verify + write JP; MUST NOT merge, push, or refactor.

DELIVERABLE: Verdict, PR URL, line counts, FAIL checklist IDs if any.

Gate summary: PASS requires both hooks present, no inline commander handlers in the app, all probes green, meaningful line drop, scope-only diff, and commander UI smoke + P2 regression. Merge on PASS closes the P2 tranche and unblocks P3.1.
```
