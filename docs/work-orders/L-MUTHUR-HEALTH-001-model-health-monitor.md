# L-MUTHUR-HEALTH-001 — Model Health Monitor (Self-Diagnosis)

**Status:** Spec ready — **queued after L-CYBERDECK-001 P2**  
**Priority:** P1 (operator UX / reliability)  
**Owner:** MUTHUR / Cyberdeck  
**Depends on:** [L-CYBERDECK-001](./L-CYBERDECK-001-cyberdeck-app-extraction.md) P2 complete (chat send path extracted)  
**Related:** [L-CONN-001](../cadre/tech-lead-legislator/l-conn-001-provider-authentication-and-model-availability-hardening.md) (auth vs model fitness are distinct diagnoses)

---

## Objective

When the active **provider/model** is inappropriate (rate-limited, too weak for agent mode, chronically slow), Echo Mirage should **self-diagnose** and surface a clear verdict in the **Diagnostics** panel — not leave the operator to pattern-match raw errors.

**Non-goals:**
- Auto-switching models without operator consent (v1)
- Replacing provider auth hardening (L-CONN-001)
- LLM-based “is this output sane?” judging (v1 uses cheap heuristics only)

---

## Problem (observed 2026-07-08)

Session with `openrouter / nvidia/nemotron-nano-12b-v2-vl:free`:

| Symptom | Raw diagnostic | Operator experience |
|---------|----------------|---------------------|
| No reply | `Upstream idle timeout exceeded` | “MUTHUR stopped talking” |
| Empty turn | `Model returned no text` | Silent failure |
| Opaque fail | `Provider returned error` | Blame unclear |
| Fake tools | `<tool_call>` printed as chat text | Model can’t agent |
| Garbled | CEDAK/DERBY hallucination blocks | “Broken brain” |

Individual errors are already logged (`format-uplink-error.ts`, `[PROVIDER RECEIPT]`). **No aggregator** counts failures per model and recommends action.

---

## Architecture

```text
Turn outcomes (send hook / chat client)
    ↓
model-health-monitor.ts     # pure scorer — unit tested
    ↓
use-model-health.ts         # rolling window per (provider, model)
    ↓
appendMuthurDiagnosticEntry → Diagnostics panel
```

**Integration point (post-P2):** subscribe in `use-muthur-chat-send.ts` or a thin bridge called from send `finally` — after P2.3 extraction the hook is the stable seam.

---

## Signals (rolling window)

Track per `(providerId, modelId)` over last **N = 8** turns:

| Signal | Source | Classification |
|--------|--------|----------------|
| `idle_timeout` | error text / uplink abort | `rate_limited_or_overloaded` |
| `provider_error` | HTTP / stream error | `provider_fault` |
| `empty_reply` | zero display text after stream | `weak_or_overloaded` |
| `typed_tool_call` | assistant text matches `<tool_call>` / `<function=` | `agent_incapable` |
| `garbled_output` | high non-ASCII ratio or known junk tokens | `weak_model` |
| `first_token_slow` | composeStartedAt → first delta > threshold | `slow` |
| `success` | assistant message with text, no error | `ok` |

Reuse existing strings from `format-uplink-error.ts` where possible — do not duplicate HTTP parsing.

---

## Verdict tiers

| Tier | Condition (example) | Diagnostic line |
|------|---------------------|-----------------|
| **NOMINAL** | ≥ 6/8 success | `[HEALTH] MODEL HEALTH // NOMINAL // {provider}/{model} ({ok}/{N} ok)` |
| **DEGRADED** | 3–5 failures in window | `[HEALTH] MODEL HEALTH // DEGRADED // {fail} failures in last {N} turns` |
| **FAILING** | ≥ 6 failures in window OR 3 consecutive same-class | `[HEALTH] MODEL HEALTH // FAILING // {provider}/{model}` |
| **ADVICE** | appended on DEGRADED/FAILING | See table below |

### Advice mapping

| Dominant failure class | Operator advice (diagnostics) |
|------------------------|-------------------------------|
| `idle_timeout`, `provider_error`, 429 | Free tier or provider saturated — switch model in Gateway (s) or add API key |
| `empty_reply` + `typed_tool_call` | Model too weak for AGENT posture — use tool-capable model or switch to PLAN |
| `first_token_slow` | High latency — try flash/turbo variant |
| Mixed | Generic: check Gateway provider + model selection |

Emit verdict **once per tier change** (dedupe like diagnostics `repeatCount`).

---

## Deliverables

| ID | Module | Path |
|----|--------|------|
| H1.1 | Turn outcome types + classifier | `src/lib/muthur-core/model-health-types.ts` |
| H1.2 | Rolling-window scorer | `src/lib/muthur-core/model-health-monitor.ts` |
| H1.3 | React bridge hook | `src/features/cyberdeck/muthur/use-model-health.ts` |
| H1.4 | Wire from send path | `use-muthur-chat-send.ts` (or `muthur-chat-client.ts` callback) |
| H1.5 | Unit tests | `src/lib/muthur-core/__tests__/model-health-monitor.test.ts` |
| H1.6 | Probe (optional) | `scripts/probe-model-health-monitor.ts` |

---

## PR sequence (after P2)

| Order | PR | Scope |
|------:|-----|-------|
| 1 | `feat: model health monitor core` | H1.1–H1.2 + tests |
| 2 | `feat: wire model health to diagnostics` | H1.3–H1.4 |

One in-flight PR at a time (same queue discipline as L-CYBERDECK-001).

---

## Verification

**Automated:**
- Unit tests: feed synthetic turn sequences → assert NOMINAL / DEGRADED / FAILING
- `pnpm probe:muthur-response-visibility` stays green

**Manual:**
1. Select known-bad free model → send 3 messages → Diagnostics shows FAILING + advice
2. Switch to working model → send 2 messages → NOMINAL
3. AGENT posture + weak model typing `<tool_call>` → `agent_incapable` advice

Brief: `docs/verifications/VERIFY-L-MUTHUR-HEALTH-001.md` (create at implementation)

---

## Sequencing rule

> **Do not start L-MUTHUR-HEALTH-001 until L-CYBERDECK-001 P2.5 merged.**

Rationale: send path and diagnostics wiring stabilize after P2; avoids merge conflicts in `cyberdeck-app.tsx` / `use-muthur-chat-send.ts`.

---

## Backlog (same program, separate tickets)

| ID | Item | Notes |
|----|------|-------|
| B1 | Survey Hub connect-wait blocks chat | UX bug — pending team ID swallows turns |
| B2 | Stale `DECK_COMMAND_INPUT` e2e selector | Chore PR |

---

## Conductor cross-link

Tracked on [L-CYBERDECK-001-CONDUCTOR](./L-CYBERDECK-001-CONDUCTOR.md) → **Post-P2 program queue**.
