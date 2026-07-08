# JP-L-CYBERDECK-001-P0 — Compile Scope Baseline (Judicial Receipt)

**Work order:** [L-CYBERDECK-001](../work-orders/L-CYBERDECK-001-cyberdeck-app-extraction.md)  
**Phase:** P0 — Baseline & guardrails  
**Verify brief:** [VERIFY-L-CYBERDECK-001-P0](./VERIFY-L-CYBERDECK-001-P0.md)  
**Status:** Judicially verified (PASS)  

---

## Verdict

**PASS** — P0 guardrails present; probe and tsc green.

Verified at `4b7d140` (HEAD includes P1.1 custom-tab-model extraction landed after P0; probe ceilings were tightened with that extraction, not raised without work).

---

## Verifier metadata (fill on review)

| Field | Value |
|-------|-------|
| Verifier | Cursor agent (independent verification) |
| Date | 2026-07-07 |
| Git ref | `4b7d140` |
| PR / branch | local `main` lineage (P0 in `4e08088`, P1.1 atop) |

---

## Commands (verifier must run)

```powershell
cd f:\dev\echo-mirage-cyberdeck
pnpm exec tsc --noEmit
pnpm probe:cyberdeck-compile-scope
```

### Implementer-recorded results (re-verify independently)

| Command | Exit code | Result |
|---------|-----------|--------|
| `tsc --noEmit` | 0 | PASS |
| `probe:cyberdeck-compile-scope` | 0 | PASS |

### Verifier probe stdout (2026-07-07)

```text
probe-cyberdeck-compile-scope: all checks passed
  src/features/cyberdeck/cyberdeck-app.tsx: 8784 lines, 152 imports
  ceilings: 8800 lines, 152 imports
  dynamic() declarations in app: 4
```

### Implementer probe stdout (2026-06-17, superseded)

```text
probe-cyberdeck-compile-scope: all checks passed
  src/features/cyberdeck/cyberdeck-app.tsx: 9089 lines, 151 imports
  ceilings: 9100 lines, 155 imports
  dynamic() declarations in app: 4
```

Ceilings and line count differ from implementer record because P1.1 (`4b7d140`) extracted `custom-tab-model` and tightened probe ceilings with that work.

---

## Checklist (verifier copies from VERIFY-P0)

| ID | Check | Result | Evidence |
|----|-------|--------|----------|
| V-P0-01 | Repo root | PASS | `package.json` name `echo-mirage-cyberdeck` |
| V-P0-02 | Probe script exists | PASS | `MAX_CYBERDECK_APP_LINES`, `FORBIDDEN_STATIC_IMPORTS` present |
| V-P0-03 | npm script wired | PASS | `probe:cyberdeck-compile-scope` → `tsx scripts/...` |
| V-P0-04 | Probe passes | PASS | exit 0; stdout substring match |
| V-P0-05 | tsc passes | PASS | exit 0 |
| V-P0-06 | Ratchet constants sane | PASS | 8800/152 ceilings ≥ current 8784/152; ≤ 9500; lowered with P1.1 extraction |
| V-P0-07 | Page client dynamic + ssr:false | PASS | `dynamic(() => import("@/features/cyberdeck/cyberdeck-app")`, `ssr: false`, `CyberdeckErrorBoundary` |
| V-P0-08 | pane-chunks lazy loaders | PASS | `() => import(` + `pane-loaders`; `survey: () => import(` |
| V-P0-09 | No forbidden static imports | PASS | probe + spot-check grep: no `^import` matches |
| V-P0-10 | This JP receipt exists | PASS | this file |
| V-P0-11 | Work order D0.1–D0.3 Done | PASS | work order § P0 table |
| V-P0-OPT-01 | Cold compile time | deferred | not measured |
| V-P0-OPT-02 | No unrelated file churn | PASS | P0 commit `4e08088` did not touch `cyberdeck-app.tsx`; clean working tree |

---

## Baseline metrics (at P0 landing)

| Metric | Value (verifier @ `4b7d140`) | P0 ceiling (probe) |
|--------|------:|-------------------:|
| `cyberdeck-app.tsx` lines | 8,784 | 8,800 |
| Top-level `import` lines | 152 | 152 |
| `dynamic()` declarations in app | 4 | ≥ 3 |

Implementer P0 landing (pre-P1.1): 9,089 lines / 9,100 ceiling, 151 imports / 155 ceiling.

---

## Structural invariants (probe-enforced)

- `cyberdeck-page-client.tsx` dynamic-imports `cyberdeck-app` with `ssr: false`
- `pane-chunks.ts` uses per-pane `import()` loaders
- `cyberdeck-app.tsx` loads `pane-chunks` via dynamic import (not static)
- No static imports of heavy pane bodies / Monaco / xterm in `cyberdeck-app.tsx`

---

## Ratchet schedule (lower ceilings after extraction PRs)

| Phase | Target lines | Target imports |
|-------|-------------:|---------------:|
| P0 (verified) | ≤ 8,800 | ≤ 152 |
| P1 | ≤ 7,600 | ≤ 95 |
| P2 | ≤ 4,800 | ≤ 60 |
| P4 | ≤ 2,500 | ≤ 35 |
| Close | ≤ 1,200 | ≤ 35 |

Constants live in `scripts/probe-cyberdeck-compile-scope.ts` — verifier must reject PRs that only bump ceilings.

---

## Compile time (optional)

| Date | `HEAD /cyberdeck` compile | Notes |
|------|---------------------------|-------|
| 2026-06-17 | _(not measured)_ | Defer to P1 or next dev session |

---

## Rework required

_Verifier fills if FAIL or PARTIAL PASS._

- _(none yet)_

---

## Sign-off

- [x] Independent verifier ran VERIFY-L-CYBERDECK-001-P0
- [x] Verdict recorded above
- [x] **P1 unblocked** — PASS; P1.1 already landed on HEAD

---

## Deliverable traceability

| ID | Deliverable | Path | Implementer |
|----|-------------|------|-------------|
| D0.1 | Compile-scope probe | `scripts/probe-cyberdeck-compile-scope.ts` | Done |
| D0.2 | npm script | `package.json` → `probe:cyberdeck-compile-scope` | Done |
| D0.3 | Baseline receipt | this file | Done (pending judicial sign-off) |
