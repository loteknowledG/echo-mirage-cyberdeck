# E-CYBERDECK-001-P3.1 — Provider Connection Hook (Developer Work Order)

**Status:** ACTIVE — queue HEAD  
**Legislator:** [L-CYBERDECK-001](../../work-orders/L-CYBERDECK-001-cyberdeck-app-extraction.md) (D3.1)  
**Conductor:** [L-CYBERDECK-001-CONDUCTOR](../../work-orders/L-CYBERDECK-001-CONDUCTOR.md)  
**PR body:** [P3.1-pr-body.md](../../pr-queue/P3.1-pr-body.md)  
**Prior slice:** [JP-P2.5](../../verifications/JP-L-CYBERDECK-001-P2.5.md) PASS — merged `f084b5f`  
**Next slice:** P3.2 — D3.2 `provider-pane-state.ts` + D3.3 `gateway-column.tsx`

---

## Role

You are the **implementer**. Ship **one** extraction PR. Do **not** self-approve. Hand off to the **tester agent** when done.

| Role | Document |
|------|----------|
| Developer | **this file** |
| Tester | `docs/verifications/VERIFY-L-CYBERDECK-001-P3.1.md` (tech lead preps) |
| Conductor | `L-CYBERDECK-001-CONDUCTOR.md` |

---

## Branch setup

```powershell
cd f:\dev\echo-mirage-cyberdeck
git checkout main
git pull origin main
git checkout -b cursor/extract-p3.1-provider-connection
```

**Base:** `main` @ `f084b5f` (includes P2.5 merge + conductor docs).

---

## Goal

Extract **provider connection logic** (keys, models, probe, fetch, selection) from `cyberdeck-app.tsx` into `use-provider-connection.ts`. **Zero behavior change.**

**This slice is D3.1 only.** Gateway column **JSX** (~lines 6069–6349), keyboard highlight state, and `navRailContext` stay in the app for **P3.2**.

---

## Baseline (before you start)

| Metric | Value |
|--------|------:|
| `cyberdeck-app.tsx` lines | 6,445 |
| Import lines | 126 |
| Probe ceiling | 6,445 / 152 |

**P3.1 line target:** ≤ ~5,800 (aspirational −600+). **P3 tranche close target:** ≤ ~3,900 after P3.2 lands.

---

## Deliverable — D3.1 `use-provider-connection.ts`

**Create:** `src/features/cyberdeck/gateway/use-provider-connection.ts`

### Move from `cyberdeck-app.tsx`

| Concern | Approx. region | Notes |
|---------|----------------|-------|
| Constants | `PROVIDER_IDS`, `PROVIDER_RATE_LIMIT_COOLDOWN_MS`, `MODEL_PROBE_MIN_INTERVAL_MS` | colocate in hook module |
| Helpers | `providerHasClientKey`, `hasAnyProviderClientKey` | top of app today (~386–400) |
| State | `activeProvider`, `providerKeys`, `didHydrateProviderState`, `providerConfigHydrated`, `defaultKeyAvailableByProvider`, `modelCacheByProvider`, `credentialReplaceProvider`, `gatewayKeyDraft`, `modelByProvider`, `modelFetchStatusByProvider`, `rateLimitedProviders`, `modelHealthByProvider`, `verifiedProviders`, `probeInFlightByProvider`, `modelList` | ~659–691, 675 |
| Refs | `providerRateLimitUntilRef`, `providerClickTrackerRef`, `providerRefreshAtRef`, `providerBootstrapRef`, `modelProbeCacheRef`, `modelProbeLastAtRef`, `modelProbeAbortRef` | probe + click escalation |
| Derived | `providers`, `modelID`, `providerModelFetchStatus`, `hasProviderAuth`, `providerLinkReady`, `isConnected`, `connectionState`, `providerConnectionLabel`, `scanActivityActive` | ~1004–1033 |
| `selectProvider` | ~2984–2992 | |
| Hydrate effect | localStorage + `/api/provider-config` | ~3252–3322 |
| Key prompt effects | gateway SYS tip inject/clear | ~3397–3416 |
| `setModelHealth` | ~3418–3423 | |
| `probeSelectedModel` | ~3425–3532 | uses `ENABLE_MODEL_PROBE` |
| `fetchModelsForProvider` | ~3534–3674 | POST `/api/cyberdeck-models` |
| `providerHasKey`, `syncModelListFromCache`, `refreshProviderModelsDebounced` | ~3676–3716 | |
| `handleProviderClick` | ~3718–3755 | triple-click credential replace |
| `submitGatewayKey` | ~3757–3776 | |
| `activateModelById` | ~3778–3794 | |
| Bootstrap effect | cache-first after hydrate | ~4254–4272 |

