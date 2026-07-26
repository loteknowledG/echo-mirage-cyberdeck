# L-SURVEY-INSTALL-001 — Consolidate Installation into Survey

**Status:** Proposed  
**Priority:** P1 (product clarity / navigation)  
**Owner:** MUTHUR / Survey / Cyberdeck  
**Depends On:** Echo Satellite installation and pairing being operational from Survey  
**Blocks:** Clear hosted-Mirage onboarding and removal of redundant Install navigation  

---

## Objective

Make the Survey pane the canonical lifecycle surface for Echo Satellite and its
browser companion:

* discover
* download
* install
* pair
* connect
* inspect health
* update
* troubleshoot

Retire the current Install pane from the default Cyberdeck navigation when it
does not provide unique functionality.

Preserve the full Echo Mirage desktop distribution only as an explicitly
optional product for offline use, local development, self-hosting, or operators
who deliberately want the complete Cyberdeck installed.

---

## Product Decision

The hosted server changes the default installation journey:

```text
Mirage commander and analysis UI
  → hosted web application
  → no desktop installation required

Echo local embodiment
  → Echo Satellite
  → installed from and managed by Survey

Full Echo Mirage desktop
  → optional distribution
  → offline, self-hosted, development, or bundled operation
```

The server provides coordination, relay, analysis, and the hosted interface. It
does not replace Echo Satellite capabilities that require local machine
authority, including desktop capture, browser-extension bridging, background
operation, local file access, and machine control.

The product must not imply that installing the full Cyberdeck is required to use
hosted Mirage.

---

## Current Problem

Installation is represented in two competing places:

1. Survey already owns Echo discovery, pairing, connectivity, and Satellite
   installation.
2. The Install pane presents a broader Echo Mirage desktop installation journey.

This creates ambiguity:

* Users may believe hosted Mirage requires a desktop installation.
* Users may install the full Cyberdeck when they only need Echo Satellite.
* Pairing and installation appear to be separate workflows even though they are
  one operational lifecycle.
* The distinction between hosted Mirage, Echo Satellite, Powerfist, and the
  optional full desktop build is not explicit.

---

## Scope

### 1. Capability Audit

Inventory everything exposed by the Install pane and compare it with Survey.

At minimum, inspect:

* platform and architecture detection
* Echo Satellite download links
* full Cyberdeck download links
* current and available versions
* installation state
* update state
* release channel
* signing and operating-system warnings
* browser-extension installation
* pairing entry points
* connection and health status
* troubleshooting guidance
* offline and self-hosted instructions
* desktop-only settings or IPC behavior

For every Install capability, classify it as:

* `MOVE_TO_SURVEY`
* `ALREADY_IN_SURVEY`
* `KEEP_OPTIONAL_DESKTOP`
* `REMOVE_DEAD`

Do not remove the Install pane until every unique capability has a destination.

### 2. Survey Becomes the Canonical Echo Lifecycle

Survey must expose a coherent Echo setup sequence:

1. Detect whether Echo Satellite is reachable.
2. Explain why Echo is needed and which features require it.
3. Offer the correct Satellite installer for the operator platform.
4. Provide browser-extension setup when applicable.
5. Pair Echo, Mirage, and Powerfist.
6. Display connection and capability health.
7. Offer update and repair actions.
8. Present actionable troubleshooting when a step fails.

Use capability-oriented language. Do not claim that Electron is required for
hosted Mirage itself.

Recommended copy:

> Mirage runs in the browser. Install Echo Satellite on machines that need local
> capture, browser bridging, background presence, or machine control.

### 3. Retire Install from Default Navigation

After parity is verified:

* remove Install from the default server rail and new-tab menus
* remove Install from conversion/context menus where present
* remove unused pane registration and lazy-loader wiring
* remove Install-only UI that has been migrated or proven dead
* preserve shared download/update utilities used by Survey

Do not leave blank rail slots, unresolved pane kinds, or broken lazy imports.

### 4. Saved-State and Route Compatibility

Existing operators may have persisted Install tabs or direct links.

Implement a compatibility policy:

* persisted Install tabs should migrate to Survey
* requests for the former Install pane should redirect or render a compact
  migration notice linking to Survey
* old local-storage and workspace state must not crash parsing
* unknown older pane data must fail safely

Keep compatibility for at least one release unless repository conventions
require a longer interval.

### 5. Optional Full Desktop Distribution

Do not delete packaging, release, update, or documentation support for the full
Echo Mirage desktop build merely because its default CTA is removed.

If the full distribution remains supported, place it under a clearly secondary
surface such as:

* `Desktop & Offline`
* Settings → Distribution
* project documentation or Releases

Its stated uses must be limited to real differentiated capabilities:

* offline operation
* local/self-hosted server
* development
* bundled Mirage and Echo operation

If the audit finds no supported differentiated use, open a separate destructive
retirement work order. Do not expand this work order into deleting packaging.

### 6. Documentation and Product Language

Update user-facing and architecture documentation to consistently define:

* Mirage — hosted commander and analysis interface
* Echo Satellite — installed local embodiment
* Powerfist — capture/action role operating through available browser or Echo
  capabilities
