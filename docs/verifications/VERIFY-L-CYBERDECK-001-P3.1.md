# VERIFY-L-CYBERDECK-001-P3.1 — Phase P3.1 Verification Brief

**Work order:** [L-CYBERDECK-001](../work-orders/L-CYBERDECK-001-cyberdeck-app-extraction.md)  
**Phase:** P3.1 — Provider connection hook (D3.1)  
**Protocol:** [VERIFY-L-CYBERDECK-001](./VERIFY-L-CYBERDECK-001.md)  
**Output receipt:** [JP-L-CYBERDECK-001-P3.1](./JP-L-CYBERDECK-001-P3.1.md)  
**PR body:** [docs/pr-queue/P3.1-pr-body.md](../pr-queue/P3.1-pr-body.md)  
**Developer orders:** [E-CYBERDECK-001-P3.1](../cadre/executive-coder/E-CYBERDECK-001-P3.1-provider-connection.md)

**Prerequisites:** [JP-P2.5 PASS](./JP-L-CYBERDECK-001-P2.5.md); `main` @ `316e116` (includes P3.1 work order)

**Tester orders (paste):** [TESTER-L-CYBERDECK-001-P3.1](./TESTER-L-CYBERDECK-001-P3.1.md)

---

## Scope under test

Extract **provider connection logic** from `cyberdeck-app.tsx`. **No behavior change.** Gateway column **JSX stays inline** until P3.2.

| Deliverable | Path |
|-------------|------|
| Provider connection hook | `src/features/cyberdeck/gateway/use-provider-connection.ts` |
| App delegates | `src/features/cyberdeck/cyberdeck-app.tsx` |

**In scope (logic that moves):**

- State: `activeProvider`, `providerKeys`, model caches, fetch status, rate limits, probe state, `modelList`, key draft
- Handlers: `selectProvider`, `handleProviderClick`, `submitGatewayKey`, `activateModelById`
- Effects: localStorage hydrate, `/api/provider-config`, gateway key SYS tips, bootstrap fetch
- Functions: `fetchModelsForProvider`, `probeSelectedModel`, `setModelHealth`
- Derived: `hasProviderAuth`, `connectionState`, `providerConnectionLabel`, `scanActivityActive`
- Exports: `hasAnyProviderClientKey`, `CYBERDECK_PROVIDER_IDS` (for app keyboard nav)

**Must stay in app (P3.2):**

- Gateway column JSX (`CyberdeckGatewaySettingsPane` block, provider/model rows, key input)
- `providerKeyboardHighlightId`, `modelKeyboardHighlightId`, gateway keyboard `useEffect`
- `navRailContext`, `gatewayColumnRef`, `focusGatewayConnectionPanel`
- `networkActivityActive` composed as `scanActivityActive || isStreaming`

**Out of scope for P3.1 (FAIL if touched):**

- Gateway column → `gateway-column.tsx` (P3.2)
- MUTHUR chat / send / commander (P2 done)
- Layout shell (P4)
- Operator / survey hosts (P5 / P6)

---

## Required checks

### V-P3.1-01 — Branch / PR / commit

```powershell
cd f:\dev\echo-mirage-cyberdeck
git branch --show-current
git log -1 --oneline
gh pr view 48 --json number,url,headRefName,state,title
```

Expect `cursor/extract-p3.1-provider-connection`, open PR #48, commit mentions P3.1.

---

### V-P3.1-02 — New module exists

- `use-provider-connection.ts` exports `useProviderConnection`
- `hasAnyProviderClientKey` and `CYBERDECK_PROVIDER_IDS` exported for app wiring

---

### V-P3.1-03 — Connection logic removed from app

```powershell
Select-String -Path "src\features\cyberdeck\cyberdeck-app.tsx" -Pattern "const fetchModelsForProvider|const probeSelectedModel|const handleProviderClick|const submitGatewayKey ="
```

**Expected:** **zero matches** — only hook destructure / pass-through.

```powershell
Select-String -Path "src\features\cyberdeck\cyberdeck-app.tsx" -Pattern "useProviderConnection"
```

**Expected:** at least one match.

**Expected:** `CyberdeckGatewaySettingsPane` JSX **still present** in app (not extracted).

---

### V-P3.1-04 — Probes + tsc

```powershell
pnpm exec tsc --noEmit
pnpm probe:cyberdeck-compile-scope
pnpm probe:muthur-command-console
pnpm probe:muthur-response-visibility
pnpm probe:provider-credentials
```

All exit 0. FAIL if ceilings raised without line reduction.

---

### V-P3.1-05 — Line reduction

| Metric | P2.5 merged (baseline) | P3.1 expected |
|--------|----------------------:|--------------:|
| `cyberdeck-app.tsx` lines | 6,445 | ≤ ~5,800 aspirational; **meaningful drop required** (dev reports ~5,878) |
| Import lines | 126 | ≤ 152 |

Probe ratchet must reflect actual line count.

---

### V-P3.1-06 — Scope creep

```powershell
git diff main...HEAD --stat
```

**Expected:** primarily `use-provider-connection.ts`, `cyberdeck-app.tsx`, probe, pr-body.

FAIL if MUTHUR hooks reworked, gateway JSX extracted, or operator/survey touched.

---

### V-P3.1-07 — Manual smoke (required)

Warm `pnpm dev`, `/cyberdeck`:

1. **Provider list** — click OPENCODE / OPENROUTER / OPENAI; `[X]` marker moves
2. **Key entry** — no key → field visible; Connect stores key (or triple-click replace flow)
3. **Model list** — models load after connect; click model selects it
4. **Model probe** — probe line in chat if `ENABLE_MODEL_PROBE` (optional)
5. **MUTHUR send** — message streams with valid model selected
6. **Regression** — posture roller, `muthur help`, commander panel (P2.5)

---

## Verdict template

Write `JP-L-CYBERDECK-001-P3.1.md`, comment on PR #48, update [CONDUCTOR](../work-orders/L-CYBERDECK-001-CONDUCTOR.md).

**On PASS:** merge PR #48 → queue unblocks **P3.2** (gateway column host + pane state).
