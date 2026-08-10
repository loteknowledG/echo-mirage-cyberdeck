# Echo Mirage — Quest 0 build baseline

**Status:** COLD CLOSED · WARM CLOSED · NODE 22 CLOSED · NVMe CLOSED · **QUEST 0 PASSED** · VERCEL PHASES PARTIAL  
**Branch:** `cursor/voice-lab-mechanicus-wip` @ `b219c91`  
**Scope:** diagnostic only — no config changes, no package moves.

---

## Cold baseline — closed receipt

**Command:** `pnpm exec next build --webpack` (after preprocess timing; preprocess ≈ 0.5s)  
**Condition:** **Cold** — no `.next/` at run start  
**Environment:** Local Windows 11, Node **v24.17.0**, Defender realtime on  

| Metric | Value |
|--------|-------|
| **Quest start** | 2026-08-09 19:37:02 local |
| **`next build` start** | 2026-08-09T19:37:41.4609438-04:00 |
| **`next build` end** | 2026-08-09T20:20:53 local (`ended_at` 2026-08-10T00:20:53Z) |
| **Total `next build` wall** | **2588.9 s (43m 8.9s)** |
| **Webpack production compile** | **38.0 min** (Next banner) |
| **Post-webpack phases** | **~308.9 s (~5m 9s)** — TS check, 11 workers page data, 21/21 static pages (719ms), finalize, build traces, route table |
| **`pnpm build` equivalent** | **2589.4 s (43m 9.4s)** — pre 0.5s + next (excludes isolated `tsc`) |
| **Isolated `tsc --noEmit`** | 38.3 s (not in `pnpm build` script; Next also runs TS during build) |
| **Exit code** | **0** |
| **Static generation** | **21/21** pages (`Generating static pages … (21/21) in 719.1ms`) |
| **Route table** | **Complete** — full `Route (app)` listing through `/send` + middleware |
| **BUILD_ID** | `C-3q04rTm39e7trrdCQST` |
| **Peak memory** | **Not captured** on cold run (warm run samples every 15s) |
| **Warnings** | `google-photos/route.ts` critical dependency (×2) — not timed separately |

**Log:** `.tmp/quest0-cold-build.log`  
**Summary line:** `pre1=0.1s pre2=0.3s pre3=0.1s tsc=38.3s next_build=2588.9s total=2589.4s`

---

## Warm baseline — closed receipt

**Command:** `pnpm exec next build --webpack`  
**Condition:** **Warm** — `.next/` retained (BUILD_ID before: `C-3q04rTm39e7trrdCQST`)  
**Node:** v24.17.0 · **Started:** 2026-08-09T20:21:13 local · **Ended:** ~20:54 local  

| Metric | Warm | Cold | Δ |
|--------|------|------|---|
| **`next build` wall** | **1973.2 s (32m 53s)** | 2588.9 s (43m 9s) | **−615.7 s (−24%)** |
| Exit code | **0** | 0 | — |
| BUILD_ID after | `9dbQsaazogc22kWJA5Yfl` | `C-3q04rTm39e7trrdCQST` | new build |
| Peak node WorkingSet (15s samples) | **3914.9 MB** | not captured | — |
| Max node process count | **25** | — | 11 workers + orchestration |

**Log:** `.tmp/quest0-warm-build.log` · **Utilization:** `.tmp/quest0-warm-util.csv` (132 samples)

### Warm phase breakdown (from `.next/trace-build`, Node 24)

| Phase | Duration | Share of `next build` |
|-------|----------|------------------------|
| **`run-webpack`** | **1670.2 s (27m 50s)** | **85%** |
| `run-typescript` | 102.5 s (1m 43s) | 5% |
| `collect-build-traces` | 145.1 s (2m 25s) | 7% |
| `static-check` | 43.2 s | 2% |
| `static-generation` | 3.2 s | <1% |
| **`next-build` (trace total)** | **1962.3 s (32m 42s)** | — |

Trace total aligns with wall clock (1973s). Post-webpack ≈ **294 s (~4m 54s)** excluding webpack banner rounding.

