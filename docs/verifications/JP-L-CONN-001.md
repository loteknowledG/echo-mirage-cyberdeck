# JP-L-CONN-001 — Provider Authentication and Model Availability Hardening Verification

## Verdict

**PASS** (probe + architecture)

Provider credential resolution is unified across `/api/cyberdeck-models` and `/api/cyberdeck-chat`. Every uplink request can emit a structured provider receipt without exposing secrets.

---

## Root Cause (Confirmed)

| Symptom | Cause |
|---------|-------|
| Models list succeeds, chat returns `Invalid API key` | Chat sent `providerKeys[provider]` only; models used `DEFAULT_CLIENT_PROVIDER_KEYS` fallback — mismatched credential paths |
| Env keys ignored for model fetch | `fetchModelsForProvider` returned early when no client key, never reaching server env resolution |
| Server ignored `NEXT_PUBLIC_*` | `DEFAULT_PROVIDER_KEY_ENV` only checked private env vars |
| Stale `localStorage` key | User-saved invalid key overrode valid env credentials |

---

## Fix Summary

### Unified credential resolution

`src/lib/server/provider-credentials.server.ts` — single resolver for:

- `env` — `OPENROUTER_API_KEY`, `OPENAI_API_KEY`, `OPENCODE_API_KEY`, etc.
- `session_key` — `NEXT_PUBLIC_*` build-time keys
- `ui_saved_key` — operator-saved gateway key
- `provider_override` — probe/test override
- `none`

### Client alignment

`src/lib/provider-credentials.ts` — `resolveOutboundProviderCredentials()` used by both model fetch and chat uplink.

### Provider receipts

`X-Muthur-Provider-Receipt` header on:

- `/api/cyberdeck-models`
- `/api/cyberdeck-chat` (success + auth failure)
- `/api/provider-health`

Diagnostics receive formatted `[PROVIDER RECEIPT]` lines.

### Provider health endpoint

`GET /api/provider-health?provider=openrouter` — configured/authenticated/model count without secrets.

### Connection panel

Gateway shows `CONNECTION_STATUS: CONNECTED | AUTH FAILED | NO KEY | QUOTA | UNAVAILABLE | LINKING`.

---

## Files Changed

| File | Change |
|------|--------|
| `src/lib/provider-credentials.ts` | Client outbound resolution + connection labels |
| `src/lib/server/provider-credentials.server.ts` | Server resolver, receipts, failure classification |
| `src/app/api/cyberdeck-models/route.ts` | Unified auth + receipts + `model_count` |
| `src/app/api/cyberdeck-chat/route.ts` | Unified auth + `providerReceipt` |
| `src/app/api/provider-health/route.ts` | **New** health probe |
| `src/lib/muthur-core/muthur-provider-chat.ts` | Receipt headers on stream/error |
| `src/features/cyberdeck/cyberdeck-app.tsx` | Aligned key paths, receipt diagnostics, panel status |
| `scripts/probe-provider-credentials.ts` | **New** acceptance probes |

---

## Commands Run

```powershell
pnpm probe:provider-credentials
pnpm probe:muthur-document-open
pnpm probe:muthur-foundation-001
pnpm probe:foundation-server-boundary
pnpm probe:muthur-response-visibility
pnpm probe:muthur-command-console
pnpm exec tsc --noEmit
```

---

## Acceptance Tests

| Test | Result |
|------|--------|
| T1 Observation chat with healthy provider | Receipt emitted; credential paths aligned (live UI retest when dev server up) |
| T2 Missing key → `auth=failed reason=no_key` | PASS (probe) |
| T3 Invalid key → `auth=failed reason=invalid_api_key` | PASS (probe classifier) |
| T4 Models + chat credential agreement | PASS (probe `client/server credential path alignment`) |
| T5 Provider isolation (no credential bleed) | PASS (probe) |

---

## Receipt Example

```text
[PROVIDER RECEIPT]
provider=openrouter
model=nex-n2-pro:free
credential_source=env
auth=success
```

Failure:

```text
[PROVIDER RECEIPT]
provider=openrouter
credential_source=ui_saved_key
auth=failed
reason=invalid_api_key
```

---

## Regression

All required probes PASS. Foundation, document-open, visibility, and server boundary unchanged.

---

## Operator Notes

- Clear stale gateway keys if env auth works for models but chat fails: Connection panel → replace key.
- Health check: `GET http://127.0.0.1:3050/api/provider-health?provider=openrouter`
- Receipts appear in collapsed Diagnostics after each uplink.
