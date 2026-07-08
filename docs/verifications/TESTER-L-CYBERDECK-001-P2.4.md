# TESTER-L-CYBERDECK-001-P2.4 — Judicial Verifier Orders (paste into tester tab)

**Phase:** P2.4 — MUTHUR chat column component  
**Brief:** [VERIFY-L-CYBERDECK-001-P2.4](./VERIFY-L-CYBERDECK-001-P2.4.md)  
**Receipt:** [JP-L-CYBERDECK-001-P2.4](./JP-L-CYBERDECK-001-P2.4.md)

---

## Paste this into the tester agent

```text
L-CYBERDECK-001 P2.4 — Judicial verification (QUEUE HEAD)

Independent tester only. Do NOT implement.

PR: <paste GitHub PR URL>
Brief: docs/verifications/VERIFY-L-CYBERDECK-001-P2.4.md
Baseline: 7,066 lines, 150 imports

STEP 0 — Checkout PR branch
  git fetch origin
  git checkout cursor/extract-p2.4-muthur-chat-column
  git pull

STEP 1 — All checks in VERIFY-P2.4.md (V-P2.4-01 … V-P2.4-07)

Key spot-checks:
  - muthur-chat-column.tsx exists, exports MuthurChatColumn
  - app has no inline MuthurCommandConsoleLog / MuthurCommandInput / muthur-chat pane JSX
  - tsc + compile-scope + muthur probes green
  - lines ≤ ~6,500

STEP 2 — Manual smoke: composer, help, send/stream, stop, scroll, voice toggle, commander bar

STEP 3 — Write JP-P2.4.md, comment on PR, update CONDUCTOR

Reply: Verdict, PR URL, commit, line counts, FAIL items if any.
```
