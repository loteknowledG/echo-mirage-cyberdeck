# VERIFY-L-CYBERDECK-001-P4.1 — Phase P4.1 Verification Brief

**Work order:** [L-CYBERDECK-001](../work-orders/L-CYBERDECK-001-cyberdeck-app-extraction.md)  
**Phase:** P4.1 — Layout shell + mobile layout hook (D4.1, D4.2)  
**Protocol:** [VERIFY-L-CYBERDECK-001](./VERIFY-L-CYBERDECK-001.md)  
**Output receipt:** [JP-L-CYBERDECK-001-P4.1](./JP-L-CYBERDECK-001-P4.1.md)  
**PR body:** [docs/pr-queue/P4.1-pr-body.md](../pr-queue/P4.1-pr-body.md)  
**Developer orders:** [E-CYBERDECK-001-P4.1](../cadre/executive-coder/E-CYBERDECK-001-P4.1-layout-shell.md)

**Prerequisites:** [JP-P3.2 PASS](./JP-L-CYBERDECK-001-P3.2.md); `main` @ `9d911cc` (P4.1 work order)

**Tester orders (paste):** [TESTER-L-CYBERDECK-001-P4.1](./TESTER-L-CYBERDECK-001-P4.1.md)

---

## Scope under test

Extract **mobile layout hook** and **resizable chat/gateway shell** from `cyberdeck-app.tsx`. **No behavior change.** Opens P4 tranche.

| Deliverable | Path |
|-------------|------|
| Mobile layout hook | `src/features/cyberdeck/layout/use-mobile-cyberdeck-layout.ts` |
| Layout shell | `src/features/cyberdeck/layout/cyberdeck-layout-shell.tsx` |
| App composes | `src/features/cyberdeck/cyberdeck-app.tsx` |

**In scope (moves):**

- `isMobileLayout`, `matchMedia` effect, split state, `mirageHeaderCollapse`
- `ResizablePanelGroup` / panels / handle JSX + `data-morphism` wrapper
- `memoryKey="cyberdeck-content-split-v2"`

**Must stay in app:**

- `MuthurChatColumn` / `GatewayColumn` prop wiring (as `chatColumn` / `gatewayColumn` children)
- `CyberdeckServerRail`, context menus, custom tab renderer
- Gateway / provider / MUTHUR hooks (P2–P3 done)

**Out of scope (FAIL if touched):**

- Custom tab renderer / context menus (P4.2–P4.3)
- Operator pane host (P5)
- Gateway / provider connection rework (P3)

---

## Required checks

### V-P4.1-01 — Branch / PR / commit

```powershell
cd f:\dev\echo-mirage-cyberdeck
git branch --show-current
git log -1 --oneline
gh pr view 50 --json number,url,headRefName,state,title
```

Expect `cursor/extract-p4.1-layout-shell`, open PR #50.

---

### V-P4.1-02 — New modules exist

- `use-mobile-cyberdeck-layout.ts` exports `useMobileCyberdeckLayout`
- `cyberdeck-layout-shell.tsx` exports `CyberdeckLayoutShell`

---

### V-P4.1-03 — Layout removed from app

```powershell
Select-String -Path "src\features\cyberdeck\cyberdeck-app.tsx" -Pattern "ResizablePanel|ResizableHandle|ResizablePanelGroup|matchMedia|mobileContentSplit"
```

**Expected:** **zero matches** in app.

```powershell
Select-String -Path "src\features\cyberdeck\cyberdeck-app.tsx" -Pattern "useMobileCyberdeckLayout|CyberdeckLayoutShell"
```

**Expected:** app delegates to extracted modules.

---

### V-P4.1-04 — Probes + tsc

```powershell
pnpm exec tsc --noEmit
pnpm probe:cyberdeck-compile-scope
pnpm probe:muthur-command-console
pnpm probe:muthur-response-visibility
pnpm probe:provider-credentials
```

All exit 0. FAIL if ceilings raised without line reduction.

---

### V-P4.1-05 — Line reduction

| Metric | P3.2 merged (baseline) | P4.1 expected |
|--------|----------------------:|--------------:|
| `cyberdeck-app.tsx` lines | 5,604 | meaningful drop required (~5,549 verified) |
| Import lines | 125 | ≤ 125 |

Aspirational ≤ ~4,900 may not land when pane bodies stay in app — document actual count.

---

### V-P4.1-06 — Scope creep

```powershell
git diff main...HEAD --stat
```

**Expected:** layout modules, `cyberdeck-app.tsx`, probe, pr-body (~5 files).

FAIL if gateway/MUTHUR/operator modules reworked beyond wiring.

---

### V-P4.1-07 — Manual smoke (required)

Warm `pnpm dev`, `/cyberdeck`:

1. **Layout shell** — chat/gateway resizer present (`Resize MUTHUR chat pane`)
2. **Desktop** — horizontal split; drag resizer (optional persistence check)
3. **Gateway** — μ tab → MAINNET-UPLINK / # GATEWAY / provider rows
4. **Chat** — `muthur help` or send path responds
5. **Regression** — COMMANDER posture, server rail tabs

---

## Verdict template

Write `JP-L-CYBERDECK-001-P4.1.md`, comment on PR #50, update [CONDUCTOR](../work-orders/L-CYBERDECK-001-CONDUCTOR.md).

**On PASS:** merge PR #50 → queue unblocks **P4.2** (custom tab / workspace chrome).
