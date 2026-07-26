# L-OPS-003 — Vercel Hobby Fair-Use Pause (Incident Record)

## Status

Open — awaiting courtesy unblock, deploy of `2c82143`, and 48-hour validation

## Product

Echo Mirage Cyberdeck

## Tags

- Git tag: `ops-edge-remediation-2026-07-25` → `2c82143`
- Branch: `main` at `2c82143` (L-OPS-002 only; Career/Calyx **not** included)

---

## Symptoms

- Production deployment paused
- HTTP 402 / "Deployment temporarily paused"
- Team exceeded Edge Request fair-use limits (~5.4M billing-period total; ~2,000/hr sustained observed)
- Live production continued serving **pre-remediation** build while team blocked corrective deploy

---

## Root cause (confirmed from code)

- Multiple independent Survey polling loops (`useSurveyTeamStatus` per component mount)
- High-frequency listening polling (300ms relay poll)
- Redundant Echo status and link-watch loops
- SSE reconnect without backoff (Cadre, Drop Bay)
- Polling continued while browser tabs were hidden
- Global 5-minute `/api/app-version` poll on all non-localhost hosts

**Not the cause:** Calyx/CADRE/MUTHUR status endpoints, header lights (CSS-only), middleware (none exists).

**Attribution guardrail:** Survey pollers are the **primary identified code-level risk and likely major contributor**. Full 5.4M route distribution requires Vercel route-level logs — not claimed fully explained in code audit alone.

---

## Resolution (shipped)

Commit **`2c82143`** / tag **`ops-edge-remediation-2026-07-25`**

- Shared `createBackgroundPoll()` infrastructure
- Singleton Survey team status poll (one loop per tab regardless of mounted panes)
- Adaptive cadence: 5s pairing, 45s idle, stopped when hidden
- Listening poll: ≥5s active, 30s armed-idle (300ms removed)
- SSE managed reconnect with exponential backoff
- Vercel demo profile: relay/listening opt-in on `*.vercel.app`
- App version poll: 45min, visibility-aware

See **L-OPS-001** (investigation) and **L-OPS-002** (remediation).

---

## Validation (pre-deploy)

| Check | Result |
|-------|--------|
| `pnpm exec tsc --noEmit` | PASS |
| `pnpm probe:edge-polling` | PASS |
| `pnpm probe:survey-hub-functional` | PASS |
| `pnpm probe:calyx-smoke` | PASS |
| `pnpm probe:cyberdeck-compile-scope` | PASS |
| Operational fix isolated from Career/Calyx | YES (uncommitted locally) |

---

## Estimated impact (code-derived, not yet measured in production)

| Scenario | Before | After |
|----------|-------:|------:|
| Survey open (duplicate hooks) | ~9,600–12,000/hr | ~160–1,440/hr |
| Listening armed | ~12,000/hr | ~720/hr |
| Hidden tab | same as visible | ~0 |

**~85–98%** Survey reduction · **~94–99%** listening reduction

---

## Deploy sequence (post-unblock)

1. Submit Vercel **one-time courtesy unblock** (3× limit, 30 days).
2. Deploy **only** `2c82143` — do **not** bundle Career/Calyx work.
3. Verify production deployment SHA matches `2c82143`.
4. Start **48-hour monitoring**; capture baseline metrics.

---

## Monitoring thresholds (daily edge requests)

| Range | Action |
|-------|--------|
| **< 50,000/day** | Healthy for demo |
| **50,000–150,000/day** | Investigate remaining SSE / bot traffic |
| **> 150,000/day** | Disable Survey on Vercel; inspect route-level usage immediately |

---

## Post-validation gate (before resuming Calyx)

- [ ] Production deployment is **`2c82143`**
- [ ] Edge requests trend downward over 24–48 hours
- [ ] Team stays comfortably below Hobby threshold (target <50k/day)
- [ ] Resume **L-CALYX-100/101** from local branch only after above confirmed

---

## Vercel account note

Support offered **one-time courtesy unblock**: 3× usage limit for **30 days**. After 30 days, standard Hobby limits apply. If traffic still exceeds limits post-fix, consider Pro or further Vercel-side Survey restrictions.

---

## Future infrastructure (recommended)

Promote `createBackgroundPoll()` from one-off utility to **runtime infrastructure**:

```text
Runtime
├── Background Scheduler
├── Event Bus
├── SSE Manager
├── Poll Manager          ← createBackgroundPoll() evolution
├── Visibility Manager
└── Lifecycle Manager
```

All live subsystems (Survey, Calyx sync, CADRE status, app-update checks, future Property monitoring) should share scheduling and lifecycle rules instead of inventing per-feature intervals.

Candidate home: `src/lib/runtime/` or extend `src/lib/client/` with a documented Poll Manager module and ADR when next feature needs polling.

---

## Related ledgers

- [L-OPS-001 — Edge Request Explosion (Investigation)](./L-OPS-001-edge-request-explosion.md)
- [L-OPS-002 — Edge Request Remediation](./L-OPS-002-edge-request-remediation.md)
