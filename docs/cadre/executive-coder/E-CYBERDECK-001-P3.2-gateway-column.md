# E-CYBERDECK-001-P3.2 — Gateway Column Host (Developer Work Order)

**Status:** ACTIVE — queue HEAD  
**Legislator:** [L-CYBERDECK-001](../../work-orders/L-CYBERDECK-001-cyberdeck-app-extraction.md) (D3.2, D3.3)  
**Conductor:** [L-CYBERDECK-001-CONDUCTOR](../../work-orders/L-CYBERDECK-001-CONDUCTOR.md)  
**PR body:** [P3.2-pr-body.md](../../pr-queue/P3.2-pr-body.md)  
**Prior slice:** [JP-P3.1](../verifications/JP-L-CYBERDECK-001-P3.1.md) PASS — merged `dcae63c`  
**Depends on:** [E-P3.1](E-CYBERDECK-001-P3.1-provider-connection.md) — `useProviderConnection` on `main`

---

## Role

You are the **implementer**. Ship **one** extraction PR. Do **not** self-approve. Hand off to the **tester agent** when done.

| Role | Document |
|------|----------|
| Developer | **this file** |
| Tester | `docs/verifications/VERIFY-L-CYBERDECK-001-P3.2.md` (tech lead preps) |
| Conductor | `L-CYBERDECK-001-CONDUCTOR.md` |

---

## Branch setup

```powershell
cd f:\dev\echo-mirage-cyberdeck
git checkout main
git pull origin main
git checkout -b cursor/extract-p3.2-gateway-column
```

**Base:** `main` @ `dcae63c` (includes P3.1 merge + `use-provider-connection.ts`).

---

## Goal

Extract **gateway pane state** and **gateway column UI** from `cyberdeck-app.tsx`. **Zero behavior change.**

**Closes P3 tranche** (D3.2 + D3.3). Connection logic stays in `useProviderConnection` (P3.1).

---

## Baseline (before you start)

| Metric | Value |
|--------|------:|
| `cyberdeck-app.tsx` lines | 5,878 |
| Import lines | 125 |
| Probe ceiling | 5,878 / 152 |

**P3.2 line target:** ≤ ~5,200 (aspirational −600+). **P3 tranche legislator budget:** ≤ ~3,900 after this slice.

---

## Deliverables

### D3.2 — `provider-pane-state.ts` + `use-gateway-pane-state.ts`

**Create:**

- `src/features/cyberdeck/gateway/provider-pane-state.ts` — shared constants/types for gateway pane chrome
- `src/features/cyberdeck/gateway/use-gateway-pane-state.ts` — keyboard highlight + focus refs

**Move from `cyberdeck-app.tsx`:**

| Concern | Approx. region | Notes |
|---------|----------------|-------|
| State | `providerKeyboardHighlightId`, `modelKeyboardHighlightId` | ~691, 696 |
| Refs | `gatewayColumnRef`, `gatewayConnectionPanelRef` | ~704–705 |
| Focus | `focusGatewayConnectionPanel` | ~736–760 |
| Gateway text chrome | `inactiveTextColor`, `inactiveSubtleTextColor`, `activeTextGlow`, `amberTextGlow`, `inactiveTextGlow` | ~992–997 |
| Scroll highlight effect | provider/model row scroll into view | ~3684–3695 |
| Model highlight reset | clear stale `modelKeyboardHighlightId` on provider/modelList change | ~3697–3704 |

**Optional (preferred if clean):** extract **gateway-only** keyboard arrow handling from the column-scoped `useEffect` (~3248–3645) into `useGatewayColumnKeyboard` inside `use-gateway-pane-state.ts`. The monolithic effect may stay in app **only if** gateway arrows are cleanly delegated via a hook callback — document in PR if split is partial.

**Keep in app (shared with rail/chat):**

- `navRailContext`, `serverKeyboardHighlightId` — rail/gateway focus orchestration (P4)
- Tab-cycle / Escape handling that spans rail + chat + gateway (unless you can split without behavior change)

---

### D3.3 — `gateway-column.tsx`

**Create:** `src/features/cyberdeck/gateway/gateway-column.tsx`

**Move JSX** from `cyberdeck-app.tsx` (~5508–5782):

- Outer `cyberdeck-net-pane` column shell (`ref={gatewayColumnRef}`, context menu, markdown drag-over styling)
- `MirageHeader` + sr-only blurb
- `CyberdeckGatewaySettingsPane` block:
  - dropped markdown preview (if still col-local)
  - MAINNET-UPLINK / # GATEWAY headers
  - provider rows (`providers.map`)
  - connection panel (key input, CONNECT, status, model list)

**Component API (sketch):**

