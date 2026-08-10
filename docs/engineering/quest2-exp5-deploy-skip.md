# Quest 2 — Experiment 5: Vercel deploy skip

**Branch:** `codex/quest2-exp5-deploy-skip`  
**Base:** `cursor/voice-lab-mechanicus-wip` @ `50ffe828`  
**Variable:** `vercel.json` → `ignoreCommand: node scripts/vercel-should-build.mjs`  
**Success metric:** Fewer unnecessary ~21-minute preview deploys — **not** faster necessary builds.

---

## Mechanism

Vercel [`ignoreCommand`](https://vercel.com/docs/project-configuration/vercel-json#ignorecommand):

| Exit code | Action |
|-----------|--------|
| **0** | **Skip** deployment |
| **1** | **Build** (default) |

Harness: `scripts/vercel-should-build.mjs`  
Simulation: `node scripts/quest2-exp5-simulate-deploy-skip.mjs`

On Vercel, changed files come from:

```text
git diff --name-only $VERCEL_GIT_PREVIOUS_SHA $VERCEL_GIT_COMMIT_SHA
```

Missing previous SHA → **BUILD** (safe default).

---

## Path policy (Exp 5 initial)

### Skip-only (no Cyberdeck runtime impact)

| Prefix | Examples |
|--------|----------|
| `docs/engineering/` | Quest receipts, `build-baseline.md`, `quest2-measurements.json`, `quest2-results/*.csv`, experiment logs |

### Always build (runtime / build graph)

| Category | Paths |
|----------|-------|
| Application | `src/**` |
| Static assets | `public/**`, `assets/**` |
| Build scripts | `scripts/**` (includes skip script itself) |
| Satellites | `apps/**` |
| Next / toolchain | `next.config.mjs`, `vercel.json`, `package.json`, `pnpm-lock.yaml`, `tsconfig*.json`, `tailwind.config.*`, `postcss.config.*`, `middleware.ts`, `instrumentation.ts`, `eslint.config.*`, `playwright.config.*` |

### Ambiguous → BUILD

Anything outside `docs/engineering/` (e.g. `README.md`, `docs/verifications/**`, `.github/**`, root docs) forces a full build.

---

## Simulated cases (local, pre-push)

Run: `node scripts/quest2-exp5-simulate-deploy-skip.mjs`

| Case | Files | Expected | Result |
|------|-------|----------|--------|
| Engineering doc only | `docs/engineering/quest2-exp5-deploy-skip.md` | SKIP | PASS |
| Benchmark util csv | `quest2-results/exp1-b-warm-identical-util.csv` | SKIP | PASS |
| Engineering receipts | `quest2-measurements.json` + `build-baseline.md` | SKIP | PASS |
| Runtime src | `src/components/cyberdeck/cyberdeck-runtime-badge.tsx` | BUILD | PASS |
| next.config | `next.config.mjs` | BUILD | PASS |
| vercel.json | `vercel.json` | BUILD | PASS |
| Skip script | `scripts/vercel-should-build.mjs` | BUILD | PASS |
| Non-engineering doc | `docs/verifications/JP-L-UI-001A.md` | BUILD | PASS |
| Mixed doc + README | `docs/engineering/…` + `README.md` | BUILD | PASS |
| package.json | `package.json` | BUILD | PASS |
| Empty change set | *(none)* | BUILD | PASS |

---

## Live verification plan (Git-integrated Vercel)

| Step | Commit | Expected Vercel action |
|------|--------|------------------------|
| A | Exp 5 infrastructure (`vercel.json`, skip scripts, this doc) | **BUILD** (scripts + vercel.json are runtime/build paths) |
| B | Docs-only under `docs/engineering/` | **SKIP** |
| C | Minimal `src/` touch | **BUILD** |

Record deployment status URLs in the receipt table below.

---

## Live verification receipt

| Step | Commit | Vercel status | Notes |
|------|--------|---------------|-------|
| A infrastructure | `e388bff` | *in progress* | scripts + vercel.json → expect BUILD |
| B docs-only | *pending* | | |
| C runtime | *pending* | | |

---

## Revert

Remove `ignoreCommand` from `vercel.json` and delete `scripts/vercel-should-build.mjs` (or set dashboard ignore step to default).

---

## Out of scope (separate branches)

- Git-integrated phase timing (Exp 6)
- CI `parallelism = 1` reversal (Exp 7)
- Webpack cache / transpile bisection
