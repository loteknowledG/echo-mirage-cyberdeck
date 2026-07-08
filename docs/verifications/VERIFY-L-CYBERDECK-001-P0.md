# VERIFY-L-CYBERDECK-001-P0 — Phase P0 Verification Brief

**Work order:** [L-CYBERDECK-001](../work-orders/L-CYBERDECK-001-cyberdeck-app-extraction.md)  
**Phase:** P0 — Baseline & guardrails  
**Protocol:** [VERIFY-L-CYBERDECK-001](./VERIFY-L-CYBERDECK-001.md)  
**Output receipt:** [JP-L-CYBERDECK-001-P0](./JP-L-CYBERDECK-001-P0.md)

---

## Scope under test

P0 adds **measurement and guardrails only**. It must **not** change runtime behavior of `/cyberdeck`.

| Deliverable ID | Expected artifact |
|----------------|-------------------|
| D0.1 | `scripts/probe-cyberdeck-compile-scope.ts` |
| D0.2 | `package.json` script `probe:cyberdeck-compile-scope` |
| D0.3 | `docs/verifications/JP-L-CYBERDECK-001-P0.md` (baseline receipt) |

---

## Required checks (all must PASS)

### V-P0-01 — Repository root

```powershell
cd f:\dev\echo-mirage-cyberdeck
```

Confirm `package.json` exists and name is `echo-mirage-cyberdeck`.

---

### V-P0-02 — Probe script exists and is non-empty

| Path | Assert |
|------|--------|
| `scripts/probe-cyberdeck-compile-scope.ts` | File exists; contains `MAX_CYBERDECK_APP_LINES` and `FORBIDDEN_STATIC_IMPORTS` |

---

### V-P0-03 — npm script wired

```powershell
pnpm run | Select-String "probe:cyberdeck-compile-scope"
```

Or read `package.json` and confirm:

```json
"probe:cyberdeck-compile-scope": "tsx scripts/probe-cyberdeck-compile-scope.ts"
```

---

### V-P0-04 — Probe executes successfully

```powershell
pnpm probe:cyberdeck-compile-scope
```

**Required stdout (substring match):**

```text
probe-cyberdeck-compile-scope: all checks passed
```

**Required exit code:** `0`

**Capture and record** the metrics lines, e.g.:

```text
src/features/cyberdeck/cyberdeck-app.tsx: <N> lines, <M> imports
ceilings: <MAX_LINES> lines, <MAX_IMPORTS> imports
dynamic() declarations in app: <D>
```

---

### V-P0-05 — TypeScript still compiles

```powershell
pnpm exec tsc --noEmit
```

**Exit code:** `0`

---

### V-P0-06 — Ratchet ceilings are documented in probe

Read `scripts/probe-cyberdeck-compile-scope.ts` and record:

| Constant | Expected role |
|----------|----------------|
| `MAX_CYBERDECK_APP_LINES` | P0 ceiling (must be ≥ current line count, ≤ 9_500) |
| `MAX_CYBERDECK_APP_IMPORTS` | P0 ceiling (must be ≥ current import count) |

**FAIL if** ceilings were raised without corresponding extraction work in the same PR (judge compares git diff).

---

### V-P0-07 — Page client dynamic boundary

Read `src/app/cyberdeck/cyberdeck-page-client.tsx`:

| Assert | Pattern |
|--------|---------|
| Dynamic import | `dynamic(() => import("@/features/cyberdeck/cyberdeck-app")` |
| SSR off | `ssr: false` |
| Error boundary | `CyberdeckErrorBoundary` wraps `<CyberdeckApp />` |

---

### V-P0-08 — Pane chunk lazy loading intact

Read `src/features/cyberdeck/pane-chunks.ts`:

| Assert | Pattern |
|--------|---------|
| Dynamic loaders | `() => import(` and `pane-loaders` |
| Survey pane | `survey: () => import(` present |

---

### V-P0-09 — No forbidden static imports in monolith

The probe enforces this; verifier **also** spot-check with:

```powershell
Select-String -Path "src\features\cyberdeck\cyberdeck-app.tsx" -Pattern "operator-pane-body|glyph-channel-pane-body|pane-loaders/" 
```

**Expected:** no matches on `^import` lines (probe is authoritative; grep is backup).

---

### V-P0-10 — Baseline receipt exists

| Path | Assert |
|------|--------|
| `docs/verifications/JP-L-CYBERDECK-001-P0.md` | Exists; lists baseline metrics and ratchet schedule |

---

### V-P0-11 — Work order P0 deliverables marked

Read `docs/work-orders/L-CYBERDECK-001-cyberdeck-app-extraction.md` § P0 table:

- D0.1, D0.2, D0.3 should be **Done** (or note discrepancy in JP)

---

## Optional checks (PARTIAL PASS if skipped)

### V-P0-OPT-01 — Cold compile time

With dev server running, note `HEAD /cyberdeck` compile time from Next logs (L-10 reference ~2.8 min).

Not required to PASS P0 — record in JP as “deferred” if not measured.

---

### V-P0-OPT-02 — No unrelated file churn

```powershell
git diff --stat
```

Flag if P0 PR changes `cyberdeck-app.tsx` logic beyond imports/comments, or touches unrelated subsystems.

---

## Failure triage

| Symptom | Likely cause | Verdict |
|---------|--------------|---------|
| Probe exit 1, line count | Ceiling too low vs reality | FAIL implementer; do not raise ceiling without extraction |
| Probe exit 1, forbidden import | Static pane import in app | FAIL |
| Missing npm script | D0.2 incomplete | FAIL |
| tsc errors | Accidental breakage | FAIL |
| All required pass, no compile time | — | PARTIAL PASS acceptable for P0 |

---

## Verdict template (copy to JP)

```markdown
## Verdict
**PASS** — P0 guardrails present; probe and tsc green.

## Checklist
| ID | Result | Notes |
|----|--------|-------|
| V-P0-01 | PASS | |
| V-P0-02 | PASS | |
| ... | | |

## Evidence
(paste probe stdout)

## Sign-off
- [x] P1 may begin (pure module extraction)
```

---

## After you finish

1. Update [JP-L-CYBERDECK-001-P0.md](./JP-L-CYBERDECK-001-P0.md) with verdict + evidence
2. Tell the operator: PASS / PARTIAL / FAIL and whether P1 is unblocked
3. Do **not** start P1 implementation — verification only
