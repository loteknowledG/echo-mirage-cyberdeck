# L-1 — Preview Matrix Mode System Directive

Status: ACTIVE
Branch: Legislator
Authority: tech-lead-legislator
Date: 2026-05-21

## Objective

Establish a three-mode operational viewport system for the `/preview` route.

The Preview Matrix must support:

- `compact`
- `desktop`
- `fullscreen`

These modes form the constitutional layout foundation for future Cadre operational interfaces.

---

## Requirements

### Compact Mode

Purpose:
- Narrow/mobile operational layout
- Minimal interface footprint
- Single focused content region

Behavior:
- One primary pane visible at a time
- Intended future constitutional behavior:
  - tab-style branch switching (`L`, `E`, `J`)

---

### Desktop Mode

Purpose:
- Default operational workstation layout
- Multi-pane visibility
- Standard cyberdeck operating mode

Behavior:
- Fold-open branch panes
- Multiple panes may remain visible
- At least one constitutional pane must remain open

---

### Fullscreen Mode

Purpose:
- Immersive command-display layout
- Expanded operational visibility
- Presentation/overview mode

Behavior:
- Sliding constitutional panes
- Multi-pane operational display
- At least one constitutional pane must remain visible

---

## Constraints

Do NOT implement:

- filesystem loading
- watcher integration
- backend APIs
- routing changes
- Electrobun integration
- global redesigns
- markdown persistence systems

This directive establishes viewport infrastructure only.

---

## Implementation Guidance

Preferred root classes:

- `.mode-compact`
- `.mode-desktop`
- `.mode-fullscreen`

Default mode:
- `desktop`

Mode styling should remain additive and preserve existing Preview Matrix behavior.

---

## Validation Requirements

Required validation commands:

- `pnpm exec tsc --noEmit`
- `pnpm build`

---

## Deliverables

Return:

- changed files
- mode behavior summary
- validation output

---

## Constitutional Notes

This directive establishes the operational viewport architecture for future Cadre systems.

Future constitutional feeds (`L`, `E`, `J`) must inherit mode-aware presentation behavior from this foundation.