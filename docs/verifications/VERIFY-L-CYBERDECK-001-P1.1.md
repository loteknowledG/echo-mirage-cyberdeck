# VERIFY-L-CYBERDECK-001-P1.1 — Phase P1.1 Verification Brief

**Work order:** [L-CYBERDECK-001](../work-orders/L-CYBERDECK-001-cyberdeck-app-extraction.md)  
**Phase:** P1.1 — Custom tab model extraction  
**Branch:** `cursor/extract-custom-tab-model-p1.1`  
**Commit:** `4b7d140` — `refactor(cyberdeck): extract custom tab model from cyberdeck-app (L-CYBERDECK-001 P1.1)`  
**Protocol:** [VERIFY-L-CYBERDECK-001](./VERIFY-L-CYBERDECK-001.md)  
**Output receipt:** [JP-L-CYBERDECK-001-P1.1](./JP-L-CYBERDECK-001-P1.1.md)  

**Prerequisite:** [JP-P0 PASS](./JP-L-CYBERDECK-001-P0.md)

---

## Scope under test

Move custom-tab **pure functions and types** to `custom-tab-model.ts` with **no behavior change**.

| Deliverable | Path |
|-------------|------|
| New module | `src/features/cyberdeck/workspace/custom-tab-model.ts` |
| App imports module | `src/features/cyberdeck/cyberdeck-app.tsx` |

---

## Required checks

### V-P1.1-01 — Branch / commit

```powershell
cd f:\dev\echo-mirage-cyberdeck
git branch --show-current
git log -1 --oneline
```

Expect branch `cursor/extract-custom-tab-model-p1.1` and commit message containing `P1.1`.

---

### V-P1.1-02 — New file exists and exports used symbols

Read `src/features/cyberdeck/workspace/custom-tab-model.ts` — must export at least:

- `sanitizeCustomTabs`
- `parseCustomTabCommand`
- `normalizeCustomTabGlyph` / `normalizeCustomTabKind`
- `CUSTOM_TAB_CONTEXT_MENU_ACTIONS`
- `CustomTab` (type)

---

### V-P1.1-03 — App delegates to module

`cyberdeck-app.tsx` must **import** from `@/features/cyberdeck/workspace/custom-tab-model` and must **not** retain duplicate definitions of moved helpers.

Spot-check:

```powershell
Select-String -Path "src\features\cyberdeck\cyberdeck-app.tsx" -Pattern "function sanitizeCustomTabs|function parseCustomTabCommand"
```

**Expected:** no matches (definitions live in module only).

---

### V-P1.1-04 — Probe passes with **lowered** ratchet

```powershell
pnpm probe:cyberdeck-compile-scope
pnpm exec tsc --noEmit
```

**Expected probe stdout (approximate):**

```text
cyberdeck-app.tsx: ~8784 lines, ~152 imports
ceilings: 8800 lines, 152 imports
```

**FAIL if** ceilings were raised without line reduction (compare to P0: 9100/155).

---

### V-P1.1-05 — Line reduction achieved

| Metric | P0 baseline | P1.1 expected |
|--------|------------:|--------------:|
| `cyberdeck-app.tsx` lines | 9,089 | ≤ 8,800 (actual ~8,784) |
| Net lines removed from app | — | ~300+ |

---

### V-P1.1-06 — No behavior-scope creep

```powershell
git diff main...HEAD --stat
```

**Expected files (only):**

- `src/features/cyberdeck/workspace/custom-tab-model.ts` (new)
- `src/features/cyberdeck/cyberdeck-app.tsx` (imports + deletions)
- `scripts/probe-cyberdeck-compile-scope.ts` (ratchet tighten only)

**FAIL if** unrelated subsystems changed.

---

### V-P1.1-07 — Structural invariants still hold

Same as P0: dynamic page client, pane-chunks lazy, no forbidden static pane imports — covered by probe.

---

## Optional

- Manual: open `/cyberdeck`, create/rename custom tab, run a tab command from chat — should behave as before.

---

## Verdict template

Write to `JP-L-CYBERDECK-001-P1.1.md` and update [CONDUCTOR](../work-orders/L-CYBERDECK-001-CONDUCTOR.md).

---

## Tester prompt (copy-paste)

```text
Verify L-CYBERDECK-001 P1.1 on branch cursor/extract-custom-tab-model-p1.1.

Execute docs/verifications/VERIFY-L-CYBERDECK-001-P1.1.md
Write docs/verifications/JP-L-CYBERDECK-001-P1.1.md
Update docs/work-orders/L-CYBERDECK-001-CONDUCTOR.md
No code changes unless FAIL rework assigned.
```
