# What Did We Do So Far — Echo Mirage Cyberdeck

## Goal
Build and refine Echo Mirage Cyberdeck features including computer use layer, MU/TH/UR ownership, pointer/indicate mode, guided teaching, cursor presence, operational narration, voice integration, surface awareness, UI semantic aliases, workflow observation, and Execution Deck.

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
- Watchdog timeout (60s) must auto-recover if teaching gets stuck; 30s per-step watchdog
- No LLM-based fuzzy matching for alias resolution
- Do not route unresolved indicate requests to self-status or browser search
- No continuous screenshot monitoring; observation requires explicit user request
- No autonomous actions in workflow observation
- Execution Deck v0.1: UI/state/narration only, no shell execution, no IPC expansion, no hidden automation
- Execution Deck Pane v0: UI/state/routing only, no real script execution yet

---

## Progress

### Done

**Computer Use Layer v0**: typed action primitives, safety guard, action runner, capability registry

**Electron Bridge v0**: IPC handlers in main.js, contextBridge preload with narrow echoMirageComputerUse API

**Capability Registry v0**: central definitions with category, confirmationPolicy, environments, getActionScope()

**Control Lease + Ownership State v0**: ControlOwner (USER/SHARED/MUTHUR), ControlScope, ControlLease, retake/grant/request/revoke/expire, event log

**Control Lease Hardening v0**: retake() denies non-USER; revokeLease() returns real retake result; grantLease() unexported; CONTROL_DENIED emitted from action-runner

**Pointer / Indicate Mode v0**: indicate_point, indicate_highlight, clear_indicators actions; IndicateOverlay React component (pointerEvents: none); MUTHURMode type; INDICATE_STARTED/UPDATED/CLEARED events; indicate-layer.ts marker state; category "output"

**Operational Introspection Layer v0**: getComputerUseStatus(), formatStatusText(), formatSurfaceStatus(), formatObservationStatus(), intent-detect.ts with detectSelfStatusIntent() and detectInspectIntent()

**Voice Lab Master Gain Slider**: replaced Knob with native `<input type="range">` in voice-lab-pane-body.tsx

**Vox Net / Operational Narration v0**: narration.ts with NarrationEvent types, NARRATION_MAP, listeners, narrate(), speakNarration() (fire-and-forget void), narrateAndSpeak(), pauseNarration()/resumeNarration()/resetNarrationDebounce(), debounce (3s, max 3 repeats); CURSOR_ENTER_REGION ("Step acknowledged."), STEP_ACKNOWLEDGED ("Proceeding to next instruction."), TARGET_NOT_FOUND ("Unable to locate teaching target."); narration listener uses failureCountRef with .then(()=0) reset and .catch() increment; ≥3 failures aborts speech

**Narration Events v0.1**: HAND_PREPARED ("Reviewer Hand prepared."), HAND_PUSHED_TO_STACK ("Hand pushed to stack."), EXECUTION_DISABLED ("Execution disabled in v0.1."), EXECUTION_DECK_CLEARED ("Execution Deck cleared.")

**UI Semantic Alias Registry v0**: ui-alias-registry.ts with resolveUiTarget(); CanonicalTarget: COMMAND_INPUT, VOICE_LAB, LEFT_CONSOLE, RIGHT_PANEL, CENTER_STAGE; exact match + single contains match; structured failure for unresolved targets; TARGET_NOT_RECOGNIZED response; normalize() strips punctuation (. , ? ! etc.); added "volume slider" VOICE_LAB, "event log" LEFT_CONSOLE, "doctrine panel" RIGHT_PANEL; "panel" and "box" ambiguous → null; 37 aliases across 5 targets

**Guided Teaching / Cursor Presence v0**: cursor-presence.ts (trackCursorPosition, CURSOR_ENTER_REGION/CURSOR_EXIT_REGION/STEP_ACKNOWLEDGED events, addPresenceListener, resetPresence); guided-workflow.ts (startWorkflow, acknowledgeCurrentStep(markerId?), advanceWorkflow, endWorkflow, setMarkerForStep, getCurrentStep, getWorkflowState, registerWatchdogCanceller, WorkflowStep, WorkflowState; advanceWorkflow calls pauseNarration() when workflow naturally completes); cursor tracking via IndicateOverlay.tsx mousemove listener; presence listener calls acknowledgeCurrentStep + advanceWorkflow + proceedToNextStep on CURSOR_ENTER_REGION; getPresenceState() and guidedWorkflow exposed in introspection

