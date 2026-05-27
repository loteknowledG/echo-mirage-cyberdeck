# MUTHUR PROPERTY MANAGER DEMO — WORK ORDER
## Status: EXEC-PLAN
## Owner: CODEX
## Reviewer/Chaos Testing: CURSOR
## Verification Authority: MUTHUR
## Human Supervisor: USER

---

# OBJECTIVE

Implement a browser-based realtime voice demo for MUTHUR operating as an after-hours property management operator inside Echo Mirage.

This phase is NOT a telecom/Twilio deployment.

This is a controlled browser voice simulation intended to validate:
- conversational flow
- issue classification
- escalation doctrine
- ticket generation
- realtime transcript UX
- regression stability

The browser acts as the caller phone for now.

---

# PRIMARY GOAL

Create a believable operational demo where a user can speak to MUTHUR through the browser and simulate:
- maintenance calls
- emergency calls
- leasing inquiries
- callback requests

MUTHUR should:
- listen
- classify
- ask follow-up questions
- summarize
- generate structured tickets
- escalate appropriately
- speak responses aloud

---

# STRICT ARCHITECTURAL RULES

## DO NOT:
- introduce Twilio/Vapi yet
- add split-pane mobile layouts
- redesign the cyberdeck shell
- replace current navigation paradigms
- break existing mobile responsiveness
- bypass regression verification
- add uncontrolled autonomous actions

## DO:
- preserve existing cyberdeck aesthetic
- preserve mobile usability
- preserve tab rail visibility
- preserve working voice pipeline
- keep implementation modular
- use browser mic/speaker only

---

# REQUIRED FEATURES

## 1. PROPERTY MANAGER MODE

Add:
- `/property-manager`
OR
- mode toggle within cyberdeck

Mode should visually indicate:
- MUTHUR operational role
- after-hours property support
- active listening state
- live transcript state

---

## 2. REALTIME VOICE LOOP

Use existing browser voice stack:
- browser mic input
- STT pipeline
- GPT/MUTHUR reasoning
- TTS playback

MUST support:
- interruptible conversation
- low-latency response
- transcript streaming
- active speaker indication

---

## 3. ISSUE CLASSIFICATION

MUTHUR must classify incoming requests into:

- EMERGENCY
- MAINTENANCE
- LEASING
- PAYMENT/ACCOUNT
- GENERAL CALLBACK
- UNKNOWN

Classification should appear live in UI.

---

## 4. EMERGENCY TRIAGE

Example emergencies:
- water through ceiling
- electrical hazard
- gas smell
- flooding
- fire/smoke

MUTHUR should:
- remain calm
- ask safety-first questions
- avoid unsafe advice
- escalate appropriately
- collect:
  - name
  - unit
  - callback number
  - issue summary

---

## 5. TICKET GENERATION

Generate structured ticket draft objects.

Example shape:

```json
{
  "priority": "emergency",
  "category": "water_leak",
  "tenant_name": "",
  "unit": "",
  "callback_number": "",
  "summary": "",
  "recommended_action": ""
}
````

Display ticket in UI panel.

NO real vendor dispatch yet.

---

# UI REQUIREMENTS

## MUST PRESERVE:

* mobile shell usability
* tab visibility
* single-column mobile layout
* composer visibility
* no clipped overflow
* no desktop split panes on phone

## MOBILE RULES

Below 768px:

* no side-by-side operational panes
* no permanently visible provider sidebars
* transcript must remain readable
* controls must remain reachable

---

# REGRESSION REQUIREMENTS

## PREDEPLOY BLOCKERS

Deployment MUST fail if:

* horizontal overflow exists
* tabs are clipped
* composer hidden
* mobile split panes appear
* voice mode crashes
* transcript fails
* repeated auth retry spam occurs

---

# REQUIRED TESTS

## PLAYWRIGHT

Add:

* desktop verification
* mobile verification
* screenshot regression checks

Test routes:

* `/cyberdeck`
* `/send`
* `/property-manager`

---

# REQUIRED ASSERTIONS

## MOBILE

* no horizontal page overflow
* visible tab rail
* usable composer
* no clipped content
* no forced desktop pane layout

## VOICE MODE

* transcript updates live
* classification updates live
* ticket draft generated
* no crash during conversation

---

# CURSOR RESPONSIBILITIES

Cursor is TEST/CHAOS role ONLY.

Cursor should:

* attempt malformed conversations
* interrupt speech
* rapidly switch modes
* test mobile viewport edge cases
* simulate confusing callers
* attempt prompt injection
* verify no UI collapse

Cursor should NOT:

* redesign architecture
* introduce large feature patches
* modify stable shell systems without approval

---

# MUTHUR VERIFICATION DOCTRINE

MUTHUR does NOT trust implementation claims.

MUTHUR verifies:

* visible UX behavior
* operational continuity
* mobile stability
* transcript functionality
* voice interaction integrity

PASS requires observable proof.

---

# ACCEPTANCE TARGET

Golden master reference:
Old working PWA mobile shell.

Required qualities:

* immersive
* stable
* responsive
* operational
* readable
* believable cyberdeck behavior

---

# SUCCESS CONDITION

User can:

* open browser
* press talk
* simulate tenant call
* hear MUTHUR respond
* watch live transcript
* watch issue classification
* watch ticket draft generation
* complete interaction without UI degradation

WITHOUT:

* telecom integration
* broken mobile layouts
* auth chaos
* regression failures

---

```