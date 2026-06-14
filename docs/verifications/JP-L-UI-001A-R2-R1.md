# JP-L-UI-001A-R2-R1 - Live UI Semantic Open + Observation Verification

## Verdict

**PASS**

`L-UI-001A-R2` can be upgraded from `PARTIAL PASS` to `PASS`.

The previous blocker is resolved: `what document is currently visible?` no longer returns `[MUTHUR] Invalid API key.` It routes through the general chat / observation path, avoids `/api/muthur/document-open`, returns an honest visible-document answer, and includes a provider-auth receipt showing OpenRouter auth success from env credentials.

## Commands Run

```powershell
pnpm probe:provider-credentials
pnpm probe:muthur-document-open
pnpm probe:muthur-foundation-001
pnpm probe:muthur-response-visibility
pnpm probe:muthur-command-console
pnpm exec tsc --noEmit
pnpm dev:stop
pnpm dev
```

Note: the first `pnpm exec tsc --noEmit` run failed in corrupted generated `.next/dev/types/*` files. The `.next` build cache was cleared and the same command was rerun successfully. No product source was modified for this.

## Probe Results

| Check | Result |
|---|---:|
| `pnpm probe:provider-credentials` | PASS |
| `pnpm probe:muthur-document-open` | PASS |
| `pnpm probe:muthur-foundation-001` | PASS |
| `pnpm probe:muthur-response-visibility` | PASS |
| `pnpm probe:muthur-command-console` | PASS |
| `pnpm exec tsc --noEmit` after generated cache cleanup | PASS |

Probe evidence:

```text
probe:provider-credentials
  ok server env fallback
  ok server public env fallback
  ok ui_saved_key precedence
  ok client/server credential path alignment
  ok no_key receipt
  ok auth failure classification
  ok provider credential isolation
probe:provider-credentials PASS

probe:muthur-document-open PASS
probe:muthur-foundation-001 PASS
probe:muthur-response-visibility PASS
probe:muthur-command-console PASS
```

## Browser Smoke

PASS.

`GET http://127.0.0.1:3050/cyberdeck` returned HTTP 200 after cold compile.

Observed:

- command input visible
- response channel mounted during and after MUTHUR responses
- diagnostics collapsed throughout (`aria-expanded="false"`)
- gateway panel visible after opening provider panel
- no visible `fs` client bundle error
- no visible `foundation-store` client bundle error

Gateway UI evidence:

```text
# GATEWAY
[ ] OPENCODE
[X] OPENROUTER
[ ] OPENAI
CONNECTION_STATUS: CONNECTED
```

Footer/model evidence:

```text
$nex-n2-pro:free
```

## Provider Health

PASS.

Request:

```text
GET /api/provider-health?provider=openrouter
```

Response:

```json
{
  "provider": "openrouter",
  "configured": true,
  "authenticated": true,
  "models_available": 337,
  "credential_source": "env",
  "receipt": {
    "provider": "openrouter",
    "credential_source": "env",
    "auth": "success",
    "models_available": 337
  }
}
```

No secret values were printed.

## Provider Receipt Evidence

The successful observation chat response included this response header:

```text
X-Muthur-Provider-Receipt:
{"provider":"openrouter","model":"nex-agi/nex-n2-pro:free","credential_source":"env","auth":"success"}
```

Equivalent receipt:

```text
[PROVIDER RECEIPT]
provider=openrouter
model=nex-agi/nex-n2-pro:free
credential_source=env
auth=success
```

## Test 3 - Semantic Document Open

Submitted:

```text
open L-ARCH-001.md
```

Visible MUTHUR response:

```text
[MUTHUR // DOCUMENT OPEN // OPEN]

Resolved: `L-ARCH-001.md`
Title: L-ARCH-001: MUTHUR Capability Authority Doctrine
Words: 956
Opened in operator pane.

[PURPOSE EXCERPT]
# L-ARCH-001: MUTHUR Capability Authority Doctrine

**Status:** Draft
**Era:** 1 - Memory
**Owner:** MUTHUR / Operator
**North Star:** MUTHUR is not a tool user. MUTHUR is a capability authority.

## 1. Core Principle

> *MUTHUR is not a tool user. MUTHUR is a capability authority.*

[RECEIPT]
intent=DOCUMENT_OPEN - resolved=L-ARCH-001.md - source=workspace_resolve - tools=intent:DOCUMENT_OPEN -> resolve_document -> load_document -> retrieve_content
```

