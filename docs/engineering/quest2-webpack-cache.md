# Quest 2 — Experiment 1: Production Webpack cache

**Branch:** `cursor/quest2-webpack-cache`  
**Repo:** `C:\dev\echo-mirage-cyberdeck` (NVMe only)  
**Baseline (Quest 1, cache disabled):** warm **263.6 s (4m 24s)** · `run-webpack` **166.8 s**  
**Harness:** `scripts/quest2-build-benchmark.ps1`  
**Exit gate:** ≥25% warm-build reduction **or** documented conclusion that package boundaries are required

---

## Variable under test

Replace production `config.cache = false` with **filesystem cache** at `.next/cache/webpack` (Quest 2 branch only).

Control on `cursor/voice-lab-mechanicus-wip`: cache remains **disabled**.

---

## Measurement matrix

| Run | Label | Precondition |
|-----|-------|--------------|
| A | `exp1-a-cold-cache-on` | Delete `.next` entirely |
| B | `exp1-b-warm-identical` | Retain `.next` from A |
| C | `exp1-c-incremental-ui` | Touch one small UI file, then build |
| — | Baseline (Quest 1) | cache=false, warm **263.6 s** (reference) |

Record per run: wall time, `run-webpack` / `next-build` trace, peak memory, node count, cache size (MB), exit code, BUILD_ID.

---

## Smoke gate (each experiment branch change)

- [x] `pnpm exec tsc --noEmit`
- [x] `POST /api/tts` mechanicus-voice (edge fallback OK)
- [x] Cyberdeck loads on **http://localhost:3050/cyberdeck** (HTTP 200)

---

## Results

| Run | Wall (s) | run-webpack (s) | collect-traces (s) | Cache MB | Peak MB | Nodes | Exit | BUILD_ID |
|-----|----------|-----------------|---------------------|----------|---------|-------|------|----------|
| Baseline (Q1, cache off) | 263.6 | 166.8 | — | — | — | — | 0 | — |
| A cold cache on | **307.2** | 198.6 | 76.1 | 2117.6 | 3075.5 | 24 | 0 | TnGuNksPzQT6oICXnBxRo |
| B warm identical | **243.1** | 146.6 | 71.8 | 2351.3 | 3557.3 | 14 | 0 | XsgIBrQlrTdjQ4s6n1LHv |
| C incremental UI | **244.4** | 152.0 | 68.3 | 2354.7 | 3333.6 | — | 0 | *(new ID)* |

**Artifacts:** `docs/engineering/quest2-results/exp1-{a,b,c}-*.{log,json,csv}`

### Interpretation

| Metric | Δ vs Q1 warm baseline |
|--------|------------------------|
| Warm identical wall | **−20.5 s (−7.8%)** |
| Warm `run-webpack` | **−20.2 s (−12.1%)** |
| Cold first build (A) | **+43.6 s (+16.5%)** — cache population + empty `.next` |
| Incremental UI (C vs B) | **+1.3 s** — within run-to-run noise; no stale-output signal |

Webpack filesystem cache **helps warm rebuilds** but does **not** reach the **25% exit gate** alone. Largest remaining phases on warm B: **`run-webpack` 146.6 s**, **`collect-build-traces` 71.8 s** (~68 s of total wall).

Cache footprint after warm runs: **~2.35 GB** under `.next/cache` (acceptable on NVMe; monitor on constrained disks).

---

## Stale-output / correctness notes

- Run C touched `src/components/cyberdeck/cyberdeck-runtime-badge.tsx` (comment probe, reverted after benchmark). Wall time stayed near B; BUILD_ID changed each run as expected.
- No route list anomalies or build failures across A/B/C.
- Dev startup clears stale production `.next` before dev (`scripts/next-dev.mjs`) — production cache does not leak into dev incorrectly.

---

## Decision

**Keep filesystem cache on `cursor/quest2-webpack-cache` for continued Quest 2 work.** Deterministic warm win (~8% wall, ~12% webpack phase) with passing smoke gate and no stale-output evidence.

**Does not satisfy Quest 2 exit gate alone.** Proceed to **Experiment 2** (compilation graph profile), **Experiment 3** (narrow build tracing), and **Experiment 4** (transpilation bisection) on the same branch or stacked branches (one variable per benchmark).

---

## Next

1. Experiment 2 — module graph / expensive areas (`transpilePackages`, realmorphism, pi-web-ui, PDF.js, API fan-out).
2. Experiment 3 — reduce `collect-build-traces` ~68–72 s while preserving Electron/server trace deps.
3. Experiment 4 — transpilePackages bisection with runtime smoke after each case.
