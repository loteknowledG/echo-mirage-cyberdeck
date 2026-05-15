# What Did We Do So Far — Echo Mirage Cyberdeck

## Goal
Build and refine Echo Mirage Cyberdeck features including computer use layer, MU/TH/UR ownership, pointer/indicate mode, guided teaching, cursor presence, operational narration, surface awareness, and UI semantic alias registry.

---

## Constraints & Preferences
- No header/layout modifications
- No visual effects or decorative UI clutter
- No fake logs or decorative spam — real events only
- Human override is absolute; USER retake always succeeds
- No autonomous execution, no microphone capture, no getUserMedia
- No browser search for self-status questions
- Graceful failures for unavailable features
- All checks must pass (tsc, lint, build, e2e)
- Safety guard required for computer use actions
- No arbitrary shell execution
- No unrestricted IPC
- Do not remove legacy compatibility globals
- No synthetic MouseEvent/KeyboardEvent dispatch
- No click injection, no OS cursor control
- Overlay must remain pointer-events: none
- Teaching markers must have explicit width/height (not ring/point)
- Teaching targets with zero/invalid bounds must narrate TARGET_NOT_FOUND and fail gracefully
- Teaching workflow must always end with indicators cleared, workflow ended, narration paused
- Emergency stop must cancel chat stream, teaching workflow, indicators, TTS, and unlock input
- Watchdog timeout (60s) must auto-recover if teaching gets stuck
- No LLM-based fuzzy matching for alias resolution
- Do not route unresolved indicate requests to self-status or browser search

---

## Progress

### Done

**Computer Use Layer v0**: typed action primitives, safety guard, action runner, capability registry

**Electron Bridge v0**: IPC handlers in main.js, contextBridge preload with narrow echoMirageComputerUse API

**Capability Registry v0**: central definitions with category, confirmationPolicy, environments, getActionScope()

**Control Lease + Ownership State v0**: ControlOwner (USER/SHARED/MUTHUR), ControlScope, ControlLease, retake/grant/request/revoke/expire, event log

**Control Lease Hardening v0**: retake() denies non-USER; revokeLease() returns real retake result; grantLease() unexported; CONTROL_DENIED emitted from action-runner

**Pointer / Indicate Mode v0**: indicate_point, indicate_highlight, clear_indicators actions; IndicateOverlay React component (pointerEvents: none); MUTHURMode type; INDICATE_STARTED/UPDATED/CLEARED events; indicate-layer.ts marker state; category "output"

**Operational Introspection Layer v0**: getComputerUseStatus(), formatStatusText(), intent-detect.ts with detectSelfStatusIntent()

**Voice Lab Master Gain Slider**: replaced Knob with native `<input type="range">` in voice-lab-pane-body.tsx

**Vox Net / Operational Narration v0**: narration.ts with NarrationEvent types, NARRATION_MAP, listeners, narrate(), speakNarration(), narrateAndSpeak(), pauseNarration()/resumeNarration(), debounce (3s, max 3 repeats); CURSOR_ENTER_REGION ("Step acknowledged."), STEP_ACKNOWLEDGED ("Proceeding to next instruction."), TARGET_NOT_FOUND ("Unable to locate teaching target.") events. `speakNarration()` is fire-and-forget (void), no await.

**UI Semantic Alias Registry v0**: ui-alias-registry.ts with resolveUiTarget(); CanonicalTarget: COMMAND_INPUT, VOICE_LAB, LEFT_CONSOLE, RIGHT_PANEL, CENTER_STAGE; exact match + single contains match; structured failure for unresolved targets; TARGET_NOT_RECOGNIZED response; normalize() strips punctuation; wired into runPointerCommand() in page.tsx. 37 aliases across 5 targets. `"panel"` ambiguous → unresolved. `"input"` ambiguous → unresolved.

**Guided Teaching / Cursor Presence v0**: cursor-presence.ts (trackCursorPosition, CURSOR_ENTER_REGION/CURSOR_EXIT_REGION/STEP_ACKNOWLEDGED events, addPresenceListener); guided-workflow.ts (startWorkflow, acknowledgeCurrentStep(markerId?), advanceWorkflow, endWorkflow, setMarkerForStep, getCurrentStep, getWorkflowState, registerWatchdogCanceller); cursor tracking via IndicateOverlay.tsx mousemove listener; presence listener calls acknowledgeCurrentStep + advanceWorkflow + proceedToNextStep on CURSOR_ENTER_REGION; getPresenceState() and guidedWorkflow exposed in introspection

