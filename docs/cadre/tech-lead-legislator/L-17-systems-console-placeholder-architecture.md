# L-17 — Systems Console Placeholder Architecture

## Status

PLACEHOLDER ONLY.

The Systems Console is the intended successor surface for the operational role once implied by MUTHUR Execution. This document preserves the target architecture without adding product behavior.

## Intended Role

Systems Console should expose system-wide posture, capability controls, service status, and diagnostics. It should not become an autonomous execution cockpit by default.

## Future Responsibilities

### Global Posture

- Standby
- Observe
- Overwatch
- Verify
- Recovery

### Capability Controls

- Observe
- Verify
- Conversion
- Review
- Diagnostics

### Service Status

- Memory
- Atlas
- Browser Verification
- Property Manager
- Artifact Manager

### Diagnostics

- Health
- Last Run
- Backend Availability

## Constraints

- Preserve human requisition authority.
- Keep Observe Mode read-only unless elevated authority is explicitly granted.
- Keep execution receipts visible and auditable.
- Do not reintroduce a queue-control pane without a dedicated execution contract.

## Migration Note

The retired `muthur-execution` custom tab kind should not be restored from saved UI state. Future Systems Console work should define a new pane kind and migration rule explicitly.
