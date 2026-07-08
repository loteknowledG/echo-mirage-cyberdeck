# JP-L-CYBERDECK-001-P2.1 — MUTHUR Chat State Hook (Judicial Receipt)

**Work order:** [L-CYBERDECK-001](../work-orders/L-CYBERDECK-001-cyberdeck-app-extraction.md)  
**Phase:** P2.1  
**Branch:** `cursor/extract-p2.1-muthur-chat-state`  
**Implementation commit:** `e1f4bf4`  
**Verify brief:** [VERIFY-L-CYBERDECK-001-P2.1](./VERIFY-L-CYBERDECK-001-P2.1.md)  
**Status:** Judicially verified (PASS)  

---

## Verdict

**PASS** — MUTHUR chat state extracted to `useMuthurChatState` with diagnostics partition preserved; app delegates; probe ratchet lowered (−130 lines); MUTHUR probes green; manual chat smoke green.

---

## Verifier metadata

| Field | Value |
|-------|-------|
| Verifier | Cursor agent (independent verification) |
| Date | 2026-07-08 |
| Git ref | `e1f4bf4` |

---

## Metrics

| Metric | P1 complete (baseline) | P2.1 actual | P2.1 ceiling |
|--------|----------------------:|------------:|-------------:|
| `cyberdeck-app.tsx` lines | 8,544 | **8,414** | 8,414 |
| Import lines | 151 | **151** | 152 |
| Δ lines | — | **−130** | ceiling −146 (8,560→8,414) |

---

## Checklist

| ID | Check | Result | Evidence |
|----|-------|--------|----------|
| V-P2.1-01 | Branch/commit | PASS | `cursor/extract-p2.1-muthur-chat-state` @ `e1f4bf4` — message contains P2.1 |
| V-P2.1-02 | New modules exist | PASS | `muthur-chat-types.ts` exports storage keys + `ChatMessage`; `use-muthur-chat-state.ts` exports `useMuthurChatState` |
| V-P2.1-03 | App delegates | PASS | `useMuthurChatState()` in app; zero `partitionMuthurChannelUpdate` in app; no duplicate `useState` for moved chat fields |
| V-P2.1-04 | Probes + tsc | PASS | all exit 0 (see below) |
| V-P2.1-05 | Line reduction | PASS | 8,544 → 8,414 (−130); imports 151 (≤152) |
| V-P2.1-06 | Scope creep | PASS | diff vs `main` — only 4 expected files; `handleSend`/`handleStop` remain in app; posture/mission/delegations untouched |
| V-P2.1-07 | Manual smoke | PASS | targeted Playwright smoke after `warm-cyberdeck` (see below) |

---

## Evidence

### `tsc --noEmit`

Exit code: `0`

### `pnpm probe:cyberdeck-compile-scope`

```text
probe-cyberdeck-compile-scope: all checks passed
  src/features/cyberdeck/cyberdeck-app.tsx: 8414 lines, 151 imports
  ceilings: 8414 lines, 152 imports
  dynamic() declarations in app: 4
```

### `pnpm probe:muthur-command-console`

Exit code: `0` — `probe:muthur-command-console PASS`

### `pnpm probe:muthur-response-visibility`

Exit code: `0` — `probe:muthur-response-visibility PASS`

### Scope diff (`main...HEAD`)

```text
 scripts/probe-cyberdeck-compile-scope.ts           |   2 +-
 src/features/cyberdeck/cyberdeck-app.tsx           | 202 +++--------------
 src/features/cyberdeck/muthur/muthur-chat-types.ts |  12 +
 .../cyberdeck/muthur/use-muthur-chat-state.ts      | 250 +++++++++++++++++++++
 4 files changed, 299 insertions(+), 167 deletions(-)
```

### Manual smoke (2026-07-08, warm server)

```text
PASS open /cyberdeck
PASS chat shell + composer visible
PASS muthur help reply (no LLM)
PASS reload persists chat messages
PASS clear chat without crash
P2.1 manual smoke: PASS
```

**Note:** `pnpm e2e:extraction-smoke` failed due to stale e2e selectors (`DECK_COMMAND_INPUT` expects GATEWAY placeholder; live UI uses `MUTHUR command input`). Not attributed to P2.1 regression; manual smoke used correct selectors.

---

## Sign-off

- [x] Judicial PASS
- [ ] PR approved for merge (awaiting human)
- [x] **P2.2 unblocked**
