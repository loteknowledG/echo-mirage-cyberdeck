# L-UI-001: MUTHUR Response Visibility & Command Console Reliability

**Status:** Implemented  
**Priority:** P0 Runtime Blocker  
**Owner:** MUTHUR / Operator  
**Depends On:** None  
**Blocks:** L-MEM-006, Command Authority work, Capability Registry rollout  

---

## Objective

Ensure MUTHUR responses can always be seen, completed, and trusted regardless of diagnostic volume, tool activity, queue events, or runtime logging.

The operator must never lose a MUTHUR response because of system noise.

---

## Investigation Findings

Observed failure (`open L-ARCH-001.md` → stuck at `⏳ composing final reply...`, Diagnostics (261), no final reply):

| Cause | Classification | Fix |
|-------|----------------|-----|
| Post-stream operator I/O (`openWorkspaceFileInOperator`, `waitForOperatorDocumentReady`) ran **before** assistant commit and `setIsStreaming(false)` | State starvation | Commit assistant + clear stream **first**, then run post-stream work |
| `isStreaming` stayed true while composing footer showed progress text from `streamText` | Lifecycle bug | Clear `streamText` on commit; lifecycle derives from channel + flags |
| System/diagnostic lines lived in flat `messages` array | Channel sharing | `partitionMuthurChannelUpdate` routes `system`/`error` → `muthurDiagnostics` store |
| Diagnostics count included entire session history | Render flood | Separate `muthurDiagnostics` store with cap (200), rate limit (12/s), collapse |
| Identical queue ticks (261×) inflated UI | Diagnostic flood | Duplicate suppression → `Event repeated N times` |

**Verdict:** Primary failure was **state issue** (post-stream blocking), compounded by **diagnostic channel sharing** the response stream.

---

## Architecture

```text
Operator
    ↓
MUTHUR
    ↓
Response Channel (user + assistant only)
    ↓
Operator

Diagnostics (SYS/TOOLS/QUEUE/HEALTH/DEBUG/RENDER)
    ↓
muthurDiagnostics store
    ↓
▶ Diagnostics (N)  [collapsed by default]
```

---

## Deliverables

| ID | Deliverable | Implementation |
|----|-------------|----------------|
| D1 | Dedicated response channel | `muthur-response-channel.ts`, `muthur-command-console-log.tsx` |
| D2 | Diagnostic isolation | `muthur-diagnostics-channel.ts`, `setMessages` wrapper in `cyberdeck-app.tsx` |
| D3 | Diagnostic collapse | `presentMuthurDiagnostics`, panel default collapsed |
| D4 | Response lifecycle | `idle` / `composing` / `complete` / `failed` / `stalled` via `resolveMuthurResponsePhase` |
| D5 | Stalled watchdog | 120s `MUTHUR_RESPONSE_STALL_MS`, `buildMuthurStallMessage` banner |
| D6 | Auto scroll reliability | `buildMuthurResponseScrollKey` — scroll targets assistant, ignores diagnostics |
| D7 | Response persistence | Channel commits before diagnostics; diagnostics never replace assistant rows |
| D8 | Diagnostic rate limiting | Cap, rate limit, duplicate `repeatCount` compression |
| D9 | Long response protection | `isLongMuthurResponse`, sticky header in console log |
| D10 | Response ownership | `partitionMuthurChannelUpdate` rejects non user/assistant writes |

---

## Key Files

- `src/lib/muthur-core/muthur-response-channel.ts`
- `src/lib/muthur-core/muthur-diagnostics-channel.ts`
- `src/lib/muthur-core/muthur-command-console.ts`
- `src/components/cyberdeck/muthur-command-console-log.tsx`
- `src/features/cyberdeck/cyberdeck-app.tsx`
- `scripts/probe-muthur-response-visibility.ts`
- `scripts/probe-muthur-command-console.ts`

---

## Tests

| Test | Probe |
|------|-------|
| T1 Diagnostic flood (300 events) | `probe-muthur-response-visibility` |
| T2 Tool failure isolation | both probes |
| T3 Queue spam deduplication | both probes |
| T4 Long architecture response | both probes |
| T5 Stalled response watchdog | both probes |
| T6 Response channel ownership | `probe-muthur-response-visibility` |

Run:

```powershell
pnpm probe:muthur-response-visibility
pnpm probe:muthur-command-console
```

---

## Acceptance Criteria

- MUTHUR response always visible after commit
- Diagnostics isolated and collapsed by default
- Response lifecycle visible in footer (`composing` / `complete` / `failed` / `stalled`)
- Diagnostic floods cannot block response delivery
- Long responses remain readable
- Only user/assistant rows in response channel

Verification report: `docs/verifications/JP-L-UI-001.md`
