# MUTHUR Shared Embodiment Doctrine

## Overview

Echo Mirage is evolving toward a cooperative embodied operating environment where:

- the human operator
- MUTHUR
- orchestration systems

share a cyberdeck through explicit, visible, interruptible coordination.

This is not unrestricted automation.

This is negotiated operational embodiment.

---

# MU/TH/UR

| Segment | Meaning | Operational Meaning |
|---|---|---|
| MU | MUTHUR Uses | MUTHUR currently has bounded operational control |
| TH | Thread Handoff | control arbitration and negotiated transfer |
| UR | User Retake | human override and reclaim authority |

The system is designed around:

- visible ownership
- bounded control
- interruptibility
- operational trust
- continuity preservation

---

# Core Principle

All control is negotiated.

Human override is absolute.

Embodiment must remain interruptible.

---

# Shared Embodiment Model

The cyberdeck is treated as:

> a shared operational vessel.

Not:

> a hidden autonomous agent environment.

The operator and MUTHUR cooperate through:

- communication
- indication
- bounded handoffs
- observable execution
- explicit ownership transfer

---

# Operational Modes

| Mode | Description |
|---|---|
| OBSERVE | MUTHUR may observe and communicate only |
| INDICATE | MUTHUR may move a visible pointer/highlighter |
| ASSIST | MUTHUR may perform bounded assistance actions |
| USE | MUTHUR temporarily receives operational control |
| RETAKE | User immediately reclaims control |

---

# Pointer vs Action Doctrine

MUTHUR possesses two separate operational capabilities:

## Pointer Hand

Used for:

- indicating
- highlighting
- circling UI elements
- guiding navigation
- visual communication

The pointer hand should usually remain available.

Pointer movement alone should not alter system state.

---

## Action Hand

Used for:

- clicking
- typing
- executing actions
- issuing hotkeys
- manipulating applications

The action hand requires:

- explicit handoff
- capability scoping
- timeout limits
- interruption support
- logging

---

# Thread Handoff (TH)

Control transfers are negotiated through the Thread Handoff layer.

Example lifecycle:

```text
[UR]
User has control

UR → TH
handoff requested

[TH]
scheduler arbitration
permissions checked
scope validated

TH → MU
control granted

[MU]
bounded execution active

MU → TH
completed / timeout / interrupted

TH → UR
control returned
```

---

# Control Lease Model

Control should be granted through revocable leases.

Example:

```json
{
  "owner": "MUTHUR",
  "scope": ["browser", "clipboard"],
  "expiresAt": "2026-05-14T23:50:00Z",
  "revocable": true,
  "reason": "open documentation panel"
}
```

---

# Communication Layer

MUTHUR should remain continuously communicative.

The system should support:

- text chat
- voice output
- hearing/listening status
- request-control actions
- status indicators
- visible operational mode display

Suggested UI:

```text
┌─────────────────────────────┐
│ SCREEN / CYBERDECK VIEW     │
│                             │
│ human cursor                │
│ MUTHUR pointer              │
│ highlight overlays          │
│                             │
└─────────────────────────────┘

┌─────────────────────────────┐
│ MUTHUR COMMS                │
│ chat                        │
│ voice status                │
│ hearing indicator           │
│ request control             │
│ grant / retake              │
└─────────────────────────────┘
```

---

# MouseMux Direction

MouseMux-style multi-cursor systems may become useful as:

- embodiment visualization layers
- shared pointer systems
- visible operational ownership indicators

However:

MouseMux should not replace orchestration logic.

The true authority system remains:

```text
MU/TH/UR
```

with:

- scheduler arbitration
- capability boundaries
- interruptibility
- explicit ownership

---

# Human Sovereignty Doctrine

The operator must always retain:

- override authority
- interruption authority
- visibility into execution
- ownership of final decisions

MUTHUR must never silently seize control.

---

# North Star

> MUTHUR may always communicate.
>
> MUTHUR may usually indicate.
>
> MUTHUR may only use after handoff.
>
> User may always retake.

---

# Final Principle

Echo Mirage is strongest when it remains:

- grounded
- coherent
- visible
- continuity-preserving
- operationally trustworthy

The goal is not fake AGI mythology.

The goal is:

> coherent cooperative operational continuity.
