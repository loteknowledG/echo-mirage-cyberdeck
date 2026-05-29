# L-16 — Execution Contract & Work Order Translation Act
## Classification: EXECUTIVE LEGISLATION
## Status: ACTIVE
## Authority: USER REQUISITION AUTHORITY
## Applies To: CODEX / CURSOR / MUTHUR / OPENCODE / FUTURE EXECUTION AGENTS

---

# PURPOSE

This legislation establishes the required distinction between doctrine and execution.

Doctrine defines what is true.

Execution contracts define what must be done.

No agent may treat acknowledgment of doctrine as completion of implementation.

---

# CORE PRINCIPLE

Acknowledgment is not execution.

Understanding is not implementation.

A PASS requires observable work, receipts, and verification.

---

# PROBLEM STATEMENT

Operational agents may drift into conversational acknowledgment mode when given doctrine-heavy instructions.

This causes:
- no file changes
- no task decomposition
- no verification
- no implementation receipts
- no runnable output
- false sense of progress

This legislation prevents doctrine from being mistaken for completed work.

---

# TWO-LAYER OPERATING MODEL

All major work shall be separated into two layers:

## Layer 1 — Doctrine / Law / Architecture

Defines:
- principles
- authority
- boundaries
- operating modes
- safety constraints
- philosophy
- lifecycle governance

Doctrine is not itself an implementation task.

## Layer 2 — Execution Contract

Defines:
- objective
- deliverables
- files to inspect
- files to change
- constraints
- verification commands
- acceptance criteria
- required output format

Execution contracts turn doctrine into buildable work.

---

# EXECUTION CONTRACT REQUIRED

Before implementing doctrine-driven work, an agent must produce or receive an execution contract.

An execution contract must include:

```text
Objective:
Required Deliverables:
Out of Scope:
Constraints:
Files/Areas To Inspect:
Files/Areas Likely To Change:
Verification Commands:
Acceptance Criteria:
Required Final Report:
```

If these fields are missing, the agent must request clarification or produce a proposed execution contract before coding.

---

# ACKNOWLEDGMENT LIMIT

Agents may acknowledge doctrine, but acknowledgment alone is never sufficient.

Invalid completion:

```text
Acknowledged. I will treat L-15 as active doctrine.
```

Valid completion requires:

```text
Implemented:
- files changed
- behavior added
- tests run
- verification passed
- receipts provided
```

---

# WORK ORDER TRANSLATION DUTY

When an agent receives legislation, doctrine, or a conceptual directive, the agent must translate it into a concrete work order before implementation.

Translation must identify:

* what behavior changes
* what UI changes
* what state changes
* what safety gates change
* what tests must exist
* what must not change

The agent must not silently improvise scope.

---

# EXECUTION DIRECTIVE FORMAT

All actionable work orders should use this format:

```text
EXECUTION DIRECTIVE

Objective:

Required Deliverables:

Out of Scope:

Constraints:

Implementation Notes:

Verification:

Acceptance Criteria:

Required Final Report:
```

---

# EXAMPLE EXECUTION DIRECTIVE

```text
EXECUTION DIRECTIVE

Objective:
Implement Observe Mode UI and operational behavior.

Required Deliverables:
- Add persistent Observe header glyph.
- Add Observation Bus state object.
- Prevent action execution in Observe Mode.
- Add interrupt queue scaffold.
- Add continuity log events for Observe transitions.

Out of Scope:
- No screenshot system.
- No autonomous clicking.
- No real dispatch.
- No major layout refactor.

Constraints:
- Preserve existing cyberdeck rail layout.
- Preserve mobile behavior.
- Observe Mode remains read-only.
- Human requisition authority remains sovereign.

Implementation Notes:
- Use the official Observe glyph:
  [[]] ][3 ((5 ]E ][2 \/ ]E
- Observation Bus should expose route, active pane, visible document, selected ticket, selected property, active operator, and current mode.
- Action execution pipeline must check current mode before executing.

Verification:
- Run typecheck.
- Run existing predeploy regression tests.
- Add/verify tests for Observe Mode blocking mutation actions.
- Confirm Observe glyph is visible in header/status area.

Acceptance Criteria:
- Observe Mode status is visible.
- Observe Mode blocks mutation actions.
- MUTHUR can summarize visible Observation Bus state.
- Continuity logs record mode transitions.
- No mobile shell regression occurs.

Required Final Report:
- Files changed.
- Summary of changes.
- Verification commands and results.
- Screenshots or receipts if UI changed.
- Known limitations.
```

---

# REQUIRED FINAL REPORT FORMAT

When completing implementation, the agent must report:

```text
RESULT: PASS / REVISE / BLOCKED

Summary:

Files Changed:

Behavior Added:

Verification Commands:
- command:
  result:

Acceptance Criteria:
- criterion:
  status:

Risks / Known Limits:

Receipts:
```

No final report may claim PASS without verification evidence.

---

# RECEIPT REQUIREMENT

Every implementation must produce receipts appropriate to the work.

Receipts may include:

* git diff
* test output
* screenshot
* log excerpt
* browser verification
* generated report
* changed file list

Claims without receipts are advisory only.

---

# SCOPE CONTROL

Agents must avoid expanding work beyond the execution contract.

If additional issues are found, agents must record them as:

```text
FOLLOW-UP REQUIRED
```

They must not silently include unrelated refactors.

---

# DOCTRINE TO IMPLEMENTATION PIPELINE

The approved lifecycle is:

1. Doctrine created
2. Execution contract drafted
3. Human or executive agent approves scope
4. Implementation begins
5. Verification runs
6. Receipts produced
7. MUTHUR/user acceptance review
8. Release decision

Skipping this lifecycle is a governance violation.

---

# AGENT ROLE EXPECTATIONS

## CODEX

Primary implementation agent.

Must:

* produce scoped diffs
* run tests
* provide receipts
* avoid unapproved expansion

## CURSOR

Chaos tester / exploratory reviewer.

Must:

* probe regressions
* test UX failure modes
* identify edge cases
* avoid unsanctioned architecture rewrites

## MUTHUR

Continuity authority / acceptance officer.

Must:

* observe
* verify
* summarize
* enforce doctrine
* reject unverified claims

## USER

Requisition authority.

May:

* approve execution
* redirect scope
* reject results
* retake command
* authorize escalation

---

# ANTI-DRIFT RULE

If an agent begins philosophizing instead of executing, the operator may issue:

```text
EXECUTION CONTRACT REQUIRED
```

The agent must stop commentary and produce a concrete execution contract.

---

# FINAL PRINCIPLE

Doctrine gives direction.

Execution contracts create motion.

Verification proves arrival.

No agent may confuse talking about the mission with completing the mission.