# E-CYBERDECK-001-P4.1 — Layout Shell (Developer Work Order)

**Status:** ACTIVE — queue HEAD  
**Legislator:** [L-CYBERDECK-001](../../work-orders/L-CYBERDECK-001-cyberdeck-app-extraction.md) (D4.1, D4.2)  
**Conductor:** [L-CYBERDECK-001-CONDUCTOR](../../work-orders/L-CYBERDECK-001-CONDUCTOR.md)  
**PR body:** [P4.1-pr-body.md](../../pr-queue/P4.1-pr-body.md)  
**Prior slice:** [JP-P3.2](../verifications/JP-L-CYBERDECK-001-P3.2.md) PASS — merged `624f7d8`  
**Depends on:** P3 complete — `GatewayColumn`, `MuthurChatColumn`, `CyberdeckServerRail` on `main`

---

## Role

You are the **implementer**. Ship **one** extraction PR. Do **not** self-approve. Hand off to the **tester agent** when done.

| Role | Document |
|------|----------|
| Developer | **this file** |
| Tester | `docs/verifications/VERIFY-L-CYBERDECK-001-P4.1.md` (tech lead preps) |
| Conductor | `L-CYBERDECK-001-CONDUCTOR.md` |

---

## Branch setup

```powershell
cd f:\dev\echo-mirage-cyberdeck
git checkout main
git pull origin main
git checkout -b cursor/extract-p4.1-layout-shell
```

**Base:** `main` @ `f99923c` (P3.2 merge `624f7d8` + judicial docs).

---

## Goal

Extract the **resizable chat/gateway layout shell** and **mobile layout hook** from `cyberdeck-app.tsx`. **Zero behavior change.**

Opens **P4 tranche** (D4.1 + D4.2). Custom tab renderer, context menus, and rail chrome stay for **P4.2 / P4.3**.

---

## Baseline (before you start)

| Metric | Value |
|--------|------:|
| `cyberdeck-app.tsx` lines | 5,604 |
| Import lines | 125 |
| Probe ceiling | 5,604 / 125 |

**P4.1 line target:** ≤ ~4,900 (aspirational −700+). **P4 tranche legislator budget:** ≤ ~2,500 after full P4.

---

## Deliverables

### D4.2 — `use-mobile-cyberdeck-layout.ts`

**Create:** `src/features/cyberdeck/layout/use-mobile-cyberdeck-layout.ts`

**Move from `cyberdeck-app.tsx`:**

| Concern | Approx. region | Notes |
|---------|----------------|-------|
| `isMobileLayout` state + `matchMedia` effect | ~637–639, ~3111–3117 | `(max-width: 768px)` |
| `mobileContentSplit` state | ~641 | default `[0.58, 0.42]` |
| `handleContentSplitSizesChange` | ~642–644 | feeds split persistence |
| `mirageHeaderCollapse` | ~645–653 | derived from gateway column fraction |

**Export:**

```ts
export function useMobileCyberdeckLayout(): {
  isMobileLayout: boolean;
  mobileContentSplit: number[];
  handleContentSplitSizesChange: (sizes: number[]) => void;
  mirageHeaderCollapse: number;
};
```

App replaces inline state/effects with one hook call. Pass `isMobileLayout` / `mirageHeaderCollapse` into existing children as today.

---

### D4.1 — `cyberdeck-layout-shell.tsx`

**Create:** `src/features/cyberdeck/layout/cyberdeck-layout-shell.tsx`

**Move JSX** from `cyberdeck-app.tsx` (~5361–5587):

- Outer `data-morphism={MORPHISM_ZONE_REALMORPHISM}` wrapper
- `ResizablePanelGroup` (`key`, `orientation`, `memoryKey="cyberdeck-content-split-v2"`, `onSizesChange`)
- Chat `ResizablePanel` + `ResizableHandle` + gateway `ResizablePanel` **structure only**
- Resizer classNames (mobile stacked vs desktop)

**Do not move pane bodies** — pass as children:

