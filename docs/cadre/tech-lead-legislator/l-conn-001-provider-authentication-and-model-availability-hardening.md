# L-CONN-001 — Provider Authentication and Model Availability Hardening

## Objective

Establish deterministic, observable, and verifiable provider authentication behavior across Echo Mirage.

Current verification demonstrates that:

* Foundation retrieval works
* Document open routing works
* Response visibility works
* Command lifecycle works
* Diagnostics collapse works

However:

```text
/api/cyberdeck-chat
```

can still return:

```text
[MUTHUR] Invalid API key.
```

even when provider keys exist in the environment.

This work item hardens provider authentication, provider selection, credential resolution, and model availability behavior.

---

## Background

Verification evidence confirms:

### Working

```text
/api/muthur/foundation-query
/api/muthur/document-open
```

operate successfully.

### Failing

Observation and general semantic chat requests routed through:

```text
/ api / cyberdeck-chat
```

may return:

```text
[MUTHUR] Invalid API key.
```

despite:

```text
OPENAI_API_KEY present
OPENROUTER_API_KEY present
NEXT_PUBLIC_OPENROUTER_API_KEY present
```

being detected.

This indicates a provider resolution or credential selection problem rather than a memory, foundation, or document-open issue.

---

## Problem Statement

The system currently lacks deterministic answers to:

```text
Which provider was selected?
Which model was selected?
Which credential source was used?
Why did authentication fail?
```

Provider failures are visible but not sufficiently diagnosable.

---

## Goals

### Deterministic Authentication

Every request must clearly identify:

```text
provider
model
credential source
authentication result
```

### Honest Failure Reporting

Failures must report:

```text
provider unavailable
missing key
invalid key
quota exceeded
model unavailable
provider timeout
```

instead of collapsing into generic errors.

### Provider Visibility

The operator must always know:

```text
who answered
which model answered
why a provider failed
```

---

## Implementation Tasks

### 1. Provider Resolution Receipt

Add receipts to every chat request.

Example:

```text
[PROVIDER RECEIPT]

provider=openrouter
model=nex-n2-pro:free
credential_source=env
auth=success
```

or

```text
provider=openrouter
credential_source=env
auth=failed
reason=invalid_api_key
```

---

### 2. Credential Source Tracking

Track the exact source used.

Possible values:

```text
env
ui_saved_key
session_key
provider_override
none
```

Never print secrets.

Only report source.

---

### 3. Provider Health Endpoint

Add:

```text
/api/provider-health
```

Return:

```json
{
  "provider": "openrouter",
  "configured": true,
  "authenticated": true,
  "models_available": 123
}
```

without exposing secrets.

---

### 4. Model Availability Verification

When models are loaded:

```text
/api/cyberdeck-models
```

record:

```text
provider
model count
response status
```

and surface failures.

---

### 5. Connection Panel Status

Display:

```text
CONNECTED
AUTH FAILED
NO KEY
QUOTA
UNAVAILABLE
```

instead of generic failure states.

---

### 6. Chat Path Authentication Verification

Verify:

```text
/ api / cyberdeck-chat
```

uses the same credential resolution path as:

```text
/ api / cyberdeck-models
```

A successful model listing with a failing chat request should be treated as a defect.

---

### 7. OpenCode / OpenRouter Separation

Verify:

```text
OPENCODE
OPENROUTER
OPENAI
```

cannot accidentally share:

```text
provider state
credential state
selected model
```

Each provider must maintain isolated configuration.

---

## Acceptance Tests

### Test 1

Request:

```text
what document is currently visible?
```

Expected:

* provider receipt present
* no invalid API key if provider is healthy
* semantic response returned

---

### Test 2

Force missing key.

Expected:

```text
auth=failed
reason=no_key
```

---

### Test 3

Force invalid key.

Expected:

```text
auth=failed
reason=invalid_api_key
```

---

### Test 4

Model list request.

Expected:

```text
/ api / cyberdeck-models
```

and

```text
/ api / cyberdeck-chat
```

agree on provider availability.

---

### Test 5

Switch providers repeatedly.

Expected:

* no credential bleed
* no stale provider state
* no stale model state

---

## Regression Requirements

Must continue passing:

```powershell
pnpm probe:muthur-document-open
pnpm probe:muthur-foundation-001
pnpm probe:muthur-response-visibility
pnpm probe:muthur-command-console
pnpm exec tsc --noEmit
```

No regressions allowed in:

* Foundation retrieval
* Document open routing
* Response visibility
* Lifecycle completion
* Diagnostics collapse
* Server/client boundary isolation

---

## Deliverable

Implementation PR plus verification target:

```text
JP-L-CONN-001 — Provider Authentication and Model Availability Hardening Verification
```

## Success Definition

When an operator submits:

```text
what document is currently visible?
```

MUTHUR either:

```text
returns a valid semantic answer
```

or

```text
returns a precise, honest provider-auth receipt
```

with enough information to diagnose the failure without inspecting source code.