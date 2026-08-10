# Quest 2 — Experiment 7: CI webpack parallelism reversal

**Branch:** `codex/quest2-exp7-ci-parallelism`  
**Base:** `cursor/voice-lab-mechanicus-wip` @ `fc289cf` (post PR #114)  
**Variable:** Remove `config.parallelism = 1` when `process.env.CI && !dev` in `next.config.mjs`  
**Prerequisite:** Exp6 baseline + harness receipt recorded (`d2d73f3`, `e61c0d5`).

**Rule:** **One controlled commit → one deployment.** No stacked probes.

---

## Hypothesis

Exp6 logs showed **1 worker** during page-data collection while Vercel already completes in ~20–22 min. Serial webpack on CI may not help (and may hurt) on 2-core builders. Default webpack parallelism may reduce wall time without OOM.

---

## Revert if

- Vercel build OOM or instability
- Nondeterministic build failures
- No measurable phase improvement vs Exp6 baseline

---

## Measurement protocol

1. Confirm Vercel queue is clear.
2. Push **one** commit touching `next.config.mjs` only.
3. After Ready: `vercel inspect <url> --logs` → `quest2-vercel-phase-parse.mjs`.
4. Compare webpack / post+traces / total vs Exp6 baseline rows.
5. **Report before next variable.**

---

## Results log

| Label | Commit | Deployment ID | queue+clone | install | preprocess | webpack | post+traces | upload | total | Notes |
|-------|--------|---------------|-------------|---------|------------|---------|-------------|--------|-------|-------|
| _pending_ | | | | | | | | | | |
