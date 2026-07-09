# TESTER-L-CYBERDECK-001-P3.2 — Judicial Verifier Orders (paste into tester tab)

**Phase:** P3.2 — Gateway column host (D3.2, D3.3)  
**Queue:** HEAD  
**Brief:** [VERIFY-L-CYBERDECK-001-P3.2](./VERIFY-L-CYBERDECK-001-P3.2.md)  
**Receipt:** [JP-L-CYBERDECK-001-P3.2](./JP-L-CYBERDECK-001-P3.2.md)

---

## Paste this into the tester agent

```text
L-CYBERDECK-001 P3.2 — Judicial verification (QUEUE HEAD)

Independent tester only. Do NOT implement.

PR: https://github.com/loteknowledG/echo-mirage-cyberdeck/pull/49
Brief: docs/verifications/VERIFY-L-CYBERDECK-001-P3.2.md
Receipt: docs/verifications/JP-L-CYBERDECK-001-P3.2.md
Baseline: 5,878 lines, 125 imports (P3.1 merged)

---
STEP 0 — Checkout PR branch

cd f:\dev\echo-mirage-cyberdeck
git fetch origin
git checkout cursor/extract-p3.2-gateway-column
git pull
gh pr view 49 --json number,url,headRefName,state,title

---
STEP 1 — Execute every check in VERIFY-L-CYBERDECK-001-P3.2.md

V-P3.2-01 Branch / PR / commit
V-P3.2-02 gateway modules exist
V-P3.2-03 Gateway UI removed from app; GatewayColumn + useGatewayPaneState wired; useProviderConnection unchanged
V-P3.2-04 tsc + all probes
V-P3.2-05 Line reduction from 5,878
V-P3.2-06 Scope creep (git diff main...HEAD --stat)
V-P3.2-07 Manual smoke: gateway UI, provider select, models, keyboard, MUTHUR + P2 regression

Key spot-checks:
  Select-String -Path "src\features\cyberdeck\cyberdeck-app.tsx" -Pattern "CyberdeckGatewaySettingsPane|const focusGatewayConnectionPanel"
  Expected: ZERO matches in app

  Select-String -Path "src\features\cyberdeck\cyberdeck-app.tsx" -Pattern "GatewayColumn|useGatewayPaneState"
  Expected: app delegates to extracted modules

---
STEP 2 — Write JP-L-CYBERDECK-001-P3.2.md + comment on PR #49

---
STEP 3 — Update CONDUCTOR (P3.2 PASS/FAIL; if PASS → P4.1 HEAD)

BOUNDARIES: MAY verify + write JP; MUST NOT merge, push, or refactor.

DELIVERABLE: Verdict, PR URL, line counts, FAIL checklist IDs if any.

Gate summary: PASS requires gateway modules present, no inline gateway JSX in app, useProviderConnection untouched, all probes green, meaningful line drop, scope-only diff, gateway + MUTHUR smoke.
```

---

## Quick PASS criteria

| ID | Gate |
|----|------|
| V-P3.2-01 | PR #49 on correct branch |
| V-P3.2-02 | `provider-pane-state.ts`, `use-gateway-pane-state.ts`, `gateway-column.tsx` exist |
| V-P3.2-03 | No gateway JSX/focus in app; `<GatewayColumn />` + hook wired |
| V-P3.2-04 | tsc + compile-scope + muthur probes + provider-credentials green |
| V-P3.2-05 | Lines dropped from 5,878 |
| V-P3.2-06 | Scope-only diff (~6 files) |
| V-P3.2-07 | Gateway UI + provider select + keyboard + MUTHUR regression smoke |
