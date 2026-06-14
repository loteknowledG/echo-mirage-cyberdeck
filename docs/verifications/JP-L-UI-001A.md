# JP-L-UI-001A Live Foundation Response Visibility Semantic Retest

## Verdict

**PARTIAL PASS — Foundation path verified; provider-dependent command blocked**

Foundation-001 retrieval is semantically correct, visible, and reaches `MUTHUR complete` in the live Cyberdeck UI. Provider-authenticated commands (`open L-ARCH-001.md`) still return `Invalid API key` from OpenRouter, blocking full acceptance.

---

## Provider Used

| Field | Value |
|-------|-------|
| Active provider | OpenRouter (`openrouter`) |
| Model | `deepseek-v4-flash-free` |
| API key state | **Invalid** (HTTP 401 from provider) |

Foundation queries do **not** use the provider uplink; they route through `POST /api/muthur/foundation-query` only.

---

## Commands Run

```powershell
pnpm exec tsc --noEmit
pnpm probe:muthur-foundation-001
pnpm probe:foundation-server-boundary
pnpm probe:muthur-response-visibility
pnpm probe:muthur-command-console
pnpm exec playwright test e2e/l-ui-001a-foundation-visibility.spec.ts
```

---

## Automated Probe Results

| Probe | Result |
|-------|--------|
| `tsc --noEmit` | PASS |
| `probe:muthur-foundation-001` | PASS |
| `probe:foundation-server-boundary` | PASS |
| `probe:muthur-response-visibility` | PASS |
| `probe:muthur-command-console` | PASS |

---

## Live UI Results

### Environment

| Check | Result |
|-------|--------|
| `GET /cyberdeck` | HTTP 200 |
| `Can't resolve 'fs'` | Not present |
| `foundation-store` in client bundle | Not present |

### Test 1 — Foundation Origin Query (`Where did you come from?`)

**PASS**

Transcript evidence (Playwright snapshot):

```text
[USR] Where did you come from?
[MUTHUR] [MUTHUR // FOUNDATION RETRIEVAL // ORIGIN LINEAGE]
I am MUTHUR on Echo Mirage. My continuity lineage includes Samus-Manus.
Foundation-001 (lets-remember-something-ai) is the registered origin artifact.
…
Integrity: PASS
```

Lifecycle evidence:

```text
deepseek-v4-flash-free · MUTHUR complete
```

Diagnostics: `▶ Diagnostics (N)` with `aria-expanded="false"`.

### Test 2 — Foundation Document Open (`open L-ARCH-001.md`)

**FAIL (provider authentication)**

Transcript evidence:

```text
[USR] open L-ARCH-001.md
[MUTHUR] [MUTHUR] Invalid API key.
```

Lifecycle evidence (visibility architecture holds):

```text
deepseek-v4-flash-free · MUTHUR complete
```

Diagnostics: collapsed (`aria-expanded="false"`).

**Blocker:** OpenRouter API key invalid or expired. Command reached complete state and response is visible, but semantic content is provider error, not document retrieval.

### Test 3 — Diagnostics Behavior

**PASS** (foundation path)

- During foundation fetch: brief composing state observed before fix verification
- After completion: `MUTHUR complete`
- Diagnostics panel collapsed by default

### Test 4 — Transcript Persistence

**PASS** (foundation path)

- Foundation response remained in `[data-muthur-channel]` after completion
- Response not replaced by diagnostics output
- User → assistant ordering preserved

---

## Defect Fixed During Retest

Foundation early-return path left `streamText` at `MUTHUR // preparing uplink...` after a successful foundation response, causing the footer to remain in **composing** despite a committed assistant message.

**Fix:** `cyberdeck-app.tsx` foundation handler now clears `streamText`, `streamToolTrace`, compose watchdog, and stall state before return.

---

## Regression

| Check | Result |
|-------|--------|
| No `fs` import regression | PASS |
| No client/server boundary regression | PASS |
| Response visibility (foundation) | PASS |
| Command lifecycle footer (foundation) | PASS (after streamText fix) |
| Command lifecycle footer (provider) | PASS (`complete` shown even on API error) |
| Foundation read-only | PASS — no artifact embedded in memory |

---

## Playwright Summary

```text
e2e/l-ui-001a-foundation-visibility.spec.ts
  ✓ page loads without fs boundary failure
  ✓ Test 1 — foundation origin query is visible and completes
  ✓ Test 3 — diagnostics collapsed after foundation completion
  ✗ Test 2 — open L-ARCH-001.md (Invalid API key)
```

---

## Operator Action Required

Refresh OpenRouter API key in provider settings (or `.env.local` → `NEXT_PUBLIC_OPENROUTER_API_KEY`) and rerun:

```text
open L-ARCH-001.md
```

Expected after key refresh: semantic document-open response, `MUTHUR complete`, diagnostics collapsed.

---

## Final Acceptance

| Criterion | Status |
|-----------|--------|
| `/cyberdeck` loads | PASS |
| Foundation query semantic response | PASS |
| Foundation lifecycle + visibility | PASS |
| Provider authentication | **FAIL** |
| Document open semantic response | **FAIL** (blocked by provider) |
| All probes | PASS |

**Overall: PARTIAL PASS** — unblock Test 2 by restoring a valid OpenRouter (or other configured) API key.
