# VERIFY-L-CYBERDECK-001-P2.1 — Phase P2.1 Verification Brief

**Work order:** [L-CYBERDECK-001](../work-orders/L-CYBERDECK-001-cyberdeck-app-extraction.md)  
**Phase:** P2.1 — MUTHUR chat state hook  
**Protocol:** [VERIFY-L-CYBERDECK-001](./VERIFY-L-CYBERDECK-001.md)  
**Output receipt:** [JP-L-CYBERDECK-001-P2.1](./JP-L-CYBERDECK-001-P2.1.md)  

**Prerequisites:** P1 tranche complete; [JP-P1.3 PASS](./JP-L-CYBERDECK-001-P1.3.md)

---

## Scope under test

Extract MUTHUR **chat state** (messages, diagnostics partition, stream flags, chat hydration/persistence) into a hook with **no behavior change**.

| Deliverable | Path |
|-------------|------|
| Chat types + storage keys | `src/features/cyberdeck/muthur/muthur-chat-types.ts` |
| Chat state hook | `src/features/cyberdeck/muthur/use-muthur-chat-state.ts` |
| App delegates | `src/features/cyberdeck/cyberdeck-app.tsx` |

**Out of scope for P2.1 (FAIL if moved):**

- `handleSend` / `handleStop` (P2.3)
- Send intent routing (P2.2)
- `muthurPosture`, `muthurMission`, `muthurDelegations`, commander handlers (P2.5)
- Chat column JSX extraction (P2.4)

---

## Required checks

### V-P2.1-01 — Branch / commit

```powershell
cd f:\dev\echo-mirage-cyberdeck
git branch --show-current
git log -1 --oneline
```

Expect branch name containing `p2.1` or `muthur-chat-state` and commit message containing `P2.1`.

---

### V-P2.1-02 — New modules exist

`muthur-chat-types.ts` must export at least:

- `CHAT_STORAGE_KEY`, `CHAT_STREAM_STORAGE_KEY`, `INPUT_HISTORY_KEY` (or equivalent)
- `ChatMessage` type (or `MuthurChatMessage`)

`use-muthur-chat-state.ts` must export:

- `useMuthurChatState` (or documented equivalent hook name)

---

### V-P2.1-03 — App delegates; diagnostics partition preserved

`cyberdeck-app.tsx` must call the hook and must **not** retain duplicate `useState` for moved chat fields (`messages`, `isStreaming`, `streamText`, etc.).

Spot-check — these should live in the hook module, not as duplicate state in app:

```powershell
Select-String -Path "src\features\cyberdeck\cyberdeck-app.tsx" -Pattern "partitionMuthurChannelUpdate"
```

**Expected:** import from hook/types module only, or zero matches if logic fully internalized.

---

### V-P2.1-04 — Compile probes + MUTHUR probes

```powershell
pnpm exec tsc --noEmit
pnpm probe:cyberdeck-compile-scope
pnpm probe:muthur-command-console
pnpm probe:muthur-response-visibility
```

**Expected:** all exit 0.

**FAIL if** ceilings raised without line reduction.

---

### V-P2.1-05 — Line reduction

| Metric | P1 complete | P2.1 expected |
|--------|------------:|--------------:|
| `cyberdeck-app.tsx` lines | 8,544 | ≤ 8,400 (approx −100+) |
| Import lines | 151 | ≤ 152 |

---

### V-P2.1-06 — Scope creep

```powershell
git diff main...HEAD --stat
```

**Expected:** primarily `muthur-chat-types.ts`, `use-muthur-chat-state.ts`, `cyberdeck-app.tsx`, `probe-cyberdeck-compile-scope.ts`.

**FAIL if** `handleSend` body moved, gateway/operator/survey touched, or behavior refactors.

---

### V-P2.1-07 — Manual smoke (required for P2)

With `pnpm dev` running and `/cyberdeck` warm:

1. Send `muthur help` — assistant reply appears (no LLM uplink)
2. Send a normal message OR confirm stream UI still renders if provider configured
3. Reload page — chat messages persist (localStorage)
4. Clear chat intent if available — messages clear without crash

Optional automated: `pnpm probe:cyberdeck-extraction-smoke`

---

## Verdict template

Write to `JP-L-CYBERDECK-001-P2.1.md` and update [CONDUCTOR](../work-orders/L-CYBERDECK-001-CONDUCTOR.md).

---

## Tester prompt (copy-paste)

```text
Verify L-CYBERDECK-001 P2.1 on branch <branch-name>.

Execute docs/verifications/VERIFY-L-CYBERDECK-001-P2.1.md
Write docs/verifications/JP-L-CYBERDECK-001-P2.1.md
Update docs/work-orders/L-CYBERDECK-001-CONDUCTOR.md
No code changes unless FAIL rework assigned.
```