**Guided Teaching Scenario v0**: guided-teaching.ts (isTeachingDemoTrigger with 6 patterns, runTeachingDemo, proceedToNextStep, getTeachingDemoSteps); trigger wired into page.tsx before runPointerCommand and detectSelfStatus; 2-step teaching demo (COMMAND_INPUT → VOICE_LAB); teaching markers use indicate_highlight with width/height (always visible); end of workflow calls clearMarkers() via advanceWorkflow; step watchdog on each step start (startStepWatchdog/cancelStepWatchdog in teardown.ts)

**Guided Teaching Debug Visibility v0**: DEBUG = NODE_ENV !== "production" in indicate-layer.ts, guided-teaching.ts, IndicateOverlay.tsx; [INDICATE-DEBUG] logs on indicate_point/highlight; [TEACHING-DEBUG] logs; [OVERLAY-DEBUG] poll logs every 200ms; getActiveGuidedMarker() + guidedMarker field in introspection

**Guided Teaching Overlay Reliability v0**: findTeachingTarget() with explicit element resolution, bounds validation, narrate("TARGET_NOT_FOUND") on failure; indicate_highlight for teaching; minimum marker size 80x48; getActiveGuidedMarker() returns MarkerInfo with id/style/position/label/width/height/bounds/hasRegion; renderCountRef for render tracking

**Stuck Runtime Kill Switch v0**: teardown.ts (emergencyStop, acknowledgeWatchdog, cancelTeachingWatchdog, startTeachingWatchdog, startStepWatchdog, cancelStepWatchdog, isWatchdogActive, resumeAfterStop); emergencyStop clears workflow, markers, pauses narration, resets presence; watchdog timer 60s auto-trigger; handleStop calls emergencyStop + cancelTeachingWatchdog + cancelStepWatchdog + always sets isStreaming(false) (no isStreaming guard); acknowledgeWatchdog called after each step start and after cursor enters region; cancelStepWatchdog() on overlay cleanup and on cursor enter; cancelTeachingWatchdog() on overlay unmount; registerWatchdogCanceller wired into guided-workflow

**Teaching Demo Voice Decoupling v0**: teach workflow independent of voice render; speakNarration() returns void; narration listener uses failureCountRef (ref not closure var) with .then(()=0) reset + .catch() increment; ≥3 consecutive failures aborts speech + resets; resumeAfterStop() on listener cleanup; handleStop always clears STREAMING (no isStreaming guard); advanceWorkflow calls pauseNarration() on natural completion; cancelStepWatchdog() on cursor enter

**External Surface Awareness v0**: surface-classifier.ts with pattern-based SurfaceType classification (chatgpt, opencode, codex, vscode, terminal, browser, unknown); classifyWindowTitle(), formatSurfaceResponse(), getSurfaceEmoji(); inspect-layer.ts singleton state (setLastSurfaceClassification, getLastSurfaceClassification, clearSurfaceInspection, hasRecentInspection, getInspectionSummary); detectInspectIntent() with 15 patterns; inspect wired in page.tsx before self-status; paste listener on command input captures data:image/ as data URL; screenshot auto-classifies as "unknown" with note; no continuous monitoring, no autonomous action

**UI Semantic Alias Registry v0 (enhanced)**: normalize() strips punctuation; added aliases; probe-ui-alias-registry.ts with 89 assertions

