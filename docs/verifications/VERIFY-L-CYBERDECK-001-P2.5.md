# VERIFY-L-CYBERDECK-001-P2.5 — Phase P2.5 Verification Brief

**Work order:** [L-CYBERDECK-001](../work-orders/L-CYBERDECK-001-cyberdeck-app-extraction.md)  
**Phase:** P2.5 — MUTHUR commander handlers + cognition bridge (**closes P2 tranche**)  
**Protocol:** [VERIFY-L-CYBERDECK-001](./VERIFY-L-CYBERDECK-001.md)  
**Output receipt:** [JP-L-CYBERDECK-001-P2.5](./JP-L-CYBERDECK-001-P2.5.md)  
**PR body:** [docs/pr-queue/P2.5-pr-body.md](../pr-queue/P2.5-pr-body.md)  
**Developer orders:** [E-CYBERDECK-001-P2.5](../cadre/executive-coder/E-CYBERDECK-001-P2.5-commander-handlers.md)

**Prerequisites:** [JP-P2.4 PASS](./JP-L-CYBERDECK-001-P2.4.md); `main` @ `3b61812`

**Tester orders (paste):** [TESTER-L-CYBERDECK-001-P2.5](./TESTER-L-CYBERDECK-001-P2.5.md)

---

## Scope under test

Extract MUTHUR **commander handler logic** and **cognition bridge** from `cyberdeck-app.tsx`. **No behavior change.**

| Deliverable | Path |
|-------------|------|
| Commander handlers hook | `src/features/cyberdeck/muthur/use-muthur-commander-handlers.ts` |
| Cognition bridge hook | `src/features/cyberdeck/muthur/use-muthur-cognition-bridge.ts` |
| App delegates | `src/features/cyberdeck/cyberdeck-app.tsx` |

**In scope (logic that moves):**

- State: `muthurPosture`, `muthurMission`, `muthurDelegations`, `muthurInhabitant`
- Handlers: posture/inhabitant change, mission create/start, delegation CRUD/dispatch
- Cognition: `emitMuthurCognition`, `appendMuthurCognitionStatus`, `muthurCognitionStatusLine`
- Persistence effects for posture/mission/delegations/inhabitant

**Acceptable wiring:** `useMuthurCommanderHandlers` may compose `useMuthurCognitionBridge` internally; app need not call both hooks directly if cognition module exists and is used.

**Out of scope for P2.5 (FAIL if touched):**

- `MuthurChatColumn` JSX restructuring (P2.4 done)
- `handleSend` / uplink (P2.3 done)
- Gateway column (P3)
- Layout shell extraction (P4)

---

## Required checks

### V-P2.5-01 — Branch / PR / commit

```powershell
cd f:\dev\echo-mirage-cyberdeck
git branch --show-current
git log -1 --oneline
gh pr view 47 --json number,url,headRefName,state,title
```

Expect `cursor/extract-p2.5-muthur-commander-handlers`, open PR #47, commit mentions P2.5.

---

### V-P2.5-02 — New modules exist

Both hooks must exist and export documented symbols:

- `useMuthurCommanderHandlers` — posture/mission/delegation/inhabitant state + handlers
- `useMuthurCognitionBridge` — cognition emit/status bridge

---

### V-P2.5-03 — Handler bodies removed from app

```powershell
Select-String -Path "src\features\cyberdeck\cyberdeck-app.tsx" -Pattern "const handle(Muthur|Create|Dispatch|Record|Cancel|Start)"
Select-String -Path "src\features\cyberdeck\cyberdeck-app.tsx" -Pattern "const emitMuthurCognition|const appendMuthurCognitionStatus"
```

**Expected:** zero matches for inline handler/cognition function bodies.

App may destructure handlers from `useMuthurCommanderHandlers` and pass to `<MuthurChatColumn />`.

---

### V-P2.5-04 — Probes + tsc

```powershell
pnpm exec tsc --noEmit
pnpm probe:cyberdeck-compile-scope
pnpm probe:muthur-command-console
pnpm probe:muthur-response-visibility
```

All exit 0. FAIL if ceilings raised without line reduction.

---

### V-P2.5-05 — Line reduction

| Metric | P2.4 merged (baseline) | P2.5 expected |
|--------|----------------------:|--------------:|
| `cyberdeck-app.tsx` lines | 6,766 | ≤ ~5,200 aspirational; **meaningful drop required** |
| Import lines | 142 | ≤ 152 |

Probe ratchet must reflect actual line count (not aspirational target).

---

### V-P2.5-06 — Scope creep

```powershell
git diff main...HEAD --stat
```

**Expected:** primarily new hooks, `cyberdeck-app.tsx`, probe, docs.

FAIL if gateway/operator/survey touched or chat column JSX restructured.

---

### V-P2.5-07 — Manual smoke (required)

Warm `pnpm dev`, `/cyberdeck`:

1. **Posture roller** — PLAN / AGENT / COMMANDER switch; no crash
2. **Commander mode** — delegation/status UI visible when COMMANDER selected
3. **Inhabitant roller** — MUTHUR / CODEX / PI visible and clickable
4. **Cognition** — diagnostics show cognition activity (e.g. `cognition active`)
5. **Regression** — `muthur help` local reply; composer/send path still works
6. **Mission/delegation** — create mission UI reachable in commander mode (no crash)

---

## Verdict template

Write `JP-L-CYBERDECK-001-P2.5.md`, comment on PR #47, update [CONDUCTOR](../work-orders/L-CYBERDECK-001-CONDUCTOR.md).

**On PASS:** P2 tranche complete → queue unblocks **P3.1** (gateway column).
