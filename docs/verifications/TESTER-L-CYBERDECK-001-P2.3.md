# TESTER-L-CYBERDECK-001-P2.3 — Judicial Verifier Orders (paste into tester tab)

**Phase:** P2.3 — `handleSend` / chat client extraction  
**Queue:** HEAD (highest regression risk in P2)  
**Authority:** Independent of implementer  
**Brief:** [VERIFY-L-CYBERDECK-001-P2.3](./VERIFY-L-CYBERDECK-001-P2.3.md)  
**Receipt:** [JP-L-CYBERDECK-001-P2.3](./JP-L-CYBERDECK-001-P2.3.md)  
**Conductor:** [L-CYBERDECK-001-CONDUCTOR](../work-orders/L-CYBERDECK-001-CONDUCTOR.md)

---

## Paste this into the tester agent

```text
L-CYBERDECK-001 P2.3 — Judicial verification (QUEUE HEAD — HIGHEST RISK)

You are the Judicial agent. Verify only — do NOT implement P2.3 unless verdict is FAIL and you are explicitly assigned rework.

Repo: f:\dev\echo-mirage-cyberdeck
Protocol: docs/verifications/VERIFY-L-CYBERDECK-001-TESTER.md
Phase brief: docs/verifications/VERIFY-L-CYBERDECK-001-P2.3.md
Prerequisite: JP-L-CYBERDECK-001-P2.2 PASS; baseline 8,253 lines / 148 imports

PR: <paste GitHub PR URL from developer>

---

STEP 0 — Checkout PR branch

cd f:\dev\echo-mirage-cyberdeck
git fetch origin
git checkout cursor/extract-p2.3-muthur-chat-send
git pull
gh pr view --json number,url,headRefName,state,title

---

STEP 1 — Execute every check in VERIFY-L-CYBERDECK-001-P2.3.md

V-P2.3-01 Branch / PR / commit
  Expect: branch contains p2.3 or muthur-chat-send; open PR; commit mentions P2.3

V-P2.3-02 New modules
  - src/lib/muthur-core/muthur-chat-client.ts (fetch/SSE/abort)
  - src/features/cyberdeck/muthur/use-muthur-chat-send.ts (useMuthurChatSend)

V-P2.3-03 handleSend removed from app
  Select-String -Path "src\features\cyberdeck\cyberdeck-app.tsx" -Pattern "const handleSend|const handleStop|function handleSend|function handleStop"
  Expected: ZERO matches (hook destructure only is OK elsewhere)

  Select-String -Path "src\features\cyberdeck\cyberdeck-app.tsx" -Pattern 'fetch\("/api/cyberdeck-chat"'
  Expected: ZERO — uplink in muthur-chat-client.ts

  Confirm app calls useMuthurChatSend and passes handleSend/handleStop to UI

V-P2.3-04 Probes + tsc (all exit 0)
  pnpm exec tsc --noEmit
  pnpm probe:cyberdeck-compile-scope
  pnpm probe:muthur-command-console
  pnpm probe:muthur-response-visibility
  FAIL if ceilings raised without line reduction

V-P2.3-05 Line reduction
  Baseline: 8,253 lines, 148 imports
  Target: ≤ ~7,050 lines, ≤ 152 imports
  Record actual from probe stdout

V-P2.3-06 Scope creep
  git diff main...HEAD --stat
  Expected: primarily muthur-chat-client.ts, use-muthur-chat-send.ts, cyberdeck-app.tsx, probe, docs
  FAIL if: chat column (P2.4), commander handlers (P2.5), gateway/operator/survey, route.ts (P7)

V-P2.3-07 Manual smoke (REQUIRED — warm dev server)
  pnpm dev (or use running warm server)
  Open /cyberdeck

  1. muthur help → assistant help text (no LLM)
  2. muthur clear → chat wiped, no crash
  3. Reload → messages persist (after a non-cleared send)
  4. STOP button → aborts stream without crash (if uplink active)
  5. LLM send → if provider configured: stream renders, assistant reply
     If no provider: document N/A with reason; steps 1–3 must still PASS
  6. Steer (optional) → send while streaming; no duplicate user lines

---

STEP 2 — Write judicial receipt

Overwrite docs/verifications/JP-L-CYBERDECK-001-P2.3.md:

- Verdict: PASS | FAIL (one sentence)
- PR #, branch, commit hash
- Metrics: lines, imports, ceilings (before → after)
- Checklist V-P2.3-01 … V-P2.3-07 with PASS/FAIL + evidence snippets
- git diff main...HEAD --stat
- Manual smoke log
- Sign-off: Judicial PASS, PR merge ready, P2.4 unblocked

Format reference: docs/verifications/JP-L-CYBERDECK-001-P2.2.md

Comment JP summary + link on GitHub PR.

---

STEP 3 — Update conductor

docs/work-orders/L-CYBERDECK-001-CONDUCTOR.md:
- P2.3 judicial column PASS or FAIL
- Metrics if PASS
- Queue: MERGED + pop to P2.4, or HEAD stays on FAIL

---

BOUNDARIES

MAY: run commands, read code, write JP + conductor, PR comment
MUST NOT: merge, push, refactor code, start P2.4

DELIVERABLE — reply with:
1. Verdict
2. PR URL + commit
3. Line/import counts
4. FAIL items + rework list for developer (check IDs)
```

---

## Quick reference — PASS criteria

| ID | Gate |
|----|------|
| V-P2.3-01 | PR open on correct branch |
| V-P2.3-02 | Both new modules exist with expected exports |
| V-P2.3-03 | No handleSend/handleStop bodies or cyberdeck-chat fetch in app |
| V-P2.3-04 | tsc + all P2 probes green |
| V-P2.3-05 | Meaningful line drop (~1,200+ target) |
| V-P2.3-06 | Diff limited to slice files |
| V-P2.3-07 | Help, clear, persistence; stop/uplink per availability |

---

## FAIL rework payload (required on FAIL)

For each failed check, include:

1. Check ID (`V-P2.3-0X`)
2. Command run + exit code / output snippet
3. One-line fix expectation for developer

Queue does **not** advance on FAIL.