**Workflow Observation v0**: workflow-observation.ts with state machine (inactive/observing/paused/complete), startObservation/stopObservation/pauseObservation/resumeObservation/isObserving/isPaused/isActive/getSession/recordEvent/confirmEvent/getEvents/getConfirmedEvents/getOptionalEvents/getRecoveryEvents/getEventCount/formatDraftProcedure/resetObservation; ALLOWED_EVENT_TYPES whitelist (16 types including indicate_point, indicate_highlight, clear_indicators, cursor_enter_region, step_acknowledged, teaching_start, teaching_end, self_status_request, inspect_request, alias_resolved, execution_deck_opened, hand_prepared, card_staged, stack_cleared, hand_pushed_to_stack, execution_attempt_blocked); BLOCKED_KEYWORDS sanitization for context; recordEvent() queues question + sanitizes; confirmEvent() marks confirmed (record_this/yes only, NOT optional); formatDraftProcedure() outputs structured draft with Confirmed/Optional/Recovery/Skipped sections; question-queue.ts with queueQuestion/answerQuestion/getNextPendingQuestion/getQuestionQueue/getPendingQuestionCount/hasPendingQuestions/getAnswerSummary; 7 answer types (yes/no/skip/record_this/ignore_this/optional/recovery); detectObserveIntent/detectStopObserveIntent/detectPauseObserveIntent/detectResumeObserveIntent in intent-detect.ts; getNextPendingQuestion + getPendingQuestionCount + answerQuestion re-exported from workflow-observation.ts; workflowObservation in getComputerUseStatus(); formatObservationStatus()

**Build Fixes v1**: exported getNextPendingQuestion + getPendingQuestionCount + answerQuestion from workflow-observation.ts; updated assert() in probe-workflow-observation.ts to accept boolean | (() => boolean) and added null guard for pending question; fixed confirmEvent() so confirmed=true only for record_this/yes (not optional); added workflow observation routing (stop/pause/resume/start) in page.tsx handleSend; fixed exec/spawn safety regex in probe-workflow-observation.ts to use word boundaries \b(exec|spawn)\b

**Execution Deck v0.1**: execution-deck.ts with ExecutionCard, ExecutionHand, ExecutionDeckState, card lifecycle staged→stacked→running→complete|failed|skipped|blocked; executionEnabled hardcoded false; pushHandToStack() moves hand to stack (changes status to stacked, clears stagedHand); attemptExecute() always returns blocked with "Execution disabled in v0.1"; removeCard() searches both stagedHand.cards AND executionStack; describeDeck() always shows header + Execution DISABLED (no early return); isExecutionEnabled(), getTopStackCard(), getStackCards(), getCurrentStatuses() accessors; buildReviewerHand() creates 4 cards (Capture Builder Result, Request Codex Review, Summarize Review, Archive Outcome); detectExecDeckShowIntent/PrepareIntent/ClearIntent/PushIntent/ExecuteIntent; narration calls on prepare/push/clear/execute; page.tsx wired after answer question route; probe-execution-deck.ts with 89 assertions all PASS

**Execution Deck Pane v0**: ExecutionDeckPane React component, right-side pane conditionally visible (showExecutionDeckPane state); shows: active hand name, STAGED count, STACK depth, EXEC ON|OFF, staged cards with title/purpose/risk/CONF badge, stack cards with top marker (▶) and status badges, top of stack info, empty state; controls: PUSH HAND TO STACK (disabled when stack exists), CLEAR DECK (disabled when deck empty), EXECUTE (disabled when no stack — execution blocked at attemptExecute() regardless); pane closes on clearDeck via control; pane shows on all deck commands (show/prepare/push/describe/execute); wire into page.tsx right pane with showExecutionDeckPane state; getExecutionDeckState imported and used in pane props

**Operational Vocabulary Aliases v0**: intent-detect.ts extended with EXEC_DECK_DESCRIBE_STAGED_PATTERNS; extended EXEC_DECK_SHOW_PATTERNS (show the deck, show deck, describe deck); extended EXEC_DECK_PREPARE_PATTERNS (workflow/combo/play/routine/sequence/setup variants); extended EXEC_DECK_PUSH_PATTERNS (play/workflow/combo/routine/sequence/setup variants); extended EXEC_DECK_EXECUTE_PATTERNS (execute alone, run the play/workflow/combo/routine/sequence/setup); extended EXEC_DECK_CLEAR_PATTERNS (clear deck, empty deck); detectExecDeckDescribeStagedIntent() added; classifyIntent() updated with exec_deck_describe_staged; IntentType updated; probe-exec-deck-vocabulary.ts with 58 assertions all PASS

