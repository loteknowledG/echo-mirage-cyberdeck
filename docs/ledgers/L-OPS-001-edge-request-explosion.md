# L-OPS-001 — Edge Request Explosion (Investigation)

## Status

Complete — investigation only (no remediation in this ledger)

## Product

Echo Mirage Cyberdeck (`echo-mirage-cyberdeck`)

## Objective

Determine why Vercel Edge Requests spiked (~5.4M billing-period total; operator observed ~2,000/hour sustained over ~12 hours) and identify code-level contributors before adding more live-runtime features.

---

## Executive summary

**Primary identified code-level risk and likely major contributor:** the **Survey** subsystem — especially duplicate `useSurveyTeamStatus()` intervals (3s) and the **300ms** listening relay poll.

**Not the cause (confirmed from code):**

- Calyx Career `/api/calyx/career/status` — fetch-once on pane mount
- CADRE `/api/cadre/runtimes` — boot fetch + SSE (no 1s polling)
- MUTHUR `/api/muthur/control-lease` — 4s poll only when `NEXT_PUBLIC_MUTHUR_PI_CONTROL_GATING=true` (default **off**)
- Header lights / ambient twinkle — CSS-only, zero network
- `middleware.ts` — **does not exist** in this repo

**Attribution guardrail:** This ledger does **not** claim Survey pollers alone definitively caused all **5.4M** production requests. That split requires **route-level Vercel logs/analytics**. Rates below are **derived from source code**, not measured in production.

---

## Confirmed request rates (from source code)

| Mechanism | Interval | Edge calls per tick | Theoretical req/hr (single loop) |
|-----------|----------|---------------------|----------------------------------|
| `useSurveyTeamStatus` (pre-fix) | 3s | 2 (`/api/survey/echo/codes` + `/api/powerfist/pairing/qr`) | **~2,400** |
| Duplicate hooks (Survey pane open) | 3s × N hooks | 2 × N | **~9,600–12,000** (4–5 hooks) |
| `survey-listening` armed (pre-fix) | **300ms** | 1 (`/api/survey/relay/listening`) | **~12,000** |
| `survey-echo-pane` (pre-fix) | 5s | 1 | ~720 |
| `useSurveyEchoLinkWatch` (pre-fix) | 2.5s | 1–2 | ~1,440–2,880 |
| `AppUpdatePrompt` | 5min | 1 (`/api/app-version`) | ~12 |
| CADRE / Drop Bay SSE | streaming | reconnect on error | variable |

**~2,000/hour observation:** consistent with **one** pre-fix `useSurveyTeamStatus` loop (~2,400/hr).

**5.4M total:** plausible as **billing-period accumulation** of duplicate Survey loops, optional listening mode, SSE reconnect churn, crawlers, and deploy traffic — **not proven endpoint-by-endpoint without Vercel route logs**.

---

## Likely production attribution (plausible, not proven)

1. Left-open Cyberdeck tab on `*.vercel.app` with Survey pane mounted
2. Multiplied pollers from non-singleton hooks
3. Listening armed at 300ms against relay
4. SSE reconnect storms on serverless (Cadre/Drop Bay)
5. Bot/crawler + RSC asset traffic on public URL

---

## Facts still requiring route-level Vercel logs

- Per-route request counts over the spike window
- Whether listening mode was active in production
- Number of concurrent sessions/tabs
- Crawler vs authenticated operator share

---

## Remediation follow-up

See **L-OPS-002 — Edge Request Remediation**.