```tsx
export type CyberdeckLayoutShellProps = {
  isMobileLayout: boolean;
  onContentSplitSizesChange: (sizes: number[]) => void;
  chatColumn: ReactNode;
  gatewayColumn: ReactNode;
};

export function CyberdeckLayoutShell({ ... }: CyberdeckLayoutShellProps) { ... }
```

App keeps `<MuthurChatColumn … />` and `<GatewayColumn … />` wiring; shell receives them as `chatColumn` / `gatewayColumn` props (or `children` tuple — pick one, document in PR).

**Imports to move with shell:** `ResizablePanel`, `ResizablePanelGroup`, `ResizableHandle` from resizable UI; `MORPHISM_ZONE_REALMORPHISM` if only used here.

---

## Keep in app (P4.1)

| Concern | Reason |
|---------|--------|
| Root `terminal-window` + `cyberdeckRootRef` | orchestrator shell |
| `CyberdeckBootSequence`, persistence hosts, overlays | not layout split |
| `CyberdeckServerRail` | workspace chrome — **P4.2/P4.3** |
| Context menu overlays (`railTabContextMenu`, `mirageContextMenu`, `gatewayPaneContextMenu`) | **P4.3** (`cyberdeck-context-menus.tsx`) |
| `navRailContext`, keyboard `useEffect` spanning rail/chat/gateway | focus orchestration — split only if zero behavior risk |
| `renderCustomTabSurface` / `CyberdeckCustomTabPanes` | **P4.2** |
| Operator pane props inside `GatewayColumn` children | **P5** |

---

## Out of scope (FAIL if touched)

- `gateway-column.tsx` / `use-gateway-pane-state.ts` rework (P3 done)
- `use-provider-connection.ts` rework (P3.1 done)
- MUTHUR send / commander hooks (P2 done)
- Custom tab browser / context menu extraction (P4.2–P4.3)
- Operator pane host (P5)
- Survey / PowerFist (P6)

---

## Probe ratchet

After extraction, lower **only if lines actually dropped**:

```ts
// scripts/probe-cyberdeck-compile-scope.ts
const MAX_CYBERDECK_APP_LINES = <actual line count>;
const MAX_CYBERDECK_APP_IMPORTS = <actual import count>;
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
| Scope diff | layout shell + mobile hook + app + probe (+ docs) |
| Manual smoke | desktop + mobile split, resize handle, gateway + chat + rail |

**P4 layout probe (when available):** `pnpm e2e:layout` — run if CI/local harness is green; document skip if blocked.

---

## Manual smoke (implementer — before handoff)

Warm `pnpm dev`, `/cyberdeck`:

1. **Desktop** — horizontal split; drag chat/gateway resizer; sizes persist on reload (`cyberdeck-content-split-v2`)
2. **Mobile** — narrow viewport (≤768px) or DevTools; vertical stack; gateway header collapse behaves when resizing
3. **Chat column** — send `muthur help`; stream still works
4. **Gateway column** — provider select, model list
5. **Server rail** — tab switch μ / Ø / custom tabs still works
6. **Regression** — boot sequence, posture roller, operator pane inside gateway column

---

## PR

```powershell
git push -u origin HEAD
gh pr create `
  --title "refactor: cyberdeck layout shell (L-CYBERDECK-001 P4.1)" `
  --body-file docs/pr-queue/P4.1-pr-body.md `
  --base main
```

**Title:** `refactor: cyberdeck layout shell (L-CYBERDECK-001 P4.1)`

**Stop** after PR is open. Do **not** merge. Notify tester.

---

## Handoff (paste to tester agent)

```text
Verify L-CYBERDECK-001 P4.1 on branch cursor/extract-p4.1-layout-shell.

Execute docs/verifications/VERIFY-L-CYBERDECK-001-P4.1.md
Write docs/verifications/JP-L-CYBERDECK-001-P4.1.md
Update docs/work-orders/L-CYBERDECK-001-CONDUCTOR.md
No code changes unless FAIL rework assigned.
```

Judicial receipt: `docs/verifications/JP-L-CYBERDECK-001-P4.1.md`
