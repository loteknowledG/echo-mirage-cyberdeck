# L-4 — Persistent Provider Connection State Directive

Status: ACTIVE  
Branch: Legislator  
Authority: tech-lead-legislator  
Date: 2026-05-21

## Objective

Simplify Echo Mirage provider connection behavior into a persistent operational infrastructure model.

Providers must behave like persistent machine links rather than temporary chat-session connections.

The provider interface must minimize operator friction, eliminate unnecessary clicking, and avoid repetitive authentication workflows.

---

## Core Principles

Provider connections are persistent operational states.

Connections should remain active until:

- key validation fails
- operator replaces credentials
- provider becomes unavailable
- heartbeat/authentication check invalidates state

The operator should not repeatedly reconnect providers during normal operation.

---

## Provider Visual States

Provider rows themselves act as status indicators.

No dedicated CONNECT button is required.

### Color States

Disconnected / No Key:
- gray

Connected / Healthy:
- light green

Checking / Refreshing:
- yellow or amber

Invalid Key / Authentication Failure:
- red

---

## Connection Behavior

### Initial Key Entry

If no key exists:

- operator selects provider
- key entry field appears
- provider validates automatically after entry

No separate connect button is required.

---

## Persistent Connected State

Once validated successfully:

- provider remains connected
- provider displays healthy state
- cached model list remains available
- switching providers should not force reconnection

---

## Provider Selection Behavior

### First Click

Selecting a provider:

- activates provider
- loads cached models immediately
- does not refetch models unnecessarily

---

## Cached Model Behavior

Model lists must be cached.

Switching between providers should:

- use cached models immediately
- avoid repeated provider API requests

If no cache exists:

- fetch models once
- cache results after successful retrieval

---

## Refresh Behavior

Selecting the already-active provider again:

- triggers a single model refresh
- updates provider cache

Repeated clicking must not continuously hammer provider APIs.

A cooldown/debounce mechanism should prevent repeated refresh spam.

---

## Triple-Click Credential Maintenance

If the operator clicks the same active provider repeatedly:

1st click:
- select provider

2nd click:
- refresh cached models once

3rd click:
- reveal credential replacement field

Displayed prompt:

`ENTER NEW KEY`

This interaction model intentionally aligns with natural operator behavior patterns.

Operators frequently click repeatedly when attempting credential intervention.

The interface should interpret repeated intentional interaction as escalation toward provider maintenance.

---

## Scope

Update only:

- provider connection panel
- provider interaction behavior
- provider visual state handling
- model caching behavior

Do NOT add:

- modal-heavy account systems
- reconnect workflows
- connection wizards
- excessive settings panels
- multi-step provider dialogs

---

## Validation Requirements

Validation must confirm:

- providers persist after successful validation
- cached models load instantly during provider switching
- provider refresh occurs only on repeated active-provider selection
- repeated refresh requests debounce correctly
- third repeated click reveals credential replacement field
- provider colors correctly reflect operational state

Required validation commands:

```bash
pnpm exec tsc --noEmit
pnpm build