### Keep in app (P3.2)

| Concern | Why |
|---------|-----|
| Gateway column JSX (`ResizablePanel` col 3, provider rows, model list, key input) | D3.3 `gateway-column.tsx` |
| `providerKeyboardHighlightId`, `modelKeyboardHighlightId`, `navRailContext` | D3.2 pane state |
| Gateway keyboard `useEffect` (~3796–4194) | wires rail + gateway; moves with P3.2 |
| `gatewayColumnRef`, `gatewayConnectionPanelRef`, `focusGatewayConnectionPanel` | column host + focus |
| `networkActivityActive` (includes `isStreaming`) | compose in app: `scanActivityActive \|\| isStreaming` |
| Gateway context menu, third-column drag/drop | P3.2 / P4 |

### Hook signature (sketch)

Inject cross-cutting deps the hook must call:

```ts
type UseProviderConnectionOptions = {
  setMessages: /* same as chat state */;
  setMuthurDiagnostics: /* append receipt diagnostics */;
  playModelTestErrorSound: (line: string) => void;
};

type UseProviderConnectionResult = {
  // selection + credentials
  activeProvider: string;
  providerKeys: Record<string, string>;
  setProviderKeys: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  modelID: string;
  modelList: { id: string }[];
  providers: readonly { id: string; name: string }[];
  hasProviderAuth: boolean;
  isConnected: boolean;
  connectionState: "offline" | "connecting" | "connected";
  providerConnectionLabel: string;
  providerModelFetchStatus: string;
  scanActivityActive: boolean;

  // UI-driving state (still consumed by inline gateway JSX until P3.2)
  credentialReplaceProvider: string | null;
  setCredentialReplaceProvider: ...;
  gatewayKeyDraft: string;
  setGatewayKeyDraft: ...;
  modelFetchStatusByProvider: ...;
  rateLimitedProviders: Set<string>;
  modelHealthByProvider: ...;
  probeInFlightByProvider: ...;
  defaultKeyAvailableByProvider: ...;

  // handlers
  selectProvider: (id: string) => void;
  handleProviderClick: (id: string) => void;
  submitGatewayKey: () => Promise<void>;
  activateModelById: (modelId: string) => void;
  fetchModelsForProvider: (provider: string, options?: { force?: boolean }) => Promise<void>;
  providerHasKey: (providerId: string) => boolean;
  setModelHealth: (provider: string, model: string, status: string) => void;
  setVerifiedProviders: ...;
  setModelFetchStatusByProvider: ...;
  setRateLimitedProviders: ...;

  // refs for use-muthur-chat-send
  providerRateLimitUntilRef: React.MutableRefObject<Record<string, number>>;
};
```

**`useMuthurChatSend`** already takes `activeProvider`, `providerKeys`, `modelID`, `hasProviderAuth`, `fetchModelsForProvider`, `setProviderKeys`, rate-limit refs/setters — wire from hook return, not duplicate state.

---

## App wiring (after extraction)

`cyberdeck-app.tsx` should:

1. Call `useProviderConnection({ setMessages, setMuthurDiagnostics, playModelTestErrorSound })`
2. Pass hook outputs into `useMuthurChatSend({ … })` and gateway JSX props unchanged
3. **Not** retain `fetchModelsForProvider` / `probeSelectedModel` / `handleProviderClick` **function bodies** inline

**Spot-check (zero inline bodies):**