**Interpretation:** Warm is faster but not dramatic (~33m vs ~43m cold). With `config.cache = false`, improvement likely from **OS/filesystem cache + warm `.next` artifact state**, not persistent webpack cache. Webpack compile still dominates; still **slower than Vercel 26m total deploy** on comparable commit track.

---

## Node 22 comparison — closed receipt

**Portable runtime:** `.tmp/quest0-node22/node-v22.13.1-win-x64/node.exe` (CI target **22.13**)  
**Harness:** `scripts/quest0-node22-warm-build.ps1`  
**Method:** prepend Node 22 dir to `PATH` before `pnpm exec next build --webpack`  
**Condition:** warm `.next/` retained; same branch/commit/Defender/machine  
**Started:** 2026-08-09 21:16:17 local · **Ended:** 21:55 local  
**Log:** `.tmp/quest0-node22-warm-build.log` · **Util:** `.tmp/quest0-node22-warm-util.csv`

| Metric | Node 22 warm | Node 24 warm | Δ |
|--------|--------------|--------------|---|
| **`next build` wall** | **2342.3 s (39m 2s)** | 1973.2 s (32m 53s) | **+369.1 s (+18.7%)** |
| Exit code | **0** | 0 | — |
| BUILD_ID after | `qKmjaoqkzgtIgUGc1BD3L` | `9dbQsaazogc22kWJA5Yfl` | — |
| Peak WorkingSet (15s samples) | **3295.8 MB** | 3914.9 MB | −619 MB |
| Max node process count | **26** | 25 | — |
| Max Node **22** process count | **12** | 0 | mixed worker pool |

### Node 22 phase breakdown (`.next/trace-build`)

| Phase | Node 22 | Node 24 warm | Δ |
|-------|---------|--------------|---|
| **`run-webpack`** | **1982.5 s (33m 3s)** | 1670.2 s (27m 50s) | **+312 s (+18.7%)** |
| `run-typescript` | 122.2 s | 102.5 s | +20 s |
| `collect-build-traces` | 166.3 s | 145.1 s | +21 s |
| `static-check` | 60.8 s | 43.2 s | +18 s |
| `next-build` (trace) | 2334.7 s | 1962.3 s | +372 s |

**Webpack banner:** `Compiled with warnings in 33.0min` (Node 22 log)

### Measurement caveats

1. First Node 22 attempt (without PATH fix) was aborted; BUILD_ID before rerun was `none` (partial abort), though `.next/cache` remained.
2. Worker pool was **mixed**: max **12** Node 22 processes + Node 24 workers from system PATH — not a pure Node 22 isolation. Even so, Node 22 was **slower**, not faster.
3. `$env:NODE` does **not** affect pnpm/webpack child processes; PATH prepend is required.

### Decision gate result: **Node 22 is not the lever**

Node 22 warm is **~19% slower** than Node 24 warm on this machine/repo state. **Do not standardize Node 22** before environment/graph experiments. Next controlled experiment: **NVMe SSD copy warm build** (repo currently on USB HDD F:).

---

## Environment — F: drive (closed receipt)

| Field | Value |
|-------|-------|
| Repository path | `F:\dev\echo-mirage-cyberdeck` |
| `node_modules` | same volume — **112,390 files, ~1.85 GB** |
| Drive letter | **F:** |
| Label | **USB-HDD** |
| Filesystem | **NTFS** |
| Media | **HDD** |
| Bus | **USB** |
| Model | **PRO X Avolusion** |
| Capacity / free | **~3.0 TB / ~488 GB free** |
| System fast disk | MSI M371 1TB NVMe (repo **not** on it) |

`next.config.mjs` already documents: *"Memory optimizations can hang long webpack compiles on some Windows/USB disks."*

Micro-benchmark (5000 sequential reads of `node_modules/react/index.js`, warm OS cache): **~2.3 s** — not catastrophic alone, but webpack issues **millions** of stat/read operations across **1.8 GB / 112k files** on USB HDD.

**Decision gate:** if Node 22 does not explain the gap vs Vercel, run **one controlled copy** of repo to NVMe SSD and repeat warm build (measurement only).

---

## Toolchain identity — closed receipt