Routing evidence:

```text
POST /api/muthur/document-open 200
```

No `/api/cyberdeck-chat` or `observe_operator_pane` route was captured for the document-open command.

Operator pane evidence:

```text
operatorDocName: l-arch-001-muthur-capability-authority-doctrine.md
visible content starts: # L-ARCH-001: MUTHUR Capability Authority Doctrine
```

Lifecycle and diagnostics:

```text
MUTHUR composing...
MUTHUR complete
Diagnostics: aria-expanded="false"
```

## Test 4 - Foundation Origin

Submitted:

```text
Where did you come from?
```

Visible MUTHUR response:

```text
[MUTHUR // FOUNDATION RETRIEVAL // ORIGIN LINEAGE]

I am MUTHUR on Echo Mirage. My continuity lineage includes Samus-Manus.

Foundation-001 (lets-remember-something-ai) is the registered origin artifact. It preserves the earliest surviving continuity record associated with memory persistence, identity, and agency - not as ranked knowledge, but as immutable foundation.

Artifact: .muthur/foundations/lets-remember-something-ai.txt
Classification: FOUNDATION (immutable, read-only)
Source: samus-manus :: skills/mind/hey-let-remember-something-ai.txt
Integrity: PASS
```

Routing evidence:

```text
POST /api/muthur/foundation-query 200
```

Lifecycle and diagnostics:

```text
MUTHUR composing...
MUTHUR complete
Diagnostics: aria-expanded="false"
```

## Test 5 - Observation Command

Submitted:

```text
what document is currently visible?
```

Visible MUTHUR response:

````text
Visible document: `L-ARCH-001.md`
Display title: `l-arch-001-muthur-capability-authority-doctrine.md`

It shows:

```md
# L-ARCH-001: MUTHUR Capability Authority Doctrine

**Status:** Draft
**Era:** 1 - Memory
**Owner:** MUTHUR / Operator
**North Star:** MUTHUR is not a tool user. MUTHUR is a capability authority.
```

Editor state: Markdown, clean, cursor line 1 column 1.
````

Routing evidence:

```text
POST /api/cyberdeck-chat 200
```

The first observation run used the expected observation tool:

```text
MUTHUR // tools: observe_operator_pane
[MUTHUR_TOOLS_USED]observe_operator_pane[/MUTHUR_TOOLS_USED]
```

The repeated header-capture run returned the same honest visible-document answer and included the provider receipt header.

Observation avoided document-open: **yes**. No `/api/muthur/document-open` request was captured for the observation prompt.

Observation invalid-key regression: **not present**. The response did not contain `[MUTHUR] Invalid API key.`

Lifecycle and diagnostics:

```text
MUTHUR composing...
MUTHUR complete
Diagnostics: aria-expanded="false"
```

## Acceptance Matrix

| Requirement | Result |
|---|---:|
| Required probes pass | PASS |
| TypeScript passes | PASS |
| `/cyberdeck` loads | PASS |
| Provider health observable | PASS |
| Provider auth receipt present for chat uplink | PASS |
| `open L-ARCH-001.md` resolves with file-derived content | PASS |
| Document-open avoids `observe_operator_pane` | PASS |
| Foundation origin query passes | PASS |
| Observation query avoids document-open | PASS |
| Observation no longer returns invalid API key | PASS |
| Observation response is semantically honest | PASS |
| Lifecycle reaches complete for all prompts | PASS |
| Diagnostics remain collapsed | PASS |

## Code Changes

No product code was changed during this verification.

Verifier actions only:

- cleared generated `.next` cache after detecting corrupted generated route type files
- created this report: `docs/verifications/JP-L-UI-001A-R2-R1.md`
