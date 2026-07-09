# VERIFY-L-CYBERDECK-001-P3.2 — Phase P3.2 Verification Brief

**Work order:** [L-CYBERDECK-001](../work-orders/L-CYBERDECK-001-cyberdeck-app-extraction.md)  
**Phase:** P3.2 — Gateway pane state + column host (D3.2, D3.3)  
**Protocol:** [VERIFY-L-CYBERDECK-001](./VERIFY-L-CYBERDECK-001.md)  
**Output receipt:** [JP-L-CYBERDECK-001-P3.2](./JP-L-CYBERDECK-001-P3.2.md)  
**PR body:** [docs/pr-queue/P3.2-pr-body.md](../pr-queue/P3.2-pr-body.md)  
**Developer orders:** [E-CYBERDECK-001-P3.2](../cadre/executive-coder/E-CYBERDECK-001-P3.2-gateway-column.md)

**Prerequisites:** [JP-P3.1 PASS](./JP-L-CYBERDECK-001-P3.1.md); `main` @ `dcae63c` (includes P3.1 merge)

**Tester orders (paste):** [TESTER-L-CYBERDECK-001-P3.2](./TESTER-L-CYBERDECK-001-P3.2.md)

---

## Scope under test

Extract **gateway pane state** and **gateway column JSX** from `cyberdeck-app.tsx`. **No behavior change.** Connection logic stays in `useProviderConnection` (P3.1).

| Deliverable | Path |
|-------------|------|
| Pane constants | `src/features/cyberdeck/gateway/provider-pane-state.ts` |
| Pane state hook | `src/features/cyberdeck/gateway/use-gateway-pane-state.ts` |
| Column host | `src/features/cyberdeck/gateway/gateway-column.tsx` |
| App delegates | `src/features/cyberdeck/cyberdeck-app.tsx` |

**In scope (moves from app):**

- State: `providerKeyboardHighlightId`, `modelKeyboardHighlightId`
- Refs: `gatewayColumnRef`, `gatewayConnectionPanelRef`
- Focus: `focusGatewayConnectionPanel`
- Gateway text chrome constants
- Provider/model scroll-highlight + model highlight reset effects
- Gateway column JSX (`CyberdeckGatewaySettingsPane` block, provider rows, connection panel)

**Must stay in app:**

- `useProviderConnection` wiring (unchanged)
- `navRailContext`, `serverKeyboardHighlightId`, gateway keyboard `useEffect` (rail + chat orchestration)
- Layout shell / resizable panels (P4)

**Out of scope (FAIL if touched):**

- `use-provider-connection.ts` rework
- MUTHUR send / commander hooks (P2 done)
- Layout shell (P4), operator / survey hosts (P5 / P6)

---

## Required checks

### V-P3.2-01 — Branch / PR / commit

```powershell
cd f:\dev\echo-mirage-cyberdeck
git branch --show-current
git log -1 --oneline
gh pr view 49 --json number,url,headRefName,state,title
```

Expect `cursor/extract-p3.2-gateway-column`, open PR #49, commits mention P3.2.

---

### V-P3.2-02 — New modules exist

- `provider-pane-state.ts` — gateway chrome constants
- `use-gateway-pane-state.ts` — exports `useGatewayPaneState`
- `gateway-column.tsx` — exports `GatewayColumn`

---

### V-P3.2-03 — Gateway UI removed from app

```powershell
Select-String -Path "src\features\cyberdeck\cyberdeck-app.tsx" -Pattern "CyberdeckGatewaySettingsPane|const focusGatewayConnectionPanel"
```

**Expected:** **zero matches** in app (moved to gateway modules).

```powershell
Select-String -Path "src\features\cyberdeck\cyberdeck-app.tsx" -Pattern "useGatewayPaneState|GatewayColumn"
```

**Expected:** app calls hook and renders `<GatewayColumn />`.

```powershell
Select-String -Path "src\features\cyberdeck\cyberdeck-app.tsx" -Pattern "useProviderConnection"
```

**Expected:** hook still wired; `use-provider-connection.ts` **not** in diff.

---

### V-P3.2-04 — Probes + tsc

```powershell
pnpm exec tsc --noEmit
pnpm probe:cyberdeck-compile-scope
pnpm probe:muthur-command-console
pnpm probe:muthur-response-visibility
pnpm probe:provider-credentials
```

All exit 0. FAIL if ceilings raised without line reduction.

---

### V-P3.2-05 — Line reduction

| Metric | P3.1 merged (baseline) | P3.2 expected |
|--------|----------------------:|--------------:|
| `cyberdeck-app.tsx` lines | 5,878 | ≤ ~5,200 aspirational; **meaningful drop required** (~5,604 verified) |
| Import lines | 125 | ≤ 125 |

Probe ratchet must reflect actual line count (5,604 / 125).

---

### V-P3.2-06 — Scope creep

```powershell
git diff main...HEAD --stat
```

**Expected:** gateway modules, `cyberdeck-app.tsx`, probe, pr-body (~6 files).

FAIL if `use-provider-connection.ts` changed, MUTHUR hooks reworked, or operator/survey touched.

---

### V-P3.2-07 — Manual smoke (required)

Warm `pnpm dev`, `/cyberdeck`:

1. **Gateway column** — MAINNET-UPLINK / # GATEWAY / provider list visible
2. **Provider click** — `[X]` marker moves between providers
3. **Model list** — models render after provider select (if keys/cache available)
4. **Keyboard** — arrow keys move provider highlight in gateway column
5. **MUTHUR** — `muthur help` or send path responds in chat column
6. **Regression** — COMMANDER posture, operator pane still reachable (P2.5)

---

## Verdict template

Write `JP-L-CYBERDECK-001-P3.2.md`, comment on PR #49, update [CONDUCTOR](../work-orders/L-CYBERDECK-001-CONDUCTOR.md).

**On PASS:** merge PR #49 → **P3 complete** → queue unblocks **P4.1** (layout shell).