```tsx
export function GatewayColumn(props: {
  // pane state (from useGatewayPaneState)
  gatewayColumnRef: RefObject<HTMLDivElement | null>;
  gatewayConnectionPanelRef: RefObject<HTMLDivElement | null>;
  providerKeyboardHighlightId: string | null;
  modelKeyboardHighlightId: string | null;
  onProviderKeyboardHighlightIdChange: ...
  onModelKeyboardHighlightIdChange: ...
  focusGatewayConnectionPanel: () => void;
  // connection (from useProviderConnection)
  providers: ...;
  activeProvider: string;
  modelList: ...;
  modelID: string;
  hasProviderAuth: boolean;
  // ... all props currently read inside gateway JSX
  // shell
  networkActivityActive: boolean;
  isMarkdownDragOver: boolean;
  mirageHeaderCollapse: number;
  isMobileLayout: boolean;
  deckMode: DeckMode;
  droppedMarkdown: string | null;
  // handlers
  onContextMenu: ...
  onDragOver: ...
  onDragLeave: ...
  onDrop: ...
  handleProviderClick: ...
  submitGatewayKey: ...
  activateModelById: ...
  // generatedUI feed block
  generatedUI: string | null;
});
```

Reuse `CyberdeckGatewaySettingsPane` from `cyberdeck-pane-slots.tsx` (legislator).

**App after extraction:**

```tsx
<ResizablePanel ...>
  <GatewayColumn {...gatewayColumnProps} />
  <CyberdeckFixedServerPane serverId="m">...</CyberdeckFixedServerPane>
  ...
</ResizablePanel>
```

Operator / survey panes **stay** in `cyberdeck-app.tsx` (P5/P6).

---

## App wiring (after extraction)

1. Call `useGatewayPaneState()` alongside `useProviderConnection()`
2. Render `<GatewayColumn />` inside col-3 `ResizablePanel` (operator pane below unchanged)
3. Pass connection outputs + pane state + handlers as props
4. **No** inline provider/model row JSX in app

**Spot-check:**

```powershell
Select-String -Path "src\features\cyberdeck\cyberdeck-app.tsx" -Pattern "MAINNET-UPLINK|# GATEWAY|data-provider-row|gateway-provider-key"
```

**Expected:** zero matches (moved to `gateway-column.tsx`).

```powershell
Select-String -Path "src\features\cyberdeck\cyberdeck-app.tsx" -Pattern "GatewayColumn"
```

**Expected:** at least one match.

---

## Out of scope (FAIL if touched)

| Area | Phase |
|------|-------|
| `use-provider-connection.ts` logic changes | P3.1 done |
| Operator pane JSX inside col 3 | P5 |
| Layout `ResizablePanelGroup` shell | P4 |
| MUTHUR chat / send / commander | P2 done |
| Survey hosts | P6 |

Do **not** refactor provider connection fetch/probe in this PR.

---

## Probe ratchet

After extraction, lower **only if lines actually dropped**:

```ts
// scripts/probe-cyberdeck-compile-scope.ts
const MAX_CYBERDECK_APP_LINES = <actual line count>;
```

---

## Pre-PR checklist

```powershell
cd f:\dev\echo-mirage-cyberdeck
pnpm exec tsc --noEmit
pnpm probe:cyberdeck-compile-scope
pnpm probe:muthur-command-console
pnpm probe:muthur-response-visibility
pnpm probe:provider-credentials
git diff main...HEAD --stat
```

| Check | Required |
|-------|----------|
| All probes + `tsc` | exit 0 |
| Scope diff | gateway column + pane state + app + probe (+ docs) |
| Manual smoke | provider select, key connect, model list, keyboard arrows in gateway, send |

---

## Manual smoke (implementer — before handoff)

Warm `pnpm dev` (if `.next` corrupt: `Remove-Item -Recurse -Force .next` then restart), `/cyberdeck`:

1. **Gateway column** — MAINNET-UPLINK / provider list visible
2. **Provider click** — `[X]` marker moves
3. **Key / models** — connect + model select (if keys available)
4. **Keyboard** — arrow keys move provider/model highlight in gateway column
5. **Tab focus** — Tab from composer cycles through gateway/rail/chat
6. **Markdown drop** — drop on gateway column still works (if testable)
7. **Regression** — MUTHUR send, posture, `muthur help`, operator pane still opens

---

## PR

```powershell
git push -u origin HEAD
gh pr create `
  --title "refactor: gateway column host (L-CYBERDECK-001 P3.2)" `
  --body-file docs/pr-queue/P3.2-pr-body.md `
  --base main
```

**Title:** `refactor: gateway column host (L-CYBERDECK-001 P3.2)`

**Stop** after PR is open. Do **not** merge. Notify tester.

---

## Handoff (paste to tester agent)

```text
Verify L-CYBERDECK-001 P3.2 on branch cursor/extract-p3.2-gateway-column.

Execute docs/verifications/VERIFY-L-CYBERDECK-001-P3.2.md
Write docs/verifications/JP-L-CYBERDECK-001-P3.2.md
Update docs/work-orders/L-CYBERDECK-001-CONDUCTOR.md
No code changes unless FAIL rework assigned.
```

Judicial receipt: `docs/verifications/JP-L-CYBERDECK-001-P3.2.md`
