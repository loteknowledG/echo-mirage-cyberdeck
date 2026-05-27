# L-10 — MUTHUR Tool Execution Loop (Phase 1)

## Directive

Implement the first real operational execution loop for MUTHUR.

Current behavior:

* MUTHUR emits fake/simulated tool JSON
* No persistent execution orchestration exists
* No observation → action → verification cycle exists
* No authoritative runtime state machine exists

Goal:
Create a real execution pipeline where MUTHUR can:

1. Request a tool action
2. Execute the tool
3. Observe the result
4. Decide the next action
5. Continue until completion/failure/interruption

This phase is LOCAL ONLY.
No autonomous internet agents.
No unrestricted shell execution.
No self-modifying runtime behavior.

User remains authoritative operator.

---

# OBJECTIVES

## REQUIRED CAPABILITIES

### 1. Execution Loop Runtime

Create a persistent execution controller.

Suggested files:

* `src/lib/muthur/execution/execution-loop.ts`
* `src/lib/muthur/execution/action-runner.ts`
* `src/lib/muthur/execution/execution-types.ts`
* `src/lib/muthur/execution/execution-store.ts`

The loop must support:

* queued actions
* sequential execution
* cancellation
* timeout handling
* result collection
* error propagation
* interruption by user

---

### 2. Canonical Action Schema

Create a normalized action contract.

Example categories:

* shell_command
* open_url
* click
* type_text
* read_file
* write_file
* screenshot
* wait
* ask_user

Every action MUST contain:

* id
* type
* created_at
* source
* payload
* requires_confirmation
* status

Statuses:

* queued
* running
* completed
* failed
* blocked
* cancelled

---

### 3. Structured Result Objects

Every tool execution must return structured results.

Example:

* success boolean
* stdout
* stderr
* exit_code
* duration_ms
* screenshot_path
* metadata
* verification_notes

No raw unstructured string dumping.

---

### 4. MUTHUR Runtime State

Implement active runtime state.

Required tracked fields:

* current_task
* active_action
* queue_length
* execution_mode
* last_result
* last_error
* user_interrupt
* started_at
* heartbeat_at

Execution modes:

* observe
* suggest
* execute

Default mode:

* observe

---

### 5. User Interruptibility

Critical requirement.

User must be able to:

* stop execution
* clear queue
* deny action
* pause execution
* resume execution

Execution loop must check interrupt state between actions.

Never create unstoppable loops.

---

### 6. Safety Layer

Phase 1 restrictions:

* NO arbitrary recursive execution
* NO self-spawning processes
* NO hidden background execution
* NO filesystem deletion outside approved scope
* NO credential harvesting
* NO unrestricted PowerShell/cmd execution

All dangerous actions:

* require explicit user approval
* generate audit entry

---

### 7. Audit Logging

Create append-only operational logs.

Suggested location:

* `.muthur/logs/`

Log:

* timestamp
* action
* source
* result
* approval status
* duration
* errors

Use JSONL format.

Example files:

* `execution-session.jsonl`
* `tool-actions.jsonl`
* `safety-events.jsonl`

---

# UI REQUIREMENTS

## MUTHUR Execution Pane

Add a visible runtime panel.

Must display:

* current action
* queued actions
* running state
* success/failure
* elapsed time
* interrupt controls

Controls:

* STOP
* PAUSE
* RESUME
* CLEAR QUEUE

No fake animations.
Reflect actual runtime state only.

---

# INITIAL TOOL SUPPORT

Phase 1 tools:

* shell_command (restricted)
* read_file
* write_file
* wait
* open_url
* screenshot

Stub unsupported tools honestly.

Do NOT fake success.

Unsupported tools must return:

* status: unsupported

---

# ARCHITECTURE REQUIREMENTS

Execution architecture must support future expansion for:

* browser automation
* computer-use
* DOM inspection
* visual verification
* OCR
* speech
* memory-aware planning
* multi-step workflows

Design for extensibility now.

Do not hardcode browser assumptions into core runtime.

---

# NON-GOALS

NOT part of Phase 1:

* autonomous coding
* agent swarms
* self-replication
* cloud orchestration
* remote execution
* unrestricted shell access
* browser AI reasoning
* self-healing infrastructure

Keep scope controlled.

---

# ACCEPTANCE CRITERIA

Implementation is COMPLETE when:

* MUTHUR can execute a queued action chain
* User can interrupt execution safely
* Runtime state updates live
* Structured results are returned
* Audit logs are written
* Unsupported tools fail honestly
* No fake execution remains
* Typecheck passes
* Build passes

Validation commands:

* `pnpm exec tsc --noEmit`
* `pnpm build`

---

# DESIGN PRINCIPLE

MUTHUR is NOT:

* an autonomous overlord
* a hidden agent
* an invisible daemon

MUTHUR IS:

* an observable operational copilot
* an interruptible ship computer
* a supervised execution system

Core doctrine:
"Observe honestly. Execute deliberately. Verify visibly."

---

# DELIVERABLES

Provide:

1. Changed file list
2. Architectural summary
3. Execution flow explanation
4. Safety model explanation
5. Validation command results
6. Known limitations
7. Suggested Phase 2 next steps

Do not claim functionality not verified.