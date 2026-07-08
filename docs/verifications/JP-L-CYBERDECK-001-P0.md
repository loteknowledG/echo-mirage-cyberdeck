# JP-L-CYBERDECK-001-P0 — Compile Scope Baseline (Judicial Receipt)

**Work order:** [L-CYBERDECK-001](../work-orders/L-CYBERDECK-001-cyberdeck-app-extraction.md)  
**Phase:** P0 — Baseline & guardrails  
**Verify brief:** [VERIFY-L-CYBERDECK-001-P0](./VERIFY-L-CYBERDECK-001-P0.md)  
**Status:** Awaiting independent verification  

---

## Verdict

> **Verifier:** Replace this block after running VERIFY-L-CYBERDECK-001-P0.  
> Options: **PASS** | **PARTIAL PASS** | **FAIL**

**IMPLEMENTER RECORDED — NOT YET JUDICIALLY VERIFIED**

Implementation claims P0 complete. A separate agent must execute the verify brief and update this section.

---

## Verifier metadata (fill on review)

| Field | Value |
|-------|-------|
| Verifier | _agent or human name_ |
| Date | _YYYY-MM-DD_ |
| Git ref | _`git rev-parse --short HEAD`_ |
| PR / branch | _optional_ |

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
| `tsc --noEmit` | _verifier fills_ | _PASS/FAIL_ |
| `probe:cyberdeck-compile-scope` | _verifier fills_ | _PASS/FAIL_ |

### Implementer probe stdout (2026-06-17)

```text
probe-cyberdeck-compile-scope: all checks passed
  src/features/cyberdeck/cyberdeck-app.tsx: 9089 lines, 151 imports
  ceilings: 9100 lines, 155 imports
  dynamic() declarations in app: 4
```

---

## Checklist (verifier copies from VERIFY-P0)

| ID | Check | Result | Evidence |
|----|-------|--------|----------|
| V-P0-01 | Repo root | _pending_ | |
| V-P0-02 | Probe script exists | _pending_ | |
| V-P0-03 | npm script wired | _pending_ | |
| V-P0-04 | Probe passes | _pending_ | |
| V-P0-05 | tsc passes | _pending_ | |
| V-P0-06 | Ratchet constants sane | _pending_ | |
| V-P0-07 | Page client dynamic + ssr:false | _pending_ | |
| V-P0-08 | pane-chunks lazy loaders | _pending_ | |
| V-P0-09 | No forbidden static imports | _pending_ | |
| V-P0-10 | This JP receipt exists | _pending_ | |
| V-P0-11 | Work order D0.1–D0.3 Done | _pending_ | |
| V-P0-OPT-01 | Cold compile time | _optional_ | |

---

## Baseline metrics (at P0 landing)

| Metric | Value | P0 ceiling (probe) |
|--------|------:|-------------------:|
| `cyberdeck-app.tsx` lines | 9,089 | 9,100 |
| Top-level `import` lines | 151 | 155 |
| `dynamic()` declarations in app | 4 | ≥ 3 |

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
| P0 (now) | ≤ 9,100 | ≤ 155 |
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

- [ ] Independent verifier ran VERIFY-L-CYBERDECK-001-P0
- [ ] Verdict recorded above
- [ ] **P1 unblocked** (only if PASS or acceptable PARTIAL PASS)

---

## Deliverable traceability

| ID | Deliverable | Path | Implementer |
|----|-------------|------|-------------|
| D0.1 | Compile-scope probe | `scripts/probe-cyberdeck-compile-scope.ts` | Done |
| D0.2 | npm script | `package.json` → `probe:cyberdeck-compile-scope` | Done |
| D0.3 | Baseline receipt | this file | Done (pending judicial sign-off) |
