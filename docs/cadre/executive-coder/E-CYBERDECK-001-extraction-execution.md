# E-CYBERDECK-001 — Cyberdeck Extraction Execution Thread

**Status:** ACTIVE — P0 landed, P1 next  
**Legislator:** [L-CYBERDECK-001](../../work-orders/L-CYBERDECK-001-cyberdeck-app-extraction.md)  
**Conductor:** [L-CYBERDECK-001-CONDUCTOR](../../work-orders/L-CYBERDECK-001-CONDUCTOR.md)  
**Verifier protocol:** [VERIFY-L-CYBERDECK-001](../../verifications/VERIFY-L-CYBERDECK-001.md)  

---

## Role

You are the **implementer** (Executive). You ship small PRs against this thread. You do **not** self-approve phases.

| Role | Agent | Document |
|------|-------|----------|
| Tech lead / conductor | Primary Cursor agent (Legislator) | `L-CYBERDECK-001-CONDUCTOR.md` |
| Developer | Implementation Cursor agent | **this file** |
| Tester / judge | Separate Cursor agent | `VERIFY-L-CYBERDECK-001-P*.md` → writes `JP-L-CYBERDECK-001-P*.md` |

---

## Current sprint

**Phase P1.1** — Extract custom tab model (first code-moving PR after P0).

Do **not** start P2 until P1 tranche is verifier-approved and conductor updates status.

---

## Rules (non-negotiable)

1. **One subsystem per PR** — no drive-by refactors
2. **No behavior change** in P1 unless fixing a bug you introduced
3. **Run before every PR:**
   ```powershell
   cd f:\dev\echo-mirage-cyberdeck
   pnpm exec tsc --noEmit
   pnpm probe:cyberdeck-compile-scope
   ```
4. **Lower ratchet** in `probe-cyberdeck-compile-scope.ts` when you remove lines/imports (see conductor schedule)
5. **Do not** bump `MAX_CYBERDECK_APP_*` ceilings to greenwash CI
6. **Do not** touch operator Monaco/workbench internals ([operator-webview-handoff.md](../../operator-webview-handoff.md))
7. After opening PR / finishing slice: stop and hand off to **verifier agent**

---

## P0 — DONE (implementer)

| ID | Done | Artifact |
|----|------|----------|
| D0.1 | yes | `scripts/probe-cyberdeck-compile-scope.ts` |
| D0.2 | yes | `pnpm probe:cyberdeck-compile-scope` |
| D0.3 | yes | `docs/verifications/JP-L-CYBERDECK-001-P0.md` |

**Verifier:** Run [VERIFY-L-CYBERDECK-001-P0](../../verifications/VERIFY-L-CYBERDECK-001-P0.md) before P1 starts.

---

## P1.1 — IN PROGRESS (developer instructions)

### Goal

Move custom-tab **pure functions and types** out of `cyberdeck-app.tsx` with zero behavior change.

### Create

| New file | Move from `cyberdeck-app.tsx` (approx. lines) |
|----------|-----------------------------------------------|
| `src/features/cyberdeck/workspace/custom-tab-model.ts` | `sanitizeCustomTabs`, `parseCustomTabCommand`, `normalizeCustomTabGlyph`, `normalizeCustomTabKind`, `isCustomTabKind`, `migrateLegacyTestPaneKind`, `defaultCustomTabGlyphForKind`, `defaultCustomTabLabelForKind`, `CUSTOM_TAB_CONTEXT_MENU_ACTIONS`, `CustomTab` / related types |

### Keep in app (for now)

- All React state and handlers that **call** these functions
- `renderCustomTabPane` (P4.2)

### After merge

1. Update probe ceilings:
   - `MAX_CYBERDECK_APP_LINES` → **8_800** (or lower if line count allows)
   - `MAX_CYBERDECK_APP_IMPORTS` → **145** (or lower)
2. Run probes (see Rules)
3. Notify conductor — do not start P1.2 until verifier passes P1.1

### PR title

`refactor(cyberdeck): extract custom tab model from cyberdeck-app (L-CYBERDECK-001 P1.1)`

---

## P1.2 — QUEUED

| New file | Content |
|----------|---------|
| `src/features/cyberdeck/workspace/server-rail-config.ts` | `servers`, `safeServerId`, `SERVER_IDS`, `isFixedServerTabId` |
| `src/features/cyberdeck/gateway/gateway-message-render.tsx` | `renderGatewayMessageText`, gateway key sys helpers |
| `src/features/cyberdeck/muthur/coding-verify-format.ts` | `parseCodingVerifyHeader`, `formatCodingVerifySystemLine` |

---

## P1.3 — QUEUED

| New file | Content |
|----------|---------|
| `src/features/cyberdeck/operator/operator-drop-utils.ts` | `isEditableOperatorFile`, `getOperatorFileKind`, `readFileAsDataUrl`, `DroppedOperatorAsset` |
| `src/features/cyberdeck/shared/cyberdeck-ui-utils.ts` | `textForSpeech`, `contextMenuTargetIsTextField` |
| `src/features/cyberdeck/muthur/build-chat-history.ts` | `buildCyberdeckChatHistory` |

**P1 complete when:** all three PRs verifier-approved; app ≤ 7,600 lines; imports ≤ 95 (update probe).

---

## Later phases (do not start early)

| Phase | Focus | Extra probes |
|-------|-------|--------------|
| P2 | MUTHUR chat / `handleSend` | `probe:muthur-command-console`, `probe:muthur-response-visibility` |
| P3 | Gateway column | `probe:provider-credentials` |
| P4 | Layout shell | `probe:cyberdeck-compile-scope` |
| P5 | Operator host | `probe:operator-file-surface` |
| P6 | Survey hub boundary | `probe:survey-hub`, `probe:survey-connect-boundary` |
| P7 | `cyberdeck-chat` route split | MUTHUR probes |
| P8 | Survey/PowerFist rename | `probe:survey-hub` |

Full map: [L-CYBERDECK-001](../../work-orders/L-CYBERDECK-001-cyberdeck-app-extraction.md).

---

## Handoff template (paste to verifier agent)

```text
Verify L-CYBERDECK-001 phase P1.1.

Read and execute:
  docs/verifications/VERIFY-L-CYBERDECK-001-P1.md  (create from P0 template if missing)
  docs/verifications/VERIFY-L-CYBERDECK-001.md

Write verdict to:
  docs/verifications/JP-L-CYBERDECK-001-P1.md

Do not implement fixes unless FAIL requires rework assignment from conductor.
```

---

## Evidence

Implementation PRs should link:

- Diff stat (`cyberdeck-app.tsx` lines removed)
- Probe stdout
- `tsc` exit 0

Judicial receipts live under `docs/verifications/JP-L-CYBERDECK-001-P*.md`.