* Relay/server — coordination layer, not a replacement for local authority
* Full Cyberdeck desktop — optional bundled/offline distribution

Remove wording that says or implies the full Electron app is required for
ordinary hosted Mirage use.

---

## Non-Goals

This work order does not:

* remove Echo Satellite
* replace Electron with a different local runtime
* grant a hosted server desktop-level authority
* redesign Survey beyond the installation and lifecycle flow
* delete desktop packaging or release automation
* add new capture or machine-control capabilities
* change pairing security boundaries
* expose localhost-only endpoints publicly

---

## Security Boundaries

Preserve all existing localhost and local-authority restrictions.

In particular:

* desktop capture must not become a public unauthenticated server endpoint
* local control commands must retain pairing and authorization checks
* the hosted server must not receive local secrets unnecessarily
* installer and update links must resolve to trusted release artifacts
* browser fallback behavior must not be described as equivalent to full local
  embodiment when it is not

Stop and report if consolidation would require weakening any boundary.

---

## Phased Deliverables

### P0 — Audit and Decision Record

* map Install components, routes, pane registration, commands, persisted state,
  download utilities, and desktop IPC dependencies
* produce the capability disposition table
* confirm whether the full desktop distribution has supported unique uses
* capture before screenshots of Install and Survey

### P1 — Survey Parity

* move all required Echo Satellite lifecycle features into Survey
* clarify hosted Mirage versus installed Echo language
* add health, version, update, and troubleshooting states required by the audit
* verify browser, hosted, and Electron contexts

### P2 — Navigation Retirement

* remove Install from default navigation and creation menus
* migrate saved Install tabs to Survey
* preserve safe direct-route compatibility
* remove dead Install-only implementation

### P3 — Optional Distribution Repositioning

* expose the full desktop build only through a secondary, accurately labeled
  surface when retained
* update release and installation documentation
* verify download URLs and platform labels

### P4 — Verification and Receipt

* run required automated checks
* execute the manual acceptance matrix
* capture after screenshots
* document moved, retained, and removed functionality

---

## Acceptance Matrix

| Scenario | Expected result |
|---|---|
| New hosted Mirage user | Can use Mirage without being told to install the full Cyberdeck |
| User needs local capture/control | Survey explains and offers Echo Satellite |
| Echo not installed | Survey provides platform-appropriate installation guidance |
| Echo installed but offline | Survey shows a useful diagnostic state |
| Echo paired | Survey shows connection and capability health |
| Browser-only Powerfist capability | Works without falsely claiming desktop authority |
| Desktop-level Powerfist capability | Clearly requires and routes through Echo |
| Existing saved Install tab | Migrates safely to Survey |
| Old direct Install link | Redirects or provides a migration notice |
| Offline/full-desktop operator | Can still find the optional supported distribution |
| Hosted deployment | No localhost-only endpoint is exposed publicly |

---

## Acceptance Criteria

PASS only when:

* Survey is the single primary surface for Echo Satellite installation, pairing,
  health, updates, and troubleshooting.
* Hosted Mirage onboarding does not require or imply a full desktop install.
* Every unique Install capability has been moved, retained intentionally, or
  removed with evidence.
* Install no longer appears in default navigation or new-tab creation.
* Persisted Install tabs migrate without errors.
* Old direct links fail safely.
* Echo Satellite remains available and functional.
* Full desktop packaging remains intact unless separately authorized for
  retirement.
* Localhost, pairing, and authorization boundaries are unchanged or stronger.
* No blank panes, broken imports, hydration failures, or console errors occur.
* Typecheck, lint, build, Survey probes, and relevant Playwright checks pass.

---

## Required Verification

Run and record actual results:

```text
pnpm exec tsc --noEmit
pnpm lint
pnpm build
pnpm probe:survey-hub
pnpm e2e:smoke
pnpm e2e:layout
```

Add or update a focused probe that verifies:

* Install is absent from default pane registration/navigation
* legacy `install` persisted state resolves to Survey
* Survey still exposes the Satellite installation action
* optional full-desktop distribution remains discoverable when supported

Manual verification must cover:

* hosted browser without Echo
* hosted browser paired with Echo Satellite
* packaged Electron build
* browser-extension bridge
* narrow/mobile layout

---

## Required Evidence

The completion receipt must include:

* capability disposition table
* before and after screenshots
* list of moved components and utilities
* list of removed components, routes, registrations, and state keys
* saved-state migration behavior
* final user-facing product language
* verification commands and results
* known limitations

---

## Stop Conditions

Stop and report instead of improvising if:

* Survey does not actually provide a working Satellite installer path
* the Install pane owns required update or release behavior with no safe Survey
  destination
* route removal would break packaged desktop startup
* saved-state migration conventions cannot be determined
* the proposed change weakens local capture or pairing security
* the full desktop distribution’s supported status is unclear
* existing failures prevent trustworthy verification

The stop report must identify the evidence, attempted resolution, and smallest
decision needed from the operator.

---

## Completion Outcome

The finished product should communicate one unambiguous journey:

```text
Open Mirage on the web
  → enter Survey
  → install Echo Satellite only when local embodiment is needed
  → pair and verify capabilities
  → operate
```

The full Echo Mirage desktop installation must no longer compete with that
default journey.
