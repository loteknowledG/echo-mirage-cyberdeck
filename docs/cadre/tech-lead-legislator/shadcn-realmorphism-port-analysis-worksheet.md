Use this as `SHADCN_REALMORPHISM_PORT_ANALYSIS_WORKSHEET.md`.

````markdown
# SHADCN / REALMORPHISM PORT ANALYSIS WORKSHEET

## Status
PLANNING / AUDIT ONLY

## Rule
Do not port, rewrite, restyle, or refactor yet.

This worksheet is for analysis only.

---

# PURPOSE

Evaluate how Echo Mirage can adopt shadcn/Radix primitives while preserving the existing Echo Mirage identity:

- MUTHUR cockpit
- operator pane
- tab rail
- ASCII morphism
- realmorphism
- mobile stability
- regression protection
- MU/TH/UR doctrine

---

# ROLE SPLIT

## CODEX ROLE
Architecture and implementation audit.

Focus on:
- component structure
- CSS/theme architecture
- migration safety
- dependency impact
- testing requirements
- phased implementation plan

## CURSOR ROLE
Visual and experiential audit.

Focus on:
- what must not visually regress
- mobile behavior
- interaction feel
- tab rail identity
- cockpit atmosphere
- ASCII/realmorphism preservation
- visual acceptance criteria

---

# CODEX ANALYSIS WORKSHEET

## 1. Current UI Inventory

List current major UI surfaces:

```text
- /cyberdeck:
- /send:
- /property-manager:
- operator pane:
- right document pane:
- tab rail:
- message composer:
- map layer:
- voice/transcript panels:
- ticket panels:
````

Notes:

```text
```

---

## 2. Current Component Inventory

Identify reusable UI patterns already present:

```text
- buttons:
- cards/panels:
- tabs:
- drawers/sheets:
- dialogs/modals:
- badges/status pills:
- scroll areas:
- command/input bars:
- markdown viewers:
- code viewers:
- map containers:
```

Notes:

```text
```

---

## 3. shadcn Candidate Mapping

Map existing UI to shadcn-compatible primitives.

```text
Button      ->
Card        ->
Tabs        ->
Dialog      ->
Sheet       ->
ScrollArea  ->
Command     ->
Badge       ->
Separator   ->
Textarea    ->
Input       ->
Tooltip     ->
Dropdown    ->
Resizable   ->
```

Notes:

```text
```

---

## 4. Components That Must Remain Custom

List components that should not be replaced by generic shadcn.

```text
- Echo Mirage tab rail:
- operator pane shell:
- ASCII morphology layers:
- MUTHUR status/log stream:
- cyberdeck layout shell:
- map ops layer:
- voice call console:
```

Why:

```text
```

---

## 5. Theme Architecture Audit

Current theme files/classes/tokens:

```text
-
```

Hardcoded colors found:

```text
-
```

Current CSS risks:

```text
-
```

Proposed token groups:

```text
--em-bg:
--em-panel:
--em-border:
--em-text:
--em-muted:
--em-accent:
--em-danger:
--em-warning:
--em-success:
--em-muthur:
--em-operator:
--em-shadow:
--em-glow:
```

Notes:

```text
```

---

## 6. Monaco / Code Pane Plan

Should code files use Monaco?

```text
YES / NO
```

Initial mode:

```text
read-only / editable
```

Languages to support first:

```text
typescript, javascript, markdown, json, css, html, yaml, python
```

Risks:

```text
```

---

## 7. Migration Risk Areas

High-risk areas:

```text
- mobile cyberdeck shell:
- tab rail:
- message composer:
- right pane layout:
- /send layout:
- /property-manager layout:
```

Regression tests required:

```text
-
```

---

## 8. Proposed Migration Phases

### Phase 0 — Audit Only

No changes.

### Phase 1 — Theme Tokens

Add CSS variable token system without changing visuals.

### Phase 2 — Low-Risk Primitives

Port basic Button/Card/Badge/Separator/Input wrappers.

### Phase 3 — Monaco Read-Only Code Pane

Add syntax-highlighted code viewing.

### Phase 4 — shadcn Dialog/Sheet/ScrollArea

Use for overlays/drawers only.

### Phase 5 — Realmorphism Component Layer

Create custom wrappers.

### Phase 6 — Tab Rail Prototype

Prototype separately. Do not replace production rail until verified.

Notes:

```text
```

---

# CURSOR ANALYSIS WORKSHEET

## 1. Visual Identity Preservation

What currently makes Echo Mirage feel like Echo Mirage?

```text
-
```

Must preserve:

```text
- tab rail geometry:
- green phosphor / cyberdeck tone:
- operator pane density:
- message box attachment:
- document pane feel:
- ASCII/terminal atmosphere:
```

Notes:

```text
```

---

## 2. Tab Rail Audit

Describe current tab rail behavior and visual identity.

```text
```

What must not change:

```text
-
```

What could improve:

```text
-
```

Mobile requirements:

```text
- no clipping
- no horizontal body overflow
- tabs remain usable
- rail feels intentional
```

---

## 3. ASCII Morphism Opportunities

Where should ASCII morphism appear?

```text
- tab rail:
- dividers:
- panel borders:
- status blocks:
- signal lines:
- loading states:
- doctrine documents:
```

Where should it NOT appear?

```text
-
```

---

## 4. Realmorphism Opportunities

Where should depth/shadow/3D illusion appear?

```text
- cards:
- panels:
- buttons:
- tabs:
- command bars:
- map controls:
```

Where would it hurt usability?

```text
-
```

---

## 5. Mobile UX Acceptance

Test sizes:

```text
390 x 844
320 x 568
```

Must pass:

```text
- [ ] no horizontal scroll
- [ ] tabs visible
- [ ] composer usable
- [ ] operator pane readable
- [ ] document pane usable
- [ ] no desktop split-pane forced on phone
- [ ] /send readable
- [ ] /property-manager readable
```

Notes:

```text
```

---

## 6. shadcn / SCIFICN / 8bitcn Inspiration

Useful patterns from shadcn:

```text
-
```

Useful patterns from SCIFICN:

```text
-
```

Useful patterns from 8bitcn:

```text
-
```

What Echo Mirage must do differently:

```text
-
```

---

# JOINT DECISION SECTION

## Should Echo Mirage adopt shadcn primitives?

```text
YES / NO / PARTIAL
```

Reason:

```text
```

## Should Realmorphism become a separate component layer?

```text
YES / NO
```

Reason:

```text
```

## Should ASCII Morphism become its own component family?

```text
YES / NO
```

Reason:

```text
```

## Should the production tab rail be touched in the first pass?

```text
NO
```

Reason:

```text
The tab rail is a high-identity, high-risk component. Prototype separately first.
```

---

# REQUIRED OUTPUT FROM CODEX

Codex must produce:

```text
SHADCN_REALMORPHISM_CODEX_AUDIT.md
```

Containing:

* architecture findings
* component inventory
* migration risks
* phased plan
* test plan
* recommended first patch

---

# REQUIRED OUTPUT FROM CURSOR

Cursor must produce:

```text
SHADCN_REALMORPHISM_CURSOR_UX_AUDIT.md
```

Containing:

* visual findings
* sacred UI elements
* mobile risks
* morphology opportunities
* screenshot notes
* UX acceptance criteria

---

# FINAL ACCEPTANCE QUESTION

Can Echo Mirage adopt shadcn while preserving its operational cyberdeck identity?

```text
YES / NO / YES WITH CONSTRAINTS
```

Constraints: