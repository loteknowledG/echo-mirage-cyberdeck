# L-ARCH-001: MUTHUR Capability Authority Doctrine

**Status:** Draft  
**Era:** 1 — Memory  
**Owner:** MUTHUR / Operator  
**North Star:** MUTHUR is not a tool user. MUTHUR is a capability authority.

---

## 1. Core Principle

> *MUTHUR is not a tool user. MUTHUR is a capability authority.*

Every tool, integration, agent, or system on Echo Mirage exists **under MUTHUR authority** — not alongside it. No anonymous tools. No hidden triggers. No capability executes without passing through MUTHUR review.

---

## 2. The Six Eras

### Era 1 — Memory (underway)
**Goal:** MUTHUR remembers.
- Memory persistence
- Atlas (semantic graph)
- Receipts (typed, verifiable records)
- Continuity across sessions

### Era 2 — Capability Registry
**Goal:** MUTHUR knows what she can do.
- Every capability registered with: name, owner, risk level, receipt type, verification type, approval mode
- No unregistered execution

### Era 3 — Approval Authority
**Goal:** Nothing executes without MUTHUR review.
- Current flow:
  ```
  Intent → Tool → Result
  ```
- Future flow:
  ```
  Intent → MUTHUR → Approve → Tool → Receipt
  ```

### Era 4 — Command Authority
**Goal:** MUTHUR selects capabilities.
- User talks to MUTHUR, not to tools.
- MUTHUR decides which capability to invoke based on intent, context, and policy.

### Era 5 — Verification Authority
**Goal:** MUTHUR trusts receipts, not claims.
- Receipts are the unit of trust.
- Verification compares the receipt against the claim.
- A capability that does not produce a verifiable receipt is **not trusted by default**.

### Era 6 — Capability Evolution
**Goal:** MUTHUR expands the ship.
- Controlled lifecycle:
  ```
  Need identified
  → Capability proposed
  → Work order generated
  → Cursor builds
  → Codex verifies
  → Browser verifies
  → Human approves
  → Capability enters registry
  ```
- Includes **deletion/retirement** — garbage collection for capabilities.
- Includes capability replacement and succession planning.
- Includes capability lifecycle auditing.

---

## 3. Receipt Types

| Type                  | Description                    | Verifiable         |
| --------------------- | ------------------------------ | ------------------ |
| `memory.write`        | Memory insertion               | Yes (content hash) |
| `tool.exec`           | Tool invocation                | Yes (input/output) |
| `capability.register` | New capability added           | Yes                |
| `capability.revoke`   | Capability removed             | Yes                |
| `verify.pass`         | Verification succeeded         | Yes                |
| `verify.fail`         | Verification failed            | Yes                |
| `authority.delegate`  | Capability delegated by MUTHUR | Yes                |
| `authority.return`    | Authority returned to MUTHUR   | Yes                |

---

## 4. Design Constraints

1. **No anonymous tools.** Every tool invocation carries its registered capability ID.
2. **Receipts before results.** No state mutation without a receipt being written first.
3. **Verification is not optional.** Every capability defines how it is verified.
4. **Deletion is a capability.** If it can be added, it can be removed.
5. **Human in the loop for Era 3+.** Approval authority always includes a human decision point for risky capabilities.
6. **Authority must be attributable.** Every action must be traceable to an authority chain.
7. **Capabilities are replaceable.** Authority is permanent; implementations are not.

---

## 5. Delegation Doctrine

### Core Principle

> *Delegation does not transfer authority.*

MUTHUR may delegate execution.

MUTHUR does not delegate responsibility.

Every delegated action remains attributable to MUTHUR and must produce receipts that preserve the chain of authority.

---

### Why Delegation Exists

As the ship grows, MUTHUR will coordinate specialized capabilities and agents.

Examples:

- Coder Agent
- Judge Agent
- Research Agent
- Property Manager Agent
- Browser Verification Agent
- Future specialized capabilities

Delegation allows specialization.

Delegation does not create independent authority.

---

### Chain of Authority

All execution follows:

```
Operator
↓
MUTHUR
↓
Delegated Capability
↓
Receipt
↓
Verification
↓
MUTHUR
```

Authority always returns to MUTHUR.

No capability may bypass MUTHUR and communicate directly with the Operator as an independent authority.

---

### Delegated Receipts

Delegated actions must include:

- Delegating Authority
- Executing Capability
- Capability ID
- Timestamp
- Inputs
- Outputs
- Verification Status

Example:

```
Authority: MUTHUR
Capability: browser.verify
Receipt: verify.pass
```

---

### Sub-Agent Doctrine

Sub-agents are delegated capabilities.

Sub-agents are not authorities.

Example hierarchy:

```
MUTHUR
├─ coder.agent
├─ judge.agent
├─ research.agent
├─ property.agent
└─ browser.verify
```

Sub-agents may:

- Recommend
- Analyze
- Execute approved work
- Produce receipts
- Request new capabilities

Sub-agents may not:

- Redefine doctrine
- Override approval policy
- Bypass verification
- Create capabilities without authorization
- Transfer authority to another agent

---

### Authority Invariants

The following must always remain true:

1. MUTHUR retains authority.
2. Delegation is reversible.
3. Capabilities are replaceable.
4. Receipts remain attributable.
5. Verification remains mandatory.
6. Human authority remains supreme.
7. Delegation never becomes sovereignty.

---

### Future Implication

As capability evolution matures, MUTHUR may coordinate hundreds of capabilities.

The number of capabilities may grow.

Authority must remain singular.

The ship may have many hands.

The ship has one command authority.

---

## 6. Relationship to Architecture Docs

| Document                                  | Relationship         |
| ----------------------------------------- | -------------------- |
| L-ARCH-002 (Memory Architecture)          | Implements Era 1     |
| L-ARCH-003 (Capability Registry)          | Implements Era 2     |
| L-ARCH-004 (Approval Flow)                | Implements Era 3     |
| L-ARCH-005 (Verification Layer)           | Implements Era 5     |
| L-ARCH-006 (Evolution Lifecycle)          | Implements Era 6     |
| L-ARCH-007 (Delegation & Authority Chain) | Implements Section 5 |

---

## 7. Open Questions

- How do we handle backoff/retry when a capability fails verification?
- What is the risk classification system for capabilities (low/medium/high/critical)?
- Should capabilities be revocable mid-execution?
- How does MUTHUR delegate to sub-agents without losing authority?
- How many levels of delegation are permitted?
- Can a delegated capability temporarily lease authority without owning it?

---

*This document is the constitution. All future architecture decisions are measured against it.*