**Playwright E2E timeout increased from 60000 to 120000** (Windows + Next.js dev server navigation can exceed 60s); playwright.config.ts timeout 120000ms; reuseExistingServer: true

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
- Surface awareness is observation-only; no click/type/focus; honest unsupported/fallback messages
- UI alias resolution: exact match first, then single contains match, then unresolved; normalize() strips punctuation; ambiguous ("panel", "box") → null
- Workflow observation: state machine controls recording; only allowlisted event types recorded; sensitive keywords sanitized; questions queued on each event; answers determine confirmed (record_this/yes)/optional/recovery/ignored
- confirmEvent sets confirmed=true only for record_this/yes — NOT for optional (optional events go to getOptionalEvents, not getConfirmedEvents)
- Teaching voice decoupling: fire-and-forget narration listener, failureCountRef counter, auto-resume on cleanup, STREAMING always cleared on stop
- "chat input" alone is unresolved — no exact match, no single-target contains match
- Routing order: tab creation → tab clear/convert/delete → settings → self-status → inspect → stop/pause/resume/start workflow observation → pending question answers → execution deck show/prepare/push/clear/execute → teaching → pointer/indicate → browser → chat stream
- Unresolved indicate returns early from runPointerCommand — does NOT fall through to browser/search/chat
- Execution Deck: prepareHand() stages cards (stack empty) — explicit pushHandToStack() required to move to execution stack; attemptExecute() always blocked (executionEnabled=false); removeCard() removes from whichever list (staged or stack) contains the card
- describeDeck() always outputs full header including "Execution: DISABLED" — no conditional early return
- Execution Deck Pane renders in right-side ResizablePanel when showExecutionDeckPane=true; otherwise renders normal gateway content (gateway panel / operator pane / settings pane)
- Vocabulary aliases use deterministic normalize (lowercase, strip punctuation) with contains matching; unresolved deck commands return locally without browser/search fallback

---

## Next Steps
- (none)

---

## Critical Context

**E2E test stability**: port 3050 cleanup when TIME_WAIT accumulates; navigation fallback load→domcontentloaded; playwright.config.ts timeout 120000ms; reuseExistingServer: true

**ACTION_NAME includes**: get_active_window, list_open_windows, capture_screen, focus_window, paste_text, hotkey, verify_text_visible, verify_window_active, stop_execution, indicate_point, indicate_highlight, clear_indicators, unknown

**MUTHURMode**: OBSERVE | INDICATE | ASSIST | USE

**IndicateOverlay polls getMarkers() every 200ms**, renderCountRef tracks render cycles

**Probe results**:
- probe-ui-alias-registry.ts: 89 PASS
- probe-surface-awareness.ts: 37 PASS
- probe-guided-workflow.ts: 33 PASS
- probe-narration.ts: 13 PASS
- probe-pointer-indicate.ts: 10 PASS
- probe-workflow-observation.ts: 87 PASS
- probe-execution-deck.ts: 89 PASS
- probe-exec-deck-vocabulary.ts: 58 PASS

**Routing order in page.tsx handleSend**:
1. tab creation
2. tab clear/convert/delete
3. settings command
4. detectSelfStatusIntent → formatStatusText()
5. detectInspectIntent → formatSurfaceResponse() or fallback
6. detectStopObserveIntent → stopObservation()
7. detectPauseObserveIntent → pauseObservation()
8. detectResumeObserveIntent → resumeObservation()
9. detectObserveIntent → startObservation()
10. answer question (yes/no/skip/record_this/ignore_this/optional/recovery)
11. detectExecDeckShowIntent → openDeck + showExecutionDeckPane + describeDeck
12. detectExecDeckPrepareIntent → openDeck + prepareHand + showExecutionDeckPane
13. detectExecDeckDescribeStagedIntent → describe staged hand + showExecutionDeckPane
14. detectExecDeckClearIntent → clearDeck + narrate + setShowExecutionDeckPane(false)
15. detectExecDeckPushIntent → openDeck + pushHandToStack + showExecutionDeckPane
16. detectExecDeckExecuteIntent → openDeck + attemptExecute + narrate + showExecutionDeckPane
17. isTeachingDemoTrigger → runTeachingDemo()
18. runPointerCommand (indicate/highlight/clear via resolveUiTarget)
19. parseBrowserCommand / parseBrowserUseModeCommand
20. chat stream (model inference)

**Unresolved indicate** (`TARGET_NOT_RECOGNIZED`) returns early from runPointerCommand — does NOT fall through to browser/search/chat

