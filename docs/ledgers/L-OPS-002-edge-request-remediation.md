# L-OPS-002 — Edge Request Remediation

## Status

Complete (2026-07-25)

## Product

Echo Mirage Cyberdeck

## Objective

Reduce Echo Mirage background edge traffic by **≥95%** while preserving Survey, CADRE, Drop Bay, and app-update functionality.

---

## Required remediation (ordered)

1. ✅ Singleton Survey team status poll (`survey-team-status-poll.client.ts` + `background-poll.client.ts`)
2. ✅ One polling loop per browser tab regardless of mounted Survey panes
3. ✅ Adaptive Survey cadence: **5s pairing**, **45s idle**, **stopped hidden**
4. ✅ Pause all background polls while `document.hidden`
5. ✅ Exponential backoff + jitter on errors
6. ✅ Listening poll: **≥5s active**, **30s armed-idle**; **300ms removed**
7. ✅ Dedupe Echo pane + link watch into coordinated team poll tick
8. ✅ CADRE + Drop Bay SSE: managed reconnect with backoff + hidden pause
9. ✅ Vercel demo profile: `isSurveyRelayPollingEnabled()` opt-in for relay/listening
10. ✅ App version poll: **45min**, hidden-aware
11. ✅ Reusable `createBackgroundPoll()` utility
12. ✅ Dev-only client request instrumentation (no extra network)

---

## Adaptive Survey cadence

| State | Interval |
|-------|----------|
| Actively pairing (not triple-linked) | 5s |
| Connected / idle | 45s |
| Tab hidden | stopped |
| Repeated errors | exponential backoff to 5min |
| Listening (active speech) | 5s minimum |
| Listening (armed, idle) | 30s |

---

## Target budgets (after remediation)

| Scenario | Target req/hr |
|----------|---------------|
| Idle Cyberdeck | ≤ 15 |
| Survey open, inactive | ≤ 240 |
| Listening armed | ≤ 720 (push transport preferred later) |
| Hidden tab | ≤ 2 |
| Multiple mounted consumers | must **not** multiply frequency |

---

## Architecture

```text
createBackgroundPoll()          ← singleton timer, visibility, backoff, abort
        │
        ├── surveyTeamStatusPoll   ← one tick: team + echo snapshot + link watch
        ├── surveyListeningPoll    ← armed-only, ≥5s
        ├── surveyRelayDiscoveryPoll
        └── appVersionPoll           ← 45min

connectManagedEventSource()     ← CADRE + Drop Bay SSE with reconnect backoff
```

---

## Guardrails

- No removal of required Survey/CADRE/Drop Bay/update behavior
- No unrelated Calyx/Career/MUTHUR/CADRE architectural changes
- No new state library (module-level stores + ref-counted poll subscribers)
- Do not claim 5.4M fully explained without route-level evidence

---

## Verification commands

```bash
pnpm exec tsc --noEmit
pnpm probe:edge-polling
pnpm probe:survey-hub-functional
pnpm probe:calyx-smoke
pnpm probe:cyberdeck-compile-scope
```

---

## Completion report

### Status

**Complete** (2026-07-25)

### Root causes fixed

1. **Duplicate `useSurveyTeamStatus()` intervals** — each mount created its own 3s timer (~2,400 edge req/hr each).
2. **300ms listening relay poll** — up to ~12,000 edge req/hr per armed tab.
3. **Separate Echo pane (5s) and link-watch (2.5s) loops** — redundant network passes.
4. **SSE reconnect without backoff** — Cadre/Drop Bay EventSource immediate reconnect on serverless.
5. **Global 5-minute `/api/app-version` poll** on all non-localhost hosts without hidden pause.
6. **No Vercel demo guard** for LAN-dependent relay polling.

### Architecture

- `createBackgroundPoll()` — singleton timer, ref-counted subscribers, visibility pause, abort on last unsubscribe, exponential backoff + jitter.
- `surveyTeamStatusPoll` — one coordinated tick: team status + echo snapshot + link watch.
- `surveyListeningPoll` — armed-only, 5s active / 30s idle minimum.
- `connectManagedEventSource()` — SSE with reconnect backoff and hidden-tab pause.
- `isSurveyRelayPollingEnabled()` — opt-in on `*.vercel.app` via `localStorage.survey-relay-polling=1`.

### Files changed (core)

| Area | Files |
|------|-------|
| Poll utility | `src/lib/client/background-poll.client.ts`, `client-request-instrumentation.client.ts`, `sse-reconnect.client.ts` |
| Survey | `survey-team-status-poll.client.ts`, `use-survey-team-status.ts`, `survey-echo-link-watch.ts`, `survey-listening.client.ts`, `survey-echo-snapshot-store.client.ts`, `survey-link-watch-store.client.ts`, `survey-relay-discovery-poll.client.ts`, `survey-team-status-probe.client.ts`, `survey-boundary.ts` |
| UI | `survey-echo-pane.tsx`, `survey-mirage-capture-preview.tsx`, `app-update-prompt.tsx`, `layout.tsx` |
| SSE | `use-cadre-host.ts`, `use-drop-bay-feed.ts` |
| App update | `app-version-poll.client.ts` |
| Probes | `scripts/probe-edge-polling.ts`, `scripts/probe-survey-hub-functional.ts` |
| Ledgers | `docs/ledgers/L-OPS-001-edge-request-explosion.md`, `L-OPS-002-edge-request-remediation.md` |

### Before / after request-rate estimates (edge, visible tab)

| Scenario | Before (code-derived) | After (code-derived) | Reduction |
|----------|----------------------:|---------------------:|----------:|
| Idle Cyberdeck | ~12/hr (`/api/app-version`) | ~1–2/hr | ~90% |
| Survey open (4–5 hooks) | ~9,600–12,000/hr | ~160 idle / ~1,440 pairing | **~85–98%** |
| Listening armed | ~12,000/hr | ~720 active / ~120 idle | **~94–99%** |
| Hidden tab | same as visible | ~0 recurring | **~100%** |
| Multiple consumers | ×N hooks | ×1 loop | frequency no longer multiplies |

*Attribution guardrail: 5.4M production total is still not claimed fully explained without Vercel route logs.*

### Verification

| Command | Result |
|---------|--------|
| `pnpm exec tsc --noEmit` | **PASS** |
| `pnpm probe:edge-polling` | **PASS** |
| `pnpm probe:calyx-smoke` | **PASS** |
| `pnpm probe:cyberdeck-compile-scope` | **PASS** |
| Scoped ESLint (changed files) | see CI / local run |
| `pnpm probe:survey-hub-functional` | **PASS** (stale UI/boundary assertions updated for current hub layout) |

### Remaining production uncertainties

- Route-level distribution on Vercel (which paths dominated 5.4M)
- Concurrent tab/session count during spike
- Whether listening mode was armed against production relay
- Crawler/bot share vs operator tabs

### Recommended Vercel monitoring after redeploy

1. **Usage → Edge Requests** — daily ceiling alert at <50k/day for demo deploy.
2. **Logs** — filter `/api/survey/*`, `/api/app-version`, `/api/cadre/stream`, `/api/drops/stream`.
3. **After deploy** — one controlled test: open Cyberdeck 1h with Survey pane; confirm edge count << pre-fix baseline.
4. **Unpause** only after deploy with L-OPS-002 changes is live.