```powershell
Select-String -Path "src\features\cyberdeck\cyberdeck-app.tsx" -Pattern "const fetchModelsForProvider|const probeSelectedModel|const handleProviderClick|const submitGatewayKey ="
```

Expected: only hook destructure / pass-through.

```powershell
Select-String -Path "src\features\cyberdeck\cyberdeck-app.tsx" -Pattern "useProviderConnection"
```

Expected: at least one match.

---

## Reuse (do not duplicate)

| Module | Use for |
|--------|---------|
| `gateway/gateway-message-render.tsx` | `gatewayKeySysMessage`, `isGatewayKeySysTip` (P1.2) |
| `@/lib/provider-credentials` | `resolveOutboundProviderCredentials`, `providerHasUsableCredentials`, `formatProviderReceiptDiagnostic`, `resolveProviderConnectionLabel` |
| `@/lib/cyberdeck/provider-connection` | model cache, tone colors, `providerModelsCacheKey` |
| `CyberdeckGatewaySettingsPane` | `cyberdeck-pane-slots.tsx` — keep wrapping gateway JSX until P3.2 |

---

## Out of scope (FAIL if touched)

| Area | Phase |
|------|-------|
| Gateway column JSX → component | P3.2 (D3.3) |
| `providerKeyboardHighlightId` / gateway keyboard nav | P3.2 (D3.2) |
| MUTHUR chat column / send / commander | done (P2) |
| Layout shell / `ResizablePanelGroup` | P4 |
| Operator / survey hosts | P5 / P6 |
| `/api/cyberdeck-chat/route.ts` | P7 |

Do **not** move gateway JSX in this PR — logic-only extraction.

---

## Probe ratchet

After extraction, lower **only if lines actually dropped**:

```ts
// scripts/probe-cyberdeck-compile-scope.ts
const MAX_CYBERDECK_APP_LINES = <actual line count>;
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
pnpm probe:provider-credentials
git diff main...HEAD --stat
```

| Check | Required |
|-------|----------|
| `tsc --noEmit` | exit 0 |
| `probe:cyberdeck-compile-scope` | exit 0 |
| `probe:muthur-command-console` | exit 0 |
| `probe:muthur-response-visibility` | exit 0 |
| `probe:provider-credentials` | exit 0 |
| Scope diff | primarily `use-provider-connection.ts` + `cyberdeck-app.tsx` + probe (+ docs) |
| Manual smoke | provider select, key entry, model list, model probe, send still works |

---

## Manual smoke (implementer — before handoff)

Warm `pnpm dev`, open `/cyberdeck`:

1. **Provider list** — click OPENCODE / OPENROUTER / OPENAI; active marker moves
2. **Key entry** — triple-click provider (or no key) → key field; Connect stores key
3. **Model list** — models load after connect; select model; probe line in chat if enabled
4. **Rate limit** — no regression on cooldown messaging (if reproducible)
5. **MUTHUR send** — message with valid model still streams
6. **Regression** — posture roller, `muthur help`, commander panel (P2.5)

---

## PR

```powershell
git push -u origin HEAD
gh pr create `
  --title "refactor: provider connection hook (L-CYBERDECK-001 P3.1)" `
  --body-file docs/pr-queue/P3.1-pr-body.md `
  --base main
```

**Title:** `refactor: provider connection hook (L-CYBERDECK-001 P3.1)`

**Stop** after PR is open. Do **not** merge. Notify tester.

---

## Handoff (paste to tester agent)

```text
Verify L-CYBERDECK-001 P3.1 on branch cursor/extract-p3.1-provider-connection.

Execute docs/verifications/VERIFY-L-CYBERDECK-001-P3.1.md
Write docs/verifications/JP-L-CYBERDECK-001-P3.1.md
Update docs/work-orders/L-CYBERDECK-001-CONDUCTOR.md
No code changes unless FAIL rework assigned.
```

---

## Evidence for PR description

- `git diff main...HEAD --stat`
- Probe stdout (lines, imports, ceilings)
- Note any deps left injected vs moved into hook

Judicial receipt: `docs/verifications/JP-L-CYBERDECK-001-P3.1.md`
