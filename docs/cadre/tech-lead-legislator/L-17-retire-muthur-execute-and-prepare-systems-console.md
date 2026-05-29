# L-17 — Retire MUTHUR Execute and Prepare Systems Console

## Directive

Remove the MUTHUR Execute pane, tab, state, and associated dead code if it provides no unique functionality.

The goal is to reduce bridge noise and prepare for a future Systems Console that exposes MUTHUR capabilities, posture controls, diagnostics, and service status.

---

## Background

Current findings:

* MUTHUR Execute does not have a clearly defined operational role.
* The panel displays:

  * Active Action
  * Queue
  * Recent Results
  * Loop Status
* The execution loop architecture was never fully implemented.
* The current Echo Mirage doctrine emphasizes:

  * Observe
  * Overwatch
  * Verify
  * Receipts
  * Continuity
  * Human-supervised coordination

The panel appears to be a remnant of an earlier autonomous-agent architecture and no longer aligns with current operational goals.

---

## Objectives

### 1. Audit

Identify all references to:

* MUTHUR Execute
* Execute Pane
* Execute Tab
* Queue
* Loop Status
* Active Action
* Recent Results

Document:

* Components
* State stores
* Hooks
* Commands
* Routes
* Persistence/localStorage
* Keyboard shortcuts

Determine whether any functionality would be lost if removed.

---

### 2. Removal

If no unique functionality exists:

Remove:

* Execute tab
* Execute pane
* Execute-specific state
* Execute-specific UI
* Execute styling
* Execute icons/glyphs
* Dead imports
* Dead stores
* Dead commands

Preserve:

* Existing command execution mechanisms
* Existing tool routing
* Existing receipts
* Existing artifacts

Execution functionality should continue to exist internally where required.

---

### 3. Navigation Cleanup

Update any layouts, split panes, tab systems, rail navigation, and persistence mechanisms affected by the removal.

Ensure:

* No blank slots remain.
* No orphaned tab IDs remain.
* No invalid saved layouts crash the application.

Provide migration handling if previous layouts reference the Execute pane.

---

### 4. Systems Console Planning

Do NOT implement the Systems Console in this work order.

Instead, leave a documented placeholder architecture for a future page/pane:

Systems Console responsibilities:

* Global Posture

  * Standby
  * Observe
  * Overwatch
  * Verify
  * Recovery

* Capability Controls

  * Observe
  * Verify
  * Conversion
  * Review
  * Diagnostics

* Service Status

  * Memory
  * Atlas
  * Browser Verification
  * Property Manager
  * Artifact Manager

* Diagnostics

  * Health
  * Last Run
  * Backend Availability

The Systems Console will replace the operational role previously implied by MUTHUR Execute.

---

## Acceptance Criteria

PASS if:

* MUTHUR Execute no longer appears anywhere in the UI.
* No broken layouts occur.
* No console errors occur.
* No functionality regressions occur.
* Existing workflows continue to function.
* Build passes.
* Typecheck passes.

Required evidence:

* Before/after screenshots.
* Removal summary.
* List of deleted components/files.
* Verification commands and results.

Validation:

pnpm exec tsc --noEmit

pnpm build

Provide actual results, not assumed results.