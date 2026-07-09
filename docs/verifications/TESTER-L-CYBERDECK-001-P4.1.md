# TESTER-L-CYBERDECK-001-P4.1 — Judicial Verifier Orders (paste into tester tab)

**Phase:** P4.1 — Layout shell + mobile layout hook (D4.1, D4.2)  
**Queue:** HEAD  
**Brief:** [VERIFY-L-CYBERDECK-001-P4.1](./VERIFY-L-CYBERDECK-001-P4.1.md)  
**Receipt:** [JP-L-CYBERDECK-001-P4.1](./JP-L-CYBERDECK-001-P4.1.md)

---

## Paste this into the tester agent

```text
L-CYBERDECK-001 P4.1 — Judicial verification (QUEUE HEAD)

Independent tester only. Do NOT implement.

PR: https://github.com/loteknowledG/echo-mirage-cyberdeck/pull/50
Brief: docs/verifications/VERIFY-L-CYBERDECK-001-P4.1.md
Receipt: docs/verifications/JP-L-CYBERDECK-001-P4.1.md
Baseline: 5,604 lines, 125 imports (P3.2 merged)

---
STEP 0 — Checkout PR branch

cd f:\dev\echo-mirage-cyberdeck
git fetch origin
git checkout cursor/extract-p4.1-layout-shell
git pull
gh pr view 50 --json number,url,headRefName,state,title

---
STEP 1 — Execute every check in VERIFY-L-CYBERDECK-001-P4.1.md

V-P4.1-01 Branch / PR / commit
V-P4.1-02 layout modules exist
V-P4.1-03 Resizable/matchMedia removed from app; hook + shell wired
V-P4.1-04 tsc + all probes
V-P4.1-05 Line reduction from 5,604
V-P4.1-06 Scope creep (git diff main...HEAD --stat)
V-P4.1-07 Manual smoke: resizer, gateway, chat, rail regression

Key spot-checks:
  Select-String -Path "src\features\cyberdeck\cyberdeck-app.tsx" -Pattern "ResizablePanel|matchMedia|mobileContentSplit"
  Expected: ZERO matches in app

---
STEP 2 — Write JP-L-CYBERDECK-001-P4.1.md + comment on PR #50

---
STEP 3 — Update CONDUCTOR (P4.1 PASS/FAIL; if PASS → P4.2 HEAD)

BOUNDARIES: MAY verify + write JP; MUST NOT merge, push, or refactor.

DELIVERABLE: Verdict, PR URL, line counts, FAIL checklist IDs if any.
```

---

## Quick PASS criteria

| ID | Gate |
|----|------|
| V-P4.1-01 | PR #50 on correct branch |
| V-P4.1-02 | layout hook + shell exist |
| V-P4.1-03 | No Resizable/matchMedia in app; `<CyberdeckLayoutShell />` wired |
| V-P4.1-04 | tsc + all probes green |
| V-P4.1-05 | Lines dropped from 5,604 |
| V-P4.1-06 | Scope-only diff (~5 files) |
| V-P4.1-07 | Layout resizer + gateway + MUTHUR smoke |