**Guided Teaching Scenario v0**: guided-teaching.ts (isTeachingDemoTrigger with 6 patterns, runTeachingDemo, proceedToNextStep, getTeachingDemoSteps); trigger wired into page.tsx before runPointerCommand and detectSelfStatus; 2-step teaching demo (COMMAND_INPUT → VOICE_LAB); teaching markers use indicate_highlight with width/height (always visible); end of workflow calls clearMarkers() via advanceWorkflow

**Guided Teaching Debug Visibility v0**: DEBUG = NODE_ENV !== "production" in indicate-layer.ts, guided-teaching.ts, IndicateOverlay.tsx; [INDICATE-DEBUG] logs on indicate_point/highlight; [TEACHING-DEBUG] logs; [OVERLAY-DEBUG] poll logs every 200ms; [OVERLAY-RENDER] log on each React mount; red debug rects (2px solid #ef4444) on all marker styles in dev mode; getActiveGuidedMarker() + guidedMarker field in introspection

**Guided Teaching Overlay Reliability v0**: findTeachingTarget() with explicit element resolution, bounds validation, narrate("TARGET_NOT_FOUND") on failure; indicate_highlight for teaching; minimum marker size 80x48; getActiveGuidedMarker() returns MarkerInfo with id/style/position/label/width/height/bounds/hasRegion; renderCountRef for render tracking; probe-guided-workflow.ts updated with className/id on mocks

**Stuck Runtime Kill Switch v0**: teardown.ts (emergencyStop(), acknowledgeWatchdog(), cancelTeachingWatchdog(), startTeachingWatchdog(), isWatchdogActive(), resumeAfterStop()); emergencyStop clears workflow, markers, pauses narration, resets presence; watchdog timer 60s auto-trigger; handleStop in page.tsx calls emergencyStop() + cancelTeachingWatchdog() + sets isStreaming(false) even when not streaming; acknowledgeWatchdog called after each step start and after cursor enters region; cancelTeachingWatchdog called on IndicateOverlay unmount; registerWatchdogCanceller wired into guided-workflow; probe-guided-workflow.ts updated with emergencyStop, watchdog tests

**Teaching Demo Voice Decoupling v0**: teach workflow independent of voice render; `speakNarration()` returns void; narration listener uses `failureCountRef` (ref, not closure var) with `.then(() = 0)` reset + `.catch()` increment; ≥3 consecutive failures → abortMotherSpeech() + reset; `resumeAfterStop()` on listener cleanup; `handleStop` always clears STREAMING (no isStreaming guard); `advanceWorkflow` calls pauseNarration() when workflow naturally completes; `cancelStepWatchdog()` called on cursor enter; step watchdog (30s) in teardown.ts with startStepWatchdog/cancelStepWatchdog; teach triggers fire even during active stream (sets isStreaming false immediately)

**External Surface Awareness v0**: surface-classifier.ts with pattern-based SurfaceType classification (chatgpt, opencode, codex, vscode, terminal, browser, unknown); classifyWindowTitle(), formatSurfaceResponse(), getSurfaceEmoji(); inspect-layer.ts singleton state (setLastSurfaceClassification, getLastSurfaceClassification, clearSurfaceInspection, hasRecentInspection, getInspectionSummary); detectInspectIntent() with 15 patterns; inspect wired in page.tsx before self-status; paste listener on command input captures `data:image/` screenshots; screenshot auto-classifies as "unknown" with note; screen-capture.ts updated with manual screenshot injection helpers; no continuous monitoring, no autonomous action

**UI Semantic Alias Registry v0 (enhanced)**: added "volume slider" to VOICE_LAB; "event log" to LEFT_CONSOLE; "doctrine panel" to RIGHT_PANEL; normalize() strips punctuation before matching; probe-ui-alias-registry.ts with 78 assertions

### In Progress
- (none)

### Blocked
- (none)

---

## Key Decisions

- Indicate uses category "output" — covered by observation lease, no need for full USE lease
- grantLease() unexported to prevent policy bypass; requestLease() is the public policy entry
- emit() exported from control-lease.ts for internal use by indicate-layer.ts and narration.ts
- MUTHUR retake always denied; USER retake always succeeds
- Self-status questions use intent detection to route to formatStatusText() instead of browser/model
- Voice narration respects voiceEnabled toggle; paused by pauseNarration() for future PTT/arbitration
- Teaching uses indicate_highlight (not indicate_point) to guarantee visible region with explicit width/height
- acknowledgeCurrentStep accepts optional markerId; if step has no markerId set, any marker is accepted; if step has markerId set, only matching ID is accepted
- advanceWorkflow clears markers + cancels watchdog timer on workflow completion; calls pauseNarration() on natural completion
- emergencyStop() cancels watchdog first, then tears down workflow/markers/narration/presence in try/catch
- handleStop works even when not streaming (no isStreaming guard) — ensures teaching cleanup always works
- Watchdog 60s global; 30s per-step; acknowledgeWatchdog resets both timers
- Teaching voice decoupling: fire-and-forget narration listener, failureCountRef counter, auto-resume on cleanup
- Surface awareness is observation-only; no click/type/focus; honest unsupported/fallback messages
- UI alias resolution: exact match first, then single contains match, then unresolved; normalize() strips punctuation
- Ambiguous aliases ("panel", "box", "input") resolve to null — users must use full qualified phrases

---

## Next Steps
- (none)

---

## Critical Context

**E2E test stability**: port 3050 cleanup when TIME_WAIT accumulates; navigation fallback load→domcontentloaded

**Playwright config**: baseURL `http://127.0.0.1:3050`, webServer command `pnpm dev`, timeout 180000ms

**ACTION_NAME includes**: get_active_window, list_open_windows, capture_screen, focus_window, paste_text, hotkey, verify_text_visible, verify_window_active, stop_execution, indicate_point, indicate_highlight, clear_indicators, unknown

**MUTHURMode**: OBSERVE | INDICATE | ASSIST | USE

**IndicateOverlay polls getMarkers() every 200ms**, renderCountRef tracks render cycles

**Probe results**:
- probe-ui-alias-registry.ts: 78 PASS
- probe-surface-awareness.ts: 39 PASS
- probe-guided-workflow.ts: 61 PASS
- probe-narration.ts: 13 PASS
- probe-pointer-indicate.ts: 10 PASS

**Routing order in page.tsx handleSend**:
1. tab creation
2. settings command
3. `detectSelfStatusIntent` → formatStatusText()
4. `detectInspectIntent` → formatSurfaceResponse() or fallback
5. `isTeachingDemoTrigger` → runTeachingDemo()
6. `runPointerCommand` (indicate/highlight/clear via resolveUiTarget)
7. `parseBrowserCommand` / `parseBrowserUseModeCommand`
8. chat stream (model inference)

**Unresolved indicate** (`TARGET_NOT_RECOGNIZED`) returns early from runPointerCommand — does NOT fall through to browser/search/chat

**IndicateOverlay cleanup**: cancelTeachingWatchdog(), cancelStepWatchdog(), clearInterval(pollInterval), removeEventListener(mousemove), resetPresence()

**Overlay div**: pointerEvents: "none" — never blocks input regardless of markers

**acknowledgeCurrentStep markerId=null behavior**: when state.markerId is null, any markerId (including undefined) is accepted — wildcard for steps without explicit markerId set

**Teaching markers labeled**: "COMMAND_INPUT" / "VOICE_LAB" (canonical names, not step labels)

---

## Relevant Files

| File | Purpose |
|------|--------|
| `src/lib/computer-use/computer-use-types.ts` | ActionName, ComputerUseAction, IndicateMarker, SafetyConfig |
| `src/lib/computer-use/action-runner.ts` | executeAction switch, ownership gate |
| `src/lib/computer-use/safety-guard.ts` | validateAction with confirmation policy |
| `src/lib/computer-use/capability-registry.ts` | CAPABILITY_REGISTRY, requiresConfirmation(), getActionScope() |
| `src/lib/computer-use/control-lease.ts` | ControlOwner, ControlScope, MUTHURMode, retake/request/grant/expire/revoke, emitControlDenied, emit() exported |
| `src/lib/computer-use/indicate-layer.ts` | markers state, indicatePoint/indicateHighlight/clearMarkers, DEBUG logs |
| `src/lib/computer-use/IndicateOverlay.tsx` | React component, pointerEvents:none, mousemove listener, presence listener, renderCountRef, DEBUG logs, cleanup with cancelStepWatchdog |
| `src/lib/computer-use/narration.ts` | NarrationEvent, NARRATION_MAP, narrate()/speakNarration()/narrateAndSpeak(), pauseNarration()/resumeNarration(), debounce, CURSOR_ENTER_REGION, STEP_ACKNOWLEDGED, TARGET_NOT_FOUND, resetNarrationDebounce() |
| `src/lib/computer-use/introspection.ts` | getComputerUseStatus(), formatStatusText(), formatSurfaceStatus(), getActiveGuidedMarker(), MarkerInfo, surfaceAwareness in status |
| `src/lib/computer-use/intent-detect.ts` | detectSelfStatusIntent(), detectInspectIntent(), classifyIntent() |
| `src/lib/computer-use/ui-alias-registry.ts` | resolveUiTarget(), CanonicalTarget, exact + contains matching, normalize() strips punctuation |
| `src/lib/computer-use/cursor-presence.ts` | trackCursorPosition, CURSOR_ENTER_REGION/CURSOR_EXIT_REGION/STEP_ACKNOWLEDGED events, addPresenceListener, resetPresence |
| `src/lib/computer-use/guided-workflow.ts` | startWorkflow, acknowledgeCurrentStep(markerId?), advanceWorkflow, endWorkflow, setMarkerForStep, getCurrentStep, getWorkflowState, registerWatchdogCanceller, WorkflowStep, WorkflowState; calls pauseNarration() on natural completion |
| `src/lib/computer-use/guided-teaching.ts` | isTeachingDemoTrigger, runTeachingDemo, proceedToNextStep, findTeachingTarget, getTeachingDemoSteps; step watchdog on each step |
| `src/lib/computer-use/teardown.ts` | emergencyStop, acknowledgeWatchdog, cancelTeachingWatchdog, startTeachingWatchdog, startStepWatchdog, cancelStepWatchdog, isWatchdogActive, resumeAfterStop |
| `src/lib/computer-use/surface-classifier.ts` | classifyWindowTitle(), formatSurfaceResponse(), getSurfaceEmoji(), getAllSurfaceTypes(), SurfaceType |
| `src/lib/computer-use/inspect-layer.ts` | setLastSurfaceClassification, getLastSurfaceClassification, clearSurfaceInspection, hasRecentInspection, getInspectionSummary |
| `src/lib/computer-use/screen-capture.ts` | captureScreen (stub), injectManualScreenshot, getLastCapturedImage, hasManualScreenshot, clearManualScreenshot |
| `electron/main.js` | computer-use IPC handler |
| `electron/preload.js` | echoMirageComputerUse |
| `src/app/cyberdeck/page.tsx` | detectSelfStatus/detectInspect/detectTeach wired; paste listener on command input captures screenshots; resolveUiTarget in runPointerCommand; handleStop calls emergencyStop + always sets isStreaming(false) |
| `scripts/probe-guided-workflow.ts` | 61 assertions for workflow, cursor, acknowledgement, watchdog, emergency stop, auto-pause narration |
| `scripts/probe-narration.ts` | 13 assertions including TARGET_NOT_FOUND, speakNarration void |
| `scripts/probe-pointer-indicate.ts` | 10 assertions |
| `scripts/probe-surface-awareness.ts` | 39 assertions for surface classification, inspect layer state, safety proof |
| `scripts/probe-ui-alias-registry.ts` | 78 assertions for aliases, normalization, ambiguous matches, unresolved, safety |

---

## Probe Results Summary

| Probe | Assertions | Status |
|-------|-----------|--------|
| `probe-ui-alias-registry.ts` | 78 | PASS |
| `probe-surface-awareness.ts` | 39 | PASS |
| `probe-guided-workflow.ts` | 61 | PASS |
| `probe-narration.ts` | 13 | PASS |
| `probe-pointer-indicate.ts` | 10 | PASS |
| **Total** | **201** | **ALL PASS** |

---

## Dirty Worktree Note
Current uncommitted changes include UI alias registry additions, surface awareness + inspect layer new files, guided teaching voice decoupling fixes, narration listener refactor, step watchdog, auto-pause narration on workflow completion, and probe updates across multiple files.