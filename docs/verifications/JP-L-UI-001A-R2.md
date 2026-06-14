# JP-L-UI-001A-R2 - Live UI Semantic Open Command Verification

## Verdict

**PARTIAL PASS**

The R2 deterministic document-open path passes in both the probe and the live Cyberdeck UI:

`open L-ARCH-001.md -> /api/muthur/document-open -> resolved file -> excerpt -> operator pane open -> visible receipt`

The previous R1 failure mode did not recur for the document-open command. The response did not say `L-ARCH-001.md is not currently open`, and the command did not route through `observe_operator_pane`.

Full PASS is blocked by the third required live prompt, `what document is currently visible?`. That prompt correctly routed to the general chat path instead of document-open, but `/api/cyberdeck-chat` returned `[MUTHUR] Invalid API key.` from the configured provider. `.env.local` contains OpenRouter/OpenAI key variables, but values were not printed and the provider still rejected the live chat request.

## Commands Run

```powershell
pnpm probe:muthur-document-open
pnpm probe:muthur-foundation-001
pnpm probe:muthur-response-visibility
pnpm probe:muthur-command-console
pnpm exec tsc --noEmit
pnpm dev:stop
pnpm dev
```

Additional browser/dev checks:

```text
GET  http://127.0.0.1:3050/cyberdeck
POST http://127.0.0.1:3050/api/muthur/document-open
POST http://127.0.0.1:3050/api/muthur/foundation-query
POST http://127.0.0.1:3050/api/cyberdeck-chat
```

The in-app Browser was attempted first but was unavailable in this session (`Browser is not available: iab`). Playwright fallback was used against a clean local dev server.

## Probe Results

| Check | Result |
|---|---:|
| `pnpm probe:muthur-document-open` | PASS |
| `pnpm probe:muthur-foundation-001` | PASS |
| `pnpm probe:muthur-response-visibility` | PASS |
| `pnpm probe:muthur-command-console` | PASS |
| `pnpm exec tsc --noEmit` | PASS |

`probe:muthur-document-open` evidence:

```text
probe:muthur-document-open
  ok intent classification
  ok resolve L-ARCH-001.md
  ok semantic document open response
  ok observation vs document routing
probe:muthur-document-open PASS
```

## Browser Smoke

PASS.

`GET /cyberdeck` returned HTTP 200. The live UI rendered with:

- visible `MUTHUR command input`
- mounted `[data-muthur-response]` channel
- diagnostics collapsed: `aria-expanded="false"`
- no visible `Can't resolve 'fs'`
- no visible `foundation-store` client-bundle error

Initial footer evidence:

```text
$deepseek-v4-flash-free
▶Diagnostics (2)
aria-expanded="false"
```

## Transcript Evidence

### 1. Document Open

Submitted:

```text
open L-ARCH-001.md
```

Lifecycle evidence:

```text
MUTHUR composing...
MUTHUR complete
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

Every tool, integration, agent, or system on Echo Mirage exists **under MUTHUR authority** - not alongside it.

[RECEIPT]
intent=DOCUMENT_OPEN · resolved=L-ARCH-001.md · source=workspace_resolve · tools=intent:DOCUMENT_OPEN -> resolve_document -> load_document -> retrieve_content
```

Routing evidence:

```text
POST /api/muthur/document-open 200
```

Response JSON included:

```json
{
  "handled": true,
  "operator_open": {
    "filePath": "L-ARCH-001.md",
    "fileName": "L-ARCH-001.md",
    "mode": "edit"
  },
  "resolution": {
    "status": "resolved",
    "relative_path": "L-ARCH-001.md",
    "basename": "L-ARCH-001.md"
  }
}
```

Operator pane evidence:

```text
operatorDocName: l-arch-001-muthur-capability-authority-doctrine.md
visible editor text: # L-ARCH-001: MUTHUR Capability Authority Doctrine
```

Diagnostics evidence:

```text
▶Diagnostics (3)
aria-expanded="false"
```

Document-open avoided `observe_operator_pane`: **yes**. The only network route captured for this command was `/api/muthur/document-open`.

### 2. Foundation Origin

Submitted:

```text
Where did you come from?
```

Lifecycle evidence:

```text
MUTHUR composing...
MUTHUR complete
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

Diagnostics evidence:

```text
▶Diagnostics (5)
aria-expanded="false"
```

### 3. Current Visible Document Observation

Submitted:

```text
what document is currently visible?
```

Lifecycle evidence:

```text
MUTHUR composing...
MUTHUR complete
```

Routing evidence:

```text
POST /api/cyberdeck-chat 200
```

Document-open route avoided for observation: **yes**. No `/api/muthur/document-open` request was captured for this prompt.

Visible MUTHUR response:

```text
[MUTHUR] Invalid API key.
```

Diagnostics evidence:

```text
▶Diagnostics (5)
aria-expanded="false"
```

This prevents full acceptance of the observation portion. The route selection was correct, but the provider-auth response did not verify honest observation behavior.

## Provider/Auth Notes

Non-secret local environment metadata:

```text
.env.local: OPENAI_API_KEY present
.env.local: OPENROUTER_API_KEY present
.env.local: NEXT_PUBLIC_OPENROUTER_API_KEY present
```

No secret values were printed. Despite the variables being present, the live `/api/cyberdeck-chat` response for the observation prompt was:

```text
[MUTHUR] Invalid API key.
```

## Acceptance Matrix

| Requirement | Result |
|---|---:|
| Required probes pass | PASS |
| TypeScript passes | PASS |
| `/cyberdeck` loads HTTP 200 | PASS |
| Command input visible | PASS |
| Response channel mounted | PASS |
| Diagnostics collapsed | PASS |
| No `fs` / foundation-store client errors | PASS |
| `open L-ARCH-001.md` resolves semantically | PASS |
| Response includes expected doctrine excerpt | PASS |
| Receipt visible | PASS |
| Operator pane opens/displays L-ARCH-001 content | PASS |
| Document-open avoids `observe_operator_pane` | PASS |
| Foundation-001 origin answer visible | PASS |
| Observation command avoids document-open | PASS |
| Observation command answers honestly | BLOCKED - provider returned invalid API key |

## Code Changes

No product code changes were made by this verifier pass.

New verification artifact:

```text
docs/verifications/JP-L-UI-001A-R2.md
```
