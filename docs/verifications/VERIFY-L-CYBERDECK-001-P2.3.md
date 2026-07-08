# VERIFY-L-CYBERDECK-001-P2.3 — Phase P2.3 Verification Brief

**Work order:** [L-CYBERDECK-001](../work-orders/L-CYBERDECK-001-cyberdeck-app-extraction.md)  
**Phase:** P2.3 — `handleSend` / chat client extraction  
**Protocol:** [VERIFY-L-CYBERDECK-001](./VERIFY-L-CYBERDECK-001.md)  
**Output receipt:** [JP-L-CYBERDECK-001-P2.3](./JP-L-CYBERDECK-001-P2.3.md)  
**PR body:** [docs/pr-queue/P2.3-pr-body.md](../pr-queue/P2.3-pr-body.md)

**Prerequisites:** [JP-P2.2 PASS](./JP-L-CYBERDECK-001-P2.2.md); `main` @ `e8e9185`

---

## Scope under test

Extract **`handleSend` / `handleStop`** and the **LLM uplink client** from `cyberdeck-app.tsx`. **No behavior change.**

| Deliverable | Path |
|-------------|------|
| Chat client (fetch, SSE, abort) | `src/lib/muthur-core/muthur-chat-client.ts` |
| Send/stop hook | `src/features/cyberdeck/muthur/use-muthur-chat-send.ts` |
| App delegates | `src/features/cyberdeck/cyberdeck-app.tsx` |

**Must be true after extraction:**

- `handleSend` and `handleStop` **function bodies are not in** `cyberdeck-app.tsx`
- App uses `useMuthurChatSend` (or equivalent) and passes deps
- Steer-during-stream, inhabitant send, provider uplink, abort/stop still work

**Out of scope for P2.3 (FAIL if moved):**

- Chat column JSX shell (P2.4)
- Commander handlers — posture, mission, delegations (P2.5)
- Gateway / operator / survey hosts
- Server route split `route.ts` (P7)

---

## Required checks

### V-P2.3-01 — Branch / PR / commit

```powershell
cd f:\dev\echo-mirage-cyberdeck
git branch --show-current
git log -1 --oneline
gh pr view --json number,url,headRefName,state
```

Expect branch `cursor/extract-p2.3-muthur-chat-send` (or equivalent), open PR, commit mentions P2.3.

---

### V-P2.3-02 — New modules exist

- `muthur-chat-client.ts` — exports uplink client (fetch/SSE/abort helpers)
- `use-muthur-chat-send.ts` — exports `useMuthurChatSend` returning `{ handleSend, handleStop }` (or documented equivalent)

---

### V-P2.3-03 — handleSend removed from app

```powershell
Select-String -Path "src\features\cyberdeck\cyberdeck-app.tsx" -Pattern "const handleSend|const handleStop|function handleSend|function handleStop"
```

**Expected:** **zero matches** (only hook destructure, e.g. `handleSend` from `useMuthurChatSend`).

```powershell
Select-String -Path "src\features\cyberdeck\cyberdeck-app.tsx" -Pattern "fetch\(\"/api/cyberdeck-chat\""
```

**Expected:** zero matches — uplink fetch lives in `muthur-chat-client.ts`.

---

### V-P2.3-04 — Probes + tsc

```powershell
pnpm exec tsc --noEmit
pnpm probe:cyberdeck-compile-scope
pnpm probe:muthur-command-console
pnpm probe:muthur-response-visibility
```

**Expected:** all exit 0. **FAIL** if ceilings raised without line reduction.

---

### V-P2.3-05 — Line reduction (major slice)

| Metric | P2.2 merged | P2.3 expected |
|--------|------------:|--------------:|
| `cyberdeck-app.tsx` lines | 8,253 | ≤ ~7,050 (approx −1,200+) |
| Import lines | 148 | ≤ 152 |

---

### V-P2.3-06 — Scope creep

```powershell
git diff main...HEAD --stat
```

**Expected:** primarily `muthur-chat-client.ts`, `use-muthur-chat-send.ts`, `cyberdeck-app.tsx`, `probe-cyberdeck-compile-scope.ts`, docs.

**FAIL if** chat column component extracted, gateway/operator/survey touched, or server route refactored.

---

### V-P2.3-07 — Manual smoke (required — highest risk)

Warm `pnpm dev`, `/cyberdeck`:

1. `muthur help` — local help (no regression from P2.2)
2. `muthur clear` — chat clears
3. Reload — persistence works
4. **Stop button** — aborts in-flight stream without crash
5. **LLM send** — if provider configured: message sends, stream renders, assistant reply appears
6. **Steer** (optional) — send while streaming queues steer; no duplicate user lines

---

## Verdict template

Write `JP-L-CYBERDECK-001-P2.3.md`, comment on GitHub PR, update [CONDUCTOR](../work-orders/L-CYBERDECK-001-CONDUCTOR.md).
