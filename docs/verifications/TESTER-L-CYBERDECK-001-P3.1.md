# TESTER-L-CYBERDECK-001-P3.1 — Judicial Verifier Orders (paste into tester tab)

**Phase:** P3.1 — Provider connection hook (D3.1)  
**Queue:** HEAD  
**Brief:** [VERIFY-L-CYBERDECK-001-P3.1](./VERIFY-L-CYBERDECK-001-P3.1.md)  
**Receipt:** [JP-L-CYBERDECK-001-P3.1](./JP-L-CYBERDECK-001-P3.1.md)

---

## Paste this into the tester agent

```text
L-CYBERDECK-001 P3.1 — Judicial verification (QUEUE HEAD)

Independent tester only. Do NOT implement.

PR: https://github.com/loteknowledG/echo-mirage-cyberdeck/pull/48
Brief: docs/verifications/VERIFY-L-CYBERDECK-001-P3.1.md
Receipt: docs/verifications/JP-L-CYBERDECK-001-P3.1.md
Baseline: 6,445 lines, 126 imports (P2.5 merged)

---
STEP 0 — Checkout PR branch

cd f:\dev\echo-mirage-cyberdeck
git fetch origin
git checkout cursor/extract-p3.1-provider-connection
git pull
gh pr view 48 --json number,url,headRefName,state,title

---
STEP 1 — Execute every check in VERIFY-L-CYBERDECK-001-P3.1.md

V-P3.1-01 Branch / PR / commit
V-P3.1-02 use-provider-connection.ts exists (+ exports)
V-P3.1-03 Connection logic removed from app; gateway JSX still inline
V-P3.1-04 tsc + all 5 probes (incl. probe:provider-credentials)
V-P3.1-05 Line reduction from 6,445
V-P3.1-06 Scope creep (git diff main...HEAD --stat)
V-P3.1-07 Manual smoke: provider select, key connect, models, send + P2 regression

Key spot-checks:
  Select-String -Path "src\features\cyberdeck\cyberdeck-app.tsx" -Pattern "const fetchModelsForProvider|const probeSelectedModel|const handleProviderClick|const submitGatewayKey ="
  Expected: ZERO matches

  Select-String -Path "src\features\cyberdeck\cyberdeck-app.tsx" -Pattern "useProviderConnection"
  Expected: app calls hook

  CyberdeckGatewaySettingsPane JSX must still be in cyberdeck-app.tsx (not extracted)

---
STEP 2 — Write JP-L-CYBERDECK-001-P3.1.md + comment on PR #48

---
STEP 3 — Update CONDUCTOR (P3.1 PASS/FAIL; if PASS → P3.2 HEAD)

BOUNDARIES: MAY verify + write JP; MUST NOT merge, push, or refactor.

DELIVERABLE: Verdict, PR URL, line counts, FAIL checklist IDs if any.

Gate summary: PASS requires hook present, no inline provider connection bodies in app, gateway JSX still inline, all probes green, meaningful line drop, scope-only diff, gateway connect + MUTHUR send smoke.
```

---

## Quick PASS criteria

| ID | Gate |
|----|------|
| V-P3.1-01 | PR #48 on correct branch |
| V-P3.1-02 | `use-provider-connection.ts` exists |
| V-P3.1-03 | No inline fetch/probe/click handlers in app; gateway JSX inline |
| V-P3.1-04 | tsc + compile-scope + muthur probes + provider-credentials green |
| V-P3.1-05 | Lines dropped from 6,445 |
| V-P3.1-06 | Scope-only diff (~4 files) |
| V-P3.1-07 | Gateway connect + MUTHUR send regression smoke |
