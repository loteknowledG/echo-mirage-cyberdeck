# Quest 2 — Pre-merge gate (PR #110)

**Branch:** `cursor/quest2-webpack-cache` → `cursor/voice-lab-mechanicus-wip`  
**PR:** https://github.com/loteknowledG/echo-mirage-cyberdeck/pull/110  
**Date:** 2026-08-10

---

## Decision gate

```text
Correctness passes
+ no secrets/config accidentally changed
+ repeat deploy demonstrates cache behavior
→ merge PR #110
```

---

## 1. `.env.local` restore

| Check | Result |
|-------|--------|
| Trusted backup source | `F:\dev\echo-mirage-cyberdeck\.env.local` (3339 bytes, Quest 1 copy) |
| NVMe after restore | **3339 bytes** |
| `pnpm dev` sidecar | `:3051/health` → **ok** |
| Vercel CLI overwrite reverted | Yes — local keys restored; **do not** run `vercel deploy` without `--no-env-pull` on dev machine |

---

## 2. `.gitignore` review

| Change | Verdict |
|--------|---------|
| `.env*.local` added next to explicit `.env.local` entries | **Keep** — covers variant local env files without committing secrets |
| Quest 2 raw harness ignores (`*-summary.json`, `*.log`) | **Keep** — bloated PowerShell JSON/logs stay untracked; sanitized metrics in `quest2-measurements.json` |
| Removed erroneous trailing `.env*.local` duplicate from Vercel CLI | Done |
| `.env.demo.example` still tracked | Yes — not ignored |

**Not committed:** `.vercel/` (local link artifact), bloated `quest2-results/*-summary.json`.

---

## 3. Benchmark artifacts

| Kept (tracked) | Removed / ignored |
|----------------|-------------------|
| `docs/engineering/quest2-measurements.json` | `*-summary.json` (448 KB each, PowerShell serialization bloat) |
| `docs/engineering/quest2-results/*-util.csv` | `*.log` build transcripts |
| `docs/engineering/quest2-webpack-cache.md` | |

---

## 4. Operator smoke (local dev, restored `.env.local`)

Automated via Playwright on `http://localhost:3050/cyberdeck`:

| Check | Result |
|-------|--------|
| Voice Lab opens from rail | **PASS** — `[data-testid="voice-lab-pane-body"]` present |
| Mechanicus preview | **PASS** — status `Played mechanicus-voice.` |
| Preview does **not** assign MUTHUR voice | **PASS** — `echo-mirage-muthur-voice-lab-enabled-v1` stayed `"0"`; profile unchanged during preview |
| Explicit assignment toggle | **PASS** — toggle on → `"1"` + `mechanicus-voice`; toggle off → `"0"` |
| Survey integration | **PARTIAL** — MUTHUR shows `SURVEY HUB` messages; PowerFist/Tailscale timeouts (**known environmental**, same class as Quest 1). Survey custom-tab pane not fully exercised (UI overlay blocked automated `+` tab menu). |

Preview TTS **401** on Vercel remains **deployment protection**, not regression — use production receipt or SSO browser session.

---

## 5. Repeat Vercel deployment — cache behavior

Two consecutive PR preview builds on **Node 24.x**:

| Deploy | Commit | Created (EDT) | Ready (approx) | Wall | Notes |
|--------|--------|---------------|----------------|------|-------|
| **1** | `b929e0d` | 08:04:53 | 08:25:29 | **~21 min** | First build with webpack filesystem cache enabled |
| **2** | `e1a1168` | 08:33:20 | 09:06:54 | **~33 min** | Empty commit; **no warm-cache speedup** |

**Conclusion:** Production webpack **filesystem cache helps local NVMe warm builds (~8%)** but **does not demonstrate persistent warm-cache wins on Vercel** across consecutive preview deploys. Vercel iteration (~21–33 min) remains a **separate problem** from local iteration (Quest 0/1 NVMe: ~4–5 min).

Next Vercel-focused work (not blocking merge of local-cache + `engines`):

- Phase-level attribution on Vercel build logs
- Deploy skipping / unchanged-route detection
- Verify Vercel **Build Cache** vs webpack `.next/cache/webpack` restore
- Review CI `parallelism = 1` on Linux builders

---

## Gate verdict

| Criterion | Status |
|-----------|--------|
| Correctness | **PASS** (local operator smoke) |
| No secrets/config drift in git | **PASS** (`.env.local` restored, not tracked) |
| Repeat deploy cache behavior documented | **PASS** (remote: no warm win; local: yes) |

**→ Merge PR #110** — ships local build win + Node 24 `engines` alignment; does **not** claim Vercel iteration solved.

---

## Post-merge

1. Record merge receipt in `quest2-vercel-node-migration.md`.
2. Quest 2 continues: Exp2 graph profile, Exp3 trace scope, Exp4 transpile bisection, **Vercel iteration track** (separate from local cache).
