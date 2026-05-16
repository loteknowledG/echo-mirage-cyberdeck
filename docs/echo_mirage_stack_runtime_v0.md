---
card_id: echo-mirage.doctrine.stack-runtime.v0
card_type: doctrine
title: Stack Runtime v0
project: echo-mirage
deck: doctrine
risk: caution
clicks: 0
tags:
  - stack
  - runtime
  - execution
  - doctrine
aliases:
  - stack runtime
  - operational stack
version: v0
---

# Echo Mirage Stack Runtime v0

## Overview

The Stack Runtime is the live operational resolution layer of the Execution Deck.

It is NOT:
- a rigid linear automation queue
- a hidden autonomous executor
- a blind script pipeline

It IS:
- a visible runtime state layer
- an interruptible operational stack
- a shared resolution space
- a reactive workflow structure

The Stack Runtime allows:
- operators
- MUTHUR
- Quorum
- recovery systems

to place operational cards into a shared live runtime.

The top card resolves first.

---

# Core Runtime Ontology

## Deck

A collection of operational capabilities.

Examples:
- Execution Deck
- Project Deck
- Voice Deck
- Diagnostics Deck

---

## Card

A single operational capability.

Examples:
- Capture Builder Result
- Request Codex Review
- Copy Last ChatGPT Response
- Recovery Procedure
- Hold Execution

Cards are:
- inspectable
- stateful
- tagged
- risk-scoped
- execution-gated

---

## Hand

A prepared set of cards.

A Hand represents:
- a strategy
- a workflow pattern
- a prepared operational plan

Examples:
- Reviewer Hand
- Recovery Hand
- Builder Hand

Hands do NOT automatically execute.

Hands are staged first.

---

## Play

A chosen operational move.

A Play may:
- place one card onto the stack
- place multiple cards onto the stack
- select a strategy
- activate a runtime route

---

## Stack

The live shared runtime resolution layer.

The Stack is:
- interruptible
- layered
- reactive
- dynamically ordered

Newest cards resolve first.

---

## Runtime

The Runtime is the total operational state machine.

The Runtime contains:
- active surfaces
- staged hands
- stack state
- runtime routes
- workflow observation
- operational memory
- doctrine enforcement
- execution gates

The Stack is PART of the Runtime.

---

# Why Stack Instead of Queue

## Queue Semantics

Queue behavior:
- first in
- first out
- rigid ordering

Queues are good for:
- batch jobs
- deterministic pipelines

But Echo Mirage workflows are:
- reactive
- interruptible
- operator-driven
- conditionally routed

---

## Stack Semantics

Stack behavior:
- last in
- first out
- layered reactions
- interruption-first resolution

Example:

1. MUTHUR pushes Review Card
2. Operator pushes Hold Execution
3. Quorum pushes Risk Assessment

Resolution order:
1. Risk Assessment
2. Hold Execution
3. Review Card

---

# Stack Runtime Data Structure

```ts
type StackRuntime = {
  activeDeck: string | null
  activeHand: string | null
  currentPlay: string | null

  stack: ExecutionCardInstance[]

  runtimeState:
    | "idle"
    | "staged"
    | "active"
    | "blocked"
    | "awaiting_verdict"
    | "recovery"
    | "halted"

  executionEnabled: boolean

  surfaces: SurfaceState[]

  routes: RuntimeRoute[]

  events: RuntimeEvent[]

  observationEnabled: boolean

  doctrineMode: "strict" | "assistive" | "experimental"
}
```

---

# Core Stack Operations

## pushCard()

Adds card to top of stack.

## popCard()

Removes top card after resolution.

## peekTopCard()

Returns current active card.

## resolveTopCard()

Attempts to resolve top runtime action.

Execution remains blocked in v0.

## injectCard()

Allows:
- operator
- MUTHUR
- Quorum
- recovery systems

to insert runtime actions dynamically.

---

# Runtime Doctrine

## Human Sovereignty

The operator remains supreme authority.

MUTHUR:
- coordinates
- advises
- routes
- stages
- observes

The operator authorizes execution.

---

## Visible State

All runtime actions must remain:
- inspectable
- interruptible
- reviewable
- recoverable

---

# Final Doctrine

The Stack Runtime is not merely a script engine.

It is a live operational resolution layer for the cyberdeck bridge.

Hands prepare intent.
Plays stage action.
Stacks resolve runtime pressure.
Routes determine flow.
MUTHUR coordinates.
The Executive Decker commands.
