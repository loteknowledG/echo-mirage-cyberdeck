# Quest 2 — Experiment 6: Git-integrated Vercel phase timing

**Branch:** `codex/quest2-exp6-phase-timing` (merged PR #113)  
**Base:** `cursor/voice-lab-mechanicus-wip` @ `fc289cf` (post PR #114)  
**Prerequisite:** Exp5 merged; Git-integrated deploys only (not CLI `vercel deploy`).

**Rule:** **One controlled commit → one deployment.** No stacked probes.

---

## Phases measured

| Phase | Vercel log markers |
|-------|-------------------|
| **Queue + clone** | `Running build in` → `Cloning completed` (+ ignoreCommand / cache restore) |
| **Install** | `Running "install" command` → `Done in … pnpm` |
| **Preprocessing** | install end → `Creating an optimized production build` (figlet scripts, etc.) |
| **`next build` / webpack** | `Creating an optimized production build` → `Compiled` |
| **Post-compile + traces** | `Compiled` → `Build Completed in /vercel/output` (TS, static pages, serverless fns, traces) |
| **Upload + finalize** | `Deploying outputs...` → `Deployment completed` |

Harness:

```bash
vercel inspect <deployment-url> --logs 2>&1 > docs/engineering/quest2-results/vercel-<label>.log
node scripts/quest2-vercel-phase-parse.mjs --file docs/engineering/quest2-results/vercel-<label>.log
```

Artifacts live under `docs/engineering/quest2-results/` and `quest2-exp6-phase-timing.md`.

---

## Baseline — merge deploy `d2d73f3` (`Dsk5Ni2Mkj7Y3PZXqH5UZpymztTQ`)

Git-integrated, iad1, 2 cores / 8 GB (2026-08-10):

| Phase | Seconds | % of wall |
|-------|---------|-----------|
| Queue + clone | ~8 | 1% |
| Install | **17** | 1% |
| Preprocessing | ~2 | <1% |
| **`next build` / webpack** | **~1044** (17.4 min) | **~79%** |
| Post-compile + traces | ~152 | ~11% |
| Upload + finalize | **~97** | ~7% |
| **Total wall** | **~1323** (~22 min) | 100% |

**Finding (no config change yet):** Webpack compile dominates. Install and upload are minor. Post-compile/traces (~3.5 min) is the second-largest bucket. Vercel builder uses **1 worker** during page-data collection (matches CI `parallelism = 1` in `next.config.mjs` — Exp7 candidate).

Parsed artifact: `docs/engineering/quest2-results/vercel-d2d73f3-baseline.json`

---

## Measurement protocol

1. Confirm Vercel queue is clear (no concurrent preview builds).
2. Push **one** commit; record SHA and deployment ID.
3. After Ready: capture log + parse JSON.
4. Append row to results table; **report before proposing config changes**.

---

## Results log

| Label | Commit | Deployment ID | queue+clone | install | preprocess | webpack | post+traces | upload | total | Notes |
|-------|--------|---------------|-------------|---------|------------|---------|-------------|--------|-------|-------|
| merge-baseline | `d2d73f3` | `Dsk5Ni2Mkj7Y3PZXqH5UZpymztTQ` | 4 | 18 | 2 | 1044 | 152 | 97 | 1323 | Exp5 merge; 1 worker in logs |
| harness-deploy | `e61c0d5` | `99AzyvpuHPti8s2GueeiNNBPnwtU` | 5 | 18 | 2 | 949 | 145 | 94 | 1218 | PR #113 harness-only; ~20m wall; within baseline variance |

Parsed artifact: `docs/engineering/quest2-results/vercel-e61c0d5-harness.json`

**Harness vs baseline:** webpack −95s, total −105s — run variance, not a config win. Dominant bucket unchanged (~78–79% webpack).

---

## Exp 7 (next)

Reversing CI `parallelism = 1` — separate branch (`codex/quest2-exp7-ci-parallelism`), one variable, one deployment.
