# E-CYBERDECK-001-P2.5 — Commander Handlers Extraction (Developer Work Order)

**Status:** ACTIVE — queue HEAD  
**Legislator:** [L-CYBERDECK-001](../../work-orders/L-CYBERDECK-001-cyberdeck-app-extraction.md) (D2.8, D2.9)  
**Conductor:** [L-CYBERDECK-001-CONDUCTOR](../../work-orders/L-CYBERDECK-001-CONDUCTOR.md)  
**PR body:** [P2.5-pr-body.md](../../pr-queue/P2.5-pr-body.md)  
**Prior slice:** [JP-P2.4](../../verifications/JP-L-CYBERDECK-001-P2.4.md) PASS — merged `40c6473`

---

## Role

You are the **implementer**. Ship **one** extraction PR. Do **not** self-approve. Hand off to the **tester agent** when done.

| Role | Document |
|------|----------|
| Developer | **this file** |
| Tester | `docs/verifications/VERIFY-L-CYBERDECK-001-P2.5.md` (create from P2.4 template) |
| Conductor | `L-CYBERDECK-001-CONDUCTOR.md` |

---

## Branch setup

```powershell
cd f:\dev\echo-mirage-cyberdeck
git checkout main
git pull origin main
git checkout -b cursor/extract-p2.5-muthur-commander-handlers
```

**Base:** `main` @ `3b61812` (includes P2.4 merge + conductor pop).

---

## Goal

Extract MUTHUR **commander handler logic** (posture, mission, delegation, inhabitant) and the **cognition bridge** out of `cyberdeck-app.tsx`. **Zero behavior change.**

`MuthurChatColumn` already **renders** commander UI (status bar, delegation panel, posture/inhabitant rollers). This slice moves the **state + handlers** that feed those props.

---

## Baseline (before you start)

| Metric | Value |
|--------|------:|
| `cyberdeck-app.tsx` lines | 6,766 |
| Import lines | 142 |
| Probe ceiling | 6,766 / 152 |

**P2.5 line target:** ≤ ~5,200 (aspirational −1,500+). **P2 tranche close target:** ≤ ~4,800 after this slice lands.

---

## Deliverables

### D2.8 — `use-muthur-commander-handlers.ts`

**Create:** `src/features/cyberdeck/muthur/use-muthur-commander-handlers.ts`

**Move from `cyberdeck-app.tsx` (approx. lines 643–650, 1192–1377, persistence effects 1272–1278, 1959–1974):**

| Concern | Move |
|---------|------|
| State | `muthurPosture`, `muthurMission`, `muthurDelegations`, `muthurInhabitant` |
| Handlers | `handleMuthurPostureChange`, `handleMuthurInhabitantChange` |
| Mission | `handleCreateMuthurMission`, `handleStartMuthurMission`, `applyMissionLifecycleResult` |
| Delegation | `handleCreateMuthurDelegation`, `handleDispatchMuthurDelegation`, `handleRecordMuthurDelegationResult`, `handleCancelMuthurDelegation` |
| Persistence | `useEffect` for `saveMuthurMission`, `saveMuthurDelegations`; posture/inhabitant save hooks |

**Hook returns** (names may match existing call sites):

```ts
{
  muthurPosture,
  muthurMission,
  muthurDelegations,
  muthurInhabitant,
  handleMuthurPostureChange,
  handleMuthurInhabitantChange,
  handleCreateMuthurMission,
  handleStartMuthurMission,
  handleCreateMuthurDelegation,
  handleDispatchMuthurDelegation,
  handleRecordMuthurDelegationResult,
  handleCancelMuthurDelegation,
}
```

**Dependencies to inject** (do not duplicate chat/send hooks):

- `setMessages`, `archiveMuthurHistoryLine` (or equivalent from chat state)
- `emitMuthurCognition` from cognition bridge (D2.9)
- `appendMuthurCognitionStatus` from cognition bridge

**Posture `useEffect` side effects** (`saveMuthurPosture`, `setMUTHURMode`, PI lease refresh on agent posture): keep behavior identical. Either:

- move into commander hook with injected `piControlLeaseRefresh` / `piControlLeaseRetake`, or
- return `muthurPosture` from hook and leave a **thin** `useEffect` in app for PI lease only (document in PR if split).

Prefer **one hook owns posture persistence**; app keeps only non-commander side effects if unavoidable.

---

### D2.9 — `use-muthur-cognition-bridge.ts`

**Create:** `src/features/cyberdeck/muthur/use-muthur-cognition-bridge.ts`

**Move from `cyberdeck-app.tsx` (approx. lines 651, 1158–1190):**

| Concern | Move |
|---------|------|
| State | `muthurCognition` (`useState` + `loadMuthurCognition`) |
| Bridge | `emitMuthurCognition`, `appendMuthurCognitionStatus` |
| Derived | `muthurCognitionStatusLine` (`useMemo`) |