**IndicateOverlay cleanup**: cancelTeachingWatchdog(), cancelStepWatchdog(), clearInterval(pollInterval), removeEventListener(mousemove), resetPresence()

**Overlay div**: pointerEvents: "none" — never blocks input regardless of markers

**acknowledgeCurrentStep markerId=null behavior**: when state.markerId is null, any markerId (including undefined) is accepted — wildcard for steps without explicit markerId set

**Teaching markers labeled**: "COMMAND_INPUT" / "VOICE_LAB" (canonical names, not step labels)

**Execution Deck Pane conditions**: pane visible when showExecutionDeckPane=true (set by show/prepare/push/describe/execute), hidden after clearDeck control or explicit close

**Vocabulary alias domains**:
- Domain: deck, execution deck
- Game: play, combo, routine, sequence, setup, workflow
- Deck: hand, stack, push, clear, execute
- Play: one card or sequence of cards in hand
- Stack: committed cards awaiting execution

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
| `src/lib/computer-use/IndicateOverlay.tsx` | React component, pointerEvents:none, mousemove listener, presence listener, renderCountRef, DEBUG logs, observation instrumentation (cursor_enter_region, step_acknowledged, teaching_end), cancelStepWatchdog on cleanup |
| `src/lib/computer-use/narration.ts` | NarrationEvent, NARRATION_MAP, narrate()/speakNarration()/narrateAndSpeak(), pauseNarration()/resumeNarration()/resetNarrationDebounce(), debounce, CURSOR_ENTER_REGION, STEP_ACKNOWLEDGED, TARGET_NOT_FOUND, isNarrationPaused; v0.1 additions: HAND_PREPARED, HAND_PUSHED_TO_STACK, EXECUTION_DISABLED, EXECUTION_DECK_CLEARED |
| `src/lib/computer-use/introspection.ts` | getComputerUseStatus(), formatStatusText(), formatSurfaceStatus(), formatObservationStatus(), getActiveGuidedMarker(), MarkerInfo, surfaceAwareness, workflowObservation, executionDeck in status |
| `src/lib/computer-use/intent-detect.ts` | detectSelfStatusIntent(), detectInspectIntent(), detectObserveIntent(), detectStopObserveIntent(), detectPauseObserveIntent(), detectResumeObserveIntent(), detectExecDeckShowIntent(), detectExecDeckPrepareIntent(), detectExecDeckDescribeStagedIntent(), detectExecDeckClearIntent(), detectExecDeckPushIntent(), detectExecDeckExecuteIntent(), classifyIntent() returning IntentType |
| `src/lib/computer-use/ui-alias-registry.ts` | resolveUiTarget(), CanonicalTarget, exact + contains matching, normalize() strips punctuation |
| `src/lib/computer-use/cursor-presence.ts` | trackCursorPosition, CURSOR_ENTER_REGION/CURSOR_EXIT_REGION/STEP_ACKNOWLEDGED events, addPresenceListener, resetPresence |
| `src/lib/computer-use/guided-workflow.ts` | startWorkflow, acknowledgeCurrentStep(markerId?), advanceWorkflow, endWorkflow, setMarkerForStep, getCurrentStep, getWorkflowState, registerWatchdogCanceller, WorkflowStep, WorkflowState; calls pauseNarration() on natural completion |
| `src/lib/computer-use/guided-teaching.ts` | isTeachingDemoTrigger, runTeachingDemo, proceedToNextStep, findTeachingTarget, getTeachingDemoSteps; step watchdog on each step |
| `src/lib/computer-use/teardown.ts` | emergencyStop, acknowledgeWatchdog, cancelTeachingWatchdog, startTeachingWatchdog, startStepWatchdog, cancelStepWatchdog, isWatchdogActive, resumeAfterStop |
| `src/lib/computer-use/surface-classifier.ts` | classifyWindowTitle(), formatSurfaceResponse(), getSurfaceEmoji(), getAllSurfaceTypes(), SurfaceType; patterns for chatgpt/opencode/codex/vscode/terminal/browser/unknown |
| `src/lib/computer-use/inspect-layer.ts` | setLastSurfaceClassification, getLastSurfaceClassification, clearSurfaceInspection, hasRecentInspection, getInspectionSummary |
| `src/lib/computer-use/execution-deck.ts` | ExecutionCard, ExecutionHand, ExecutionDeckState; CardStatus: staged|stacked|blocked|running|complete|failed|skipped; executionEnabled=false; openDeck/prepareHand/buildReviewerHand/pushHandToStack/attemptExecute/stageCard/removeCard/updateCardStatus/clearDeck/describeDeck; isExecutionEnabled/getTopStackCard/getStackCards/getCurrentStatuses; getExecutionDeckState exported |
| `src/lib/computer-use/workflow-observation.ts` | startObservation/stopObservation/pauseObservation/resumeObservation/isObserving/isPaused/isActive/getSession/recordEvent/confirmEvent/getEvents/getConfirmedEvents/getOptionalEvents/getRecoveryEvents/getEventCount/formatDraftProcedure/resetObservation; ALLOWED_EVENT_TYPES (16 types); BLOCKED_KEYWORDS sanitization; getNextPendingQuestion + getPendingQuestionCount + answerQuestion re-exported; confirmEvent confirmed=true for record_this/yes only |
| `src/lib/computer-use/question-queue.ts` | queueQuestion/answerQuestion/getNextPendingQuestion/getQuestionQueue/getPendingQuestionCount/hasPendingQuestions/clearQuestions/removeAnsweredQuestions/getAnswerSummary; ClarifyingQuestion, QuestionEntry, SupportedAnswer types |
| `src/components/cyberdeck/execution-deck-pane.tsx` | ExecutionDeckPane React component; staged hand view, stack view, top-of-stack, controls (PUSH disabled when stack exists, CLEAR disabled when empty, EXECUTE disabled when no stack — execution always blocked at attemptExecute() regardless); empty state; color-coded risk levels and status badges |
| `electron/main.js` | computer-use IPC handler |
| `electron/preload.js` | echoMirageComputerUse |
| `src/app/cyberdeck/page.tsx` | full routing: tab create/clear/convert/delete → settings → self-status → inspect → stop/pause/resume/start workflow observation → pending question answers → exec deck show/prepare/describe_staged/push/clear/execute → teaching → pointer → browser → chat stream; showExecutionDeckPane state; ExecutionDeckPane conditionally rendered in right ResizablePanel; narrate() calls for execution deck events; handleStop calls emergencyStop + always sets isStreaming(false) |
| `scripts/probe-guided-workflow.ts` | 33 assertions |
| `scripts/probe-narration.ts` | 13 assertions |
| `scripts/probe-pointer-indicate.ts` | 10 assertions |
| `scripts/probe-surface-awareness.ts` | 37 assertions |
| `scripts/probe-ui-alias-registry.ts` | 89 assertions |
| `scripts/probe-workflow-observation.ts` | 87 assertions; assert() updated to boolean | (() => boolean); null guard for pending question; exec/spawn regex uses word boundaries |
| `scripts/probe-execution-deck.ts` | 89 assertions; all PASS |
| `scripts/probe-exec-deck-vocabulary.ts` | 58 assertions for vocabulary aliases and intent classification; all PASS |
| `playwright.config.ts` | timeout 120000ms, baseURL http://127.0.0.1:3050, webServer command pnpm dev, reuseExistingServer: true |

---

## Probe Results Summary

| Probe | Assertions | Status |
|-------|-----------|--------|
| `probe-ui-alias-registry.ts` | 89 | PASS |
| `probe-surface-awareness.ts` | 37 | PASS |
| `probe-guided-workflow.ts` | 33 | PASS |
| `probe-narration.ts` | 13 | PASS |
| `probe-pointer-indicate.ts` | 10 | PASS |
| `probe-workflow-observation.ts` | 87 | PASS |
| `probe-execution-deck.ts` | 89 | PASS |
| `probe-exec-deck-vocabulary.ts` | 58 | PASS |
| **Total** | **416** | **ALL PASS** |

---

## Dirty Worktree Note
Current uncommitted changes include Execution Deck v0.1 state/narration, Execution Deck Pane v0 (new component), operational vocabulary aliases in intent-detect.ts, routing updates in page.tsx, vocabulary probe (probe-exec-deck-vocabulary.ts), and probe-execution-deck.ts fix for false positive assertion.