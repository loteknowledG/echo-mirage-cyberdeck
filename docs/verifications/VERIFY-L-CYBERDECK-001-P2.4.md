# VERIFY-L-CYBERDECK-001-P2.4 — Phase P2.4 Verification Brief

**Work order:** [L-CYBERDECK-001](../work-orders/L-CYBERDECK-001-cyberdeck-app-extraction.md)  
**Phase:** P2.4 — MUTHUR chat column component  
**Protocol:** [VERIFY-L-CYBERDECK-001](./VERIFY-L-CYBERDECK-001.md)  
**Output receipt:** [JP-L-CYBERDECK-001-P2.4](./JP-L-CYBERDECK-001-P2.4.md)  
**PR body:** [docs/pr-queue/P2.4-pr-body.md](../pr-queue/P2.4-pr-body.md)

**Prerequisites:** [JP-P2.3 PASS](./JP-L-CYBERDECK-001-P2.3.md); `main` @ `95bbc8d`

**Tester orders (paste):** [TESTER-L-CYBERDECK-001-P2.4](./TESTER-L-CYBERDECK-001-P2.4.md)

---

## Scope under test

Extract MUTHUR **chat column JSX** into `muthur-chat-column.tsx`. **No behavior change.**

| Deliverable | Path |
|-------------|------|
| Chat column component | `src/features/cyberdeck/muthur/muthur-chat-column.tsx` |
| App delegates | `src/features/cyberdeck/cyberdeck-app.tsx` |

**In scope (UI that moves):**

- `data-cyberdeck-pane="muthur-chat"` container
- Chat scroll region + `MuthurCommandConsoleLog`
- Composer footer (`MuthurCommandInput`, send/stop, voice controls, inhabitant/posture rollers)
- `MuthurCommanderStatus` + delegation panel **rendering** (props from app)

**Out of scope for P2.4 (FAIL if extracted to new commander module):**

- Commander handler **logic** → P2.5 (`use-muthur-commander-handlers.ts`)
- Gateway column (P3)
- Resizable layout shell extraction (P4)

---

## Required checks

### V-P2.4-01 — Branch / PR / commit

```powershell
cd f:\dev\echo-mirage-cyberdeck
git branch --show-current
git log -1 --oneline
gh pr view --json number,url,headRefName,state
```

Expect `cursor/extract-p2.4-muthur-chat-column`, open PR, commit mentions P2.4.

---

### V-P2.4-02 — New module exists

`muthur-chat-column.tsx` exports `MuthurChatColumn` (or documented equivalent).

---

### V-P2.4-03 — App delegates; JSX slimmed

```powershell
Select-String -Path "src\features\cyberdeck\cyberdeck-app.tsx" -Pattern "MuthurCommandConsoleLog|MuthurCommandInput|data-cyberdeck-pane=`"muthur-chat`""
```

**Expected:** zero matches in app OR only import + `<MuthurChatColumn` usage.

App must still wire `ResizablePanel` around the column unless P4 scope explicitly approved.

---

### V-P2.4-04 — Probes + tsc

```powershell
pnpm exec tsc --noEmit
pnpm probe:cyberdeck-compile-scope
pnpm probe:muthur-command-console
pnpm probe:muthur-response-visibility
```

All exit 0. FAIL if ceilings raised without line reduction.

---

### V-P2.4-05 — Line reduction

| Metric | P2.3 merged | P2.4 expected |
|--------|------------:|--------------:|
| `cyberdeck-app.tsx` lines | 7,066 | ≤ ~6,500 (approx −500+) |
| Import lines | 150 | ≤ 152 |

---

### V-P2.4-06 — Scope creep

```powershell
git diff main...HEAD --stat
```

**Expected:** primarily `muthur-chat-column.tsx`, `cyberdeck-app.tsx`, probe, docs.

FAIL if gateway/operator/survey touched or commander handlers module added (P2.5).

---

### V-P2.4-07 — Manual smoke (required)

Warm `pnpm dev`, `/cyberdeck`:

1. Chat column visible — messages, composer, model label
2. `muthur help` — local reply in column
3. Send message — stream UI / cogitating indicator
4. Stop button during stream (if uplink active)
5. Scroll chat — auto-scroll still works
6. Voice toggle visible (no crash on click)
7. Commander status bar + posture roller still render

---

## Verdict template

Write `JP-L-CYBERDECK-001-P2.4.md`, comment on PR, update [CONDUCTOR](../work-orders/L-CYBERDECK-001-CONDUCTOR.md).