**Hook returns:**

```ts
{
  emitMuthurCognition,
  appendMuthurCognitionStatus,
  muthurCognitionStatusLine,
}
```

Wire `setMuthurDiagnostics` from chat state; respect `shouldSurfaceCognitionForPosture(muthurPosture)` exactly as today.

---

## App wiring (after extraction)

`cyberdeck-app.tsx` should:

1. Call `useMuthurCognitionBridge({ muthurPosture, setMuthurDiagnostics, … })`
2. Call `useMuthurCommanderHandlers({ emitMuthurCognition, appendMuthurCognitionStatus, setMessages, archiveMuthurHistoryLine, … })`
3. Pass returned values into `<MuthurChatColumn … />` (props unchanged at the column boundary)
4. **Not** retain `handleMuthurPostureChange` / mission / delegation **function bodies** inline

**Spot-check (must be zero matches for function bodies in app):**

```powershell
Select-String -Path "src\features\cyberdeck\cyberdeck-app.tsx" -Pattern "handleMuthurPostureChange|handleCreateMuthurMission|handleDispatchMuthurDelegation|emitMuthurCognition"
```

Expected: only hook destructure / prop pass-through, not `const handleMuthurPostureChange = useCallback`.

---

## Out of scope (FAIL if touched)

| Area | Phase |
|------|-------|
| `MuthurChatColumn` JSX restructuring | done (P2.4) |
| `handleSend` / `handleStop` / uplink | done (P2.3) |
| Send intents | done (P2.2) |
| Chat state hook | done (P2.1) |
| Gateway column | P3 |
| Layout shell / `ResizablePanelGroup` extraction | P4 |
| Operator / survey hosts | P5 / P6 |
| `/api/cyberdeck-chat/route.ts` | P7 |

Do **not** add `use-muthur-commander-handlers` imports to `muthur-chat-column.tsx` — column stays presentational; app wires props.

---

## Probe ratchet

After extraction, lower **only if lines actually dropped**:

```ts
// scripts/probe-cyberdeck-compile-scope.ts
const MAX_CYBERDECK_APP_LINES = <actual line count or slightly above>;
const MAX_CYBERDECK_APP_IMPORTS = 152; // lower if imports dropped
```

**Never** raise ceilings to greenwash a failed extraction.

---

## Pre-PR checklist

```powershell
cd f:\dev\echo-mirage-cyberdeck
pnpm exec tsc --noEmit
pnpm probe:cyberdeck-compile-scope
pnpm probe:muthur-command-console
pnpm probe:muthur-response-visibility
git diff main...HEAD --stat
```

| Check | Required |
|-------|----------|
| `tsc --noEmit` | exit 0 |
| `probe:cyberdeck-compile-scope` | exit 0 |
| `probe:muthur-command-console` | exit 0 |
| `probe:muthur-response-visibility` | exit 0 |
| Scope diff | primarily new hooks + `cyberdeck-app.tsx` + probe (+ docs) |
| Manual smoke | commander posture roller, mission create/start, delegation panel opens |

---

## Manual smoke (implementer — before handoff)

Warm `pnpm dev`, open `/cyberdeck`:

1. **Posture roller** — switch PLAN / AGENT / COMMANDER; no crash
2. **Commander mode** — delegation panel visible; status bar shows commander state
3. **Mission** — create + start mission (UI flows that worked pre-PR)
4. **Delegation** — create draft delegation (dispatch optional if worker not configured)
5. **Inhabitant roller** — MUTHUR / CODEX / PI switch; system line in chat
6. **Regression** — `muthur help`, send/stream, stop still work (P2.1–P2.3)

---

## PR

```powershell
git push -u origin HEAD
gh pr create `
  --title "refactor: muthur commander handlers hook (L-CYBERDECK-001 P2.5)" `
  --body-file docs/pr-queue/P2.5-pr-body.md `
  --base main
```

**Title:** `refactor: muthur commander handlers hook (L-CYBERDECK-001 P2.5)`

**Stop** after PR is open. Do **not** merge. Notify tester.

---

## Handoff (paste to tester agent)

```text
Verify L-CYBERDECK-001 P2.5 on branch cursor/extract-p2.5-muthur-commander-handlers.

Execute docs/verifications/VERIFY-L-CYBERDECK-001-P2.5.md
Write docs/verifications/JP-L-CYBERDECK-001-P2.5.md
Update docs/work-orders/L-CYBERDECK-001-CONDUCTOR.md
No code changes unless FAIL rework assigned.
```

---

## Evidence for PR description

- `git diff main...HEAD --stat`
- Probe stdout (lines, imports, ceilings)
- Brief note on posture PI-lease effect placement if split from hook

Judicial receipt: `docs/verifications/JP-L-CYBERDECK-001-P2.5.md`
