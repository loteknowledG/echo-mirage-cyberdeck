# ADR-CONN-001 — Unified Provider Credential Resolution

**Status:** Accepted  
**Date:** 2026-06-07  
**Work order:** L-CONN-001  
**Verification:** JP-L-CONN-001

## Decision

Echo Mirage resolves provider credentials through a single server-side resolver (`provider-credentials.server.ts`) aligned with client outbound resolution (`provider-credentials.ts`). Both `/api/cyberdeck-models` and `/api/cyberdeck-chat` use the same precedence: env → session/build keys → UI-saved key → none.

## Context

Models list and chat uplink previously used different credential paths, causing `Invalid API key` on chat when env keys were valid for model fetch.

## Consequences

- Provider receipts (`X-Muthur-Provider-Receipt`) on models, chat, and health endpoints
- Connection panel shows deterministic `CONNECTION_STATUS`
- No secrets in diagnostics or client responses
- Stale `localStorage` keys cannot silently override valid env credentials without explicit operator action

## Keywords

provider authentication, credentials, unified resolution, openrouter, connection