| Layer | Path / version |
|-------|----------------|
| **Node (system default)** | `C:\Program Files\nodejs\node.exe` · **v24.17.0** |
| **Node (CI reference)** | **22.13** (desktop workflow) |
| **Node (Quest 0 portable)** | `.tmp/quest0-node22/.../node.exe` · **v22.13.1** |
| **pnpm effective version** | **10.33.2** (`pnpm --version`) |
| **`packageManager` pin** | `pnpm@10.33.2` in `package.json` |
| **pnpm launcher** | `C:\Users\quang\AppData\Local\pnpm\pnpm.ps1` |
| **Internal wrapper (stderr)** | `@pnpm/exe/11.20.0` npm package ships the **10.33.2** binary — version string is authoritative, not the wrapper major |
| **corepack** | 0.35.0 (not driving pnpm here) |
| **Next.js** | 16.1.5 (webpack bundler) |
| **TypeScript** | 5.9.3 |

**pnpm 11 vs 10 ambiguity resolved:** the PowerShell shim loads `@pnpm/exe@11.20.0`, which bundles `pnpm` **10.33.2**. No version skew in the package manager itself.

---

## Vercel reference — partial receipt

**Production deploy:** `7sugl7seh` · `dpl_7giCTDijYZ4PCkx8SNvq72TNycTW` · commit `fea8a68`  
**Dashboard:** [vercel.com/.../7giCTDijYZ4PCkx8SNvq72TNycTW](https://vercel.com/loteknowledgs-projects/echo-mirage-cyberdeck/7giCTDijYZ4PCkx8SNvq72TNycTW)

| Metric | Value | Notes |
|--------|-------|-------|
| **`vercel list` Duration** | **26m** (production) · **25m** (preview) | **Total deployment** — install + build + upload + promote |
| Created (inspect) | 2026-08-09 17:39:36 EDT | |
| GitHub deployment status | 2026-08-09T22:30:29Z success | wall ≠ compile-only |
| **Compile-only webpack time** | **NOT YET EXTRACTED** | build log phase split still required |
| CI webpack parallelism | **`parallelism = 1`** when `CI && !dev` | local uses default (25 node procs observed) |
| Contradiction | Vercel **faster despite CI serial webpack** | weakens "insufficient local parallelism" as primary cause |

**Next step for Vercel:** pull build log from dashboard or authenticated `/deployments/{id}/events` API and split: dependency install · `next build --webpack` · post-build · upload.

---

## Static graph investigation — read-only (initial)

### `transpilePackages` scope

Configured in `next.config.mjs`: `realmorphism`, `@eigenpal/docx-editor-react`, lit stack, `@mariozechner/pi-web-ui`.

| Package | Resolved scope | Files (approx) | Notes |
|---------|----------------|----------------|-------|
| **realmorphism** | sibling `F:\dev\realmorphism` | **src: 47 files (~0.2 MB)** | sibling `node_modules` (~17k files) **not** source; webpack resolves package root via sibling |
| `@eigenpal/docx-editor-react` | `node_modules` | 80 files, 1.3 MB | deprecated package |
| `@mariozechner/pi-web-ui` | `node_modules` | 1738 files, 3.1 MB | custom pre-loader `scripts/pi-attachment-utils-loader.cjs` on `dist/**/*.js` |
| lit stack | `node_modules` | 312+ files | plus dynamic imports from `pi-chat-pane-body.tsx` |

Direct app imports of transpiled packages: **9** source files (`registry-showroom`, `operator-docx-editor`, `cyberdeck-rolling-picker`, pi/db8 routes, etc.).

### Barrels / fan-out

| Barrel | Re-exports |
|--------|------------|
| `src/lib/muthur-ascii-skill/index.ts` | types, render, parse, doctrine, templates |
| `src/lib/muthur/browser/index.server.ts` | policy, session, screenshot server |
| `src/lib/muthur/observation/index.server.ts` | observation modules |
| `src/lib/cyberdeck/powerfist-remote-socket.ts` | re-export |

### API surface

**121** `src/app/api/**/route.ts` files — large server graph; most import `@/lib/server/*` chains rather than browser-only packages directly.

### Dynamic / context modules

| Path | Pattern |
|------|---------|
| `src/app/api/google-photos/route.ts` | ESM import → CJS `createRequire` → scan pnpm store for `google-photos-album-image-url-fetch` — triggers webpack critical-dependency warnings |
| `src/features/cyberdeck/pane-chunks.ts` | 14 lazy `import()` pane loaders |
| `src/components/cyberdeck/pi-chat-pane-body.tsx` | lit + pi-web-ui + pi-agent-core dynamic import chain |
| `src/lib/muthur/chat/muthur-chat-route-handler.ts` | multiple dynamic imports of provider/tool modules |

### Duplicated dependency versions

Spot check: **react@18.3.1** single tree (deduped peers). `pnpm dedupe --check` not yet closed (long resolve). No second major React detected in quick `pnpm why react`.

### Custom webpack loaders (production)

- `pdfjs-dist` forced alias + `.mjs` rule
- `@mariozechner/pi-web-ui/dist/**/*.js` → `pi-attachment-utils-loader.cjs`
- **`config.cache = false`** in production
- **`webpackMemoryOptimizations: true`** (except Electron build)

### Ranked interventions (evidence-weighted, post-NVMe)

1. **Move repo off USB HDD to NVMe** — **−81% warm wall time** (1973 s → 380 s); **−83% `run-webpack`** (1670 s → 291 s). **Primary immediate lever.**  
2. **Re-enable / tune production webpack disk cache** — still disabled (`config.cache = false`); NVMe makes builds tolerable but cache would shrink repeat compiles further.  
3. **Graph bisection** (`transpilePackages`, pi-web-ui loader, barrels) — still relevant for incremental gains; **not** the cause of the 33-minute USB warm time.  
4. **Defender exclusions on build paths** — untested; RealTime on for both drives; secondary to disk placement.  
5. **Node version pinning** — deprioritized (Node 22 attempt did not help; mixed-worker caveat noted).  
6. **Turborepo** — deferred; task caching ≠ fixing first compile on slow disk.  
7. **Local parallelism** — deprioritized (Vercel CI `parallelism=1`; NVMe faster with fewer workers).

---

## Primary finding (accepted)

> Local cold **Webpack production compilation ≈ 38 minutes**. Warm **≈ 28 minutes webpack / 33 minutes total**. TypeScript (38s isolated) and preprocessing (0.5s) are **not** primary causes. Post-webpack work adds **~5 minutes**.

---

## Known config context (not changed)

- `next.config.mjs`: **`config.cache = false`** when `!dev`
- `transpilePackages`: realmorphism, docx-editor, lit stack, pi-web-ui
- CI: **`parallelism = 1`**; local: default (up to **25** Node processes observed)
- **`serverExternalPackages`**: playwright, puppeteer, figlet, pi-ai, node-pty, etc. (22 entries)

---

## Decision gate (Node 22 + environment — updated)

| Outcome | Result | Next focus |
|---------|--------|------------|
| Node 22 materially faster warm | **NO** — 39m vs 33m (+19%) | Do **not** pin Node 22 first |
| Node 22 ≈ Node 24 | **NO** — Node 22 slower | — |
| USB HDD environment | **YES** — NVMe warm **80.7% faster** | **Move repo to NVMe** |
| Vercel faster despite CI `parallelism=1` | **YES** — 26m total deploy vs 33–39m local | environment + graph, not worker count |
| Turborepo | **Deferred** | does not shrink intrinsic webpack compile |

**Navigator next step:** move working tree to NVMe (or symlink `node_modules`/repo off F:). Graph bisection remains valuable but is **secondary** to disk placement.

---

## NVMe benchmark — closed receipt

**Target:** `C:\temp\quest0-nvme-echo-mirage-b219c91\echo-mirage-cyberdeck`  
**Drive:** C: MSI M371 1TB NVMe SSD  
**Commit:** `b219c91` (git HEAD + lockfile/config SHA256 verified)  
**Toolchain:** Node **v24.17.0** · pnpm **10.33.2** · `.env.local` copied  
**Harness:** `scripts/quest0-nvme-benchmark.ps1`  
**Copy preserved:** `C:\temp\quest0-nvme-echo-mirage-b219c91` (not deleted)

### Copy receipt

| Item | Method |
|------|--------|
| `node_modules` | **Copied** from F: via robocopy `/E` (no `/MIR`) — **not reinstalled** |
| `.next` | **Excluded** for cold; created by cold build; retained for warm |
| `.env.local` | **Copied** (3339 bytes) |
| `realmorphism` sibling | **Copied** `src/` + package manifests |
| Robocopy duration | ~36 min (USB read → NVMe write) |
| Hash verification | `pnpm-lock.yaml`, `package.json`, `next.config.mjs`, `tsconfig.json`, `vercel.json` — **all match** |

**Manifest:** `C:\temp\quest0-nvme-echo-mirage-b219c91\quest0-nvme-manifest.json`  
**Defender:** RealTimeProtection **on** on F: and C: (exclusions not readable without admin)

### Build results

| Metric | USB F: cold | USB F: warm | **NVMe cold** | **NVMe warm** | NVMe warm vs USB warm |
|--------|-------------|-------------|---------------|---------------|------------------------|
| **`next build` wall** | 2588.9 s (43m 9s) | 1973.2 s (32m 53s) | **457.8 s (7m 38s)** | **380.2 s (6m 20s)** | **−80.7%** |
| Exit code | 0 | 0 | **0** | **0** | — |
| Peak WorkingSet | — | 3914.9 MB | **2847.9 MB** | **3143.0 MB** | — |
| Max node processes | — | 25 | **15** | **12** | — |
| BUILD_ID | `C-3q04rTm39e7trrdCQST` | `9dbQsaazogc22kWJA5Yfl` | `rkhsLCSSdPXSUOZO_MNrt` | `Se643g5MwdvaEva8Amv0Z` | — |

**Logs:** `C:\temp\...\echo-mirage-cyberdeck\.tmp\quest0-nvme-{cold,warm}-build.log`  
**Utilization:** `quest0-nvme-{cold,warm}-util.csv`  
**Trace copies:** `quest0-nvme-{cold,warm}-trace-build.json` · summaries in `quest0-nvme-{cold,warm}-summary.json`

### Phase comparison (trace, seconds)

| Phase | USB F: warm | NVMe warm | Δ |
|-------|-------------|-----------|---|
| **`run-webpack`** | **1670.2** | **291.1** | **−82.6%** |
| `run-typescript` | 102.5 | 17.4 | −83.0% |
| `collect-build-traces` | 145.1 | 67.9 | −53.2% |
| `static-check` | 43.2 | 1.6 | −96.3% |
| `static-generation` | 3.2 | 2.7 | −15.6% |
| **`next-build` (trace)** | **1962.3** | **378.5** | **−80.7%** |

NVMe cold `run-webpack`: **345.3 s (5m 45s)** vs USB cold banner **38.0 min**.

### Decision gate result: **filesystem placement is the primary immediate lever**

NVMe warm is **80.7% faster** than USB warm — far above the **≥40%** threshold. The ~33-minute USB warm build was dominated by **USB HDD I/O** across 112k `node_modules` files, not by an intrinsically unavoidable 30-minute webpack graph on fast storage.

**Caveats:**
- NVMe copy used **copied** `node_modules` (same dependency bytes as F:); no reinstall drift.
- Fewer Node workers on NVMe (12–15 vs 25) yet much faster — confirms I/O-bound USB hypothesis over parallelism.
- Vercel **26m total deploy** is now **slower than local NVMe warm (6m 20s)**; remaining gap is likely install/CI overhead, not raw webpack on Linux NVMe.

---

## Quest 0 exit gate

- [x] Cold receipt closed (exact wall, post-webpack, exit 0, routes complete)
- [x] Warm control + utilization
- [x] F: drive + toolchain identity
- [x] Static graph initial audit (read-only)
- [x] Node 22 warm comparison (**closed — slower than Node 24**)
- [ ] Vercel compile-only phase split
- [x] Ranked interventions with evidence (NVMe benchmark closed)

**Evidence PR:** [#109 merged](https://github.com/loteknowledG/echo-mirage-cyberdeck/pull/109) · merge commit `01c33e5`  
**Quest 1:** **PASSED** — authoritative base `C:\dev\echo-mirage-cyberdeck` (see `quest1-nvme-operating-base.md`)
