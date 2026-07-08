# L-CYBERDECK-001 — Conductor Status Board

**Updated:** 2026-07-08  

---

## Phase status

| Phase | Implementer | Judicial | Notes |
|-------|-------------|----------|-------|
| **P0** | Done | **PASS** | Baseline probe |
| **P1.1** | Done | **PASS** | Custom tab model — 8,784 lines |
| **P1.2** | Done | **PASS** | Gateway rail + coding helpers — 8,676 lines |
| **P1.3** | Done | **PASS** | Operator/ui/chat utils — 8,544 lines |
| **P2.1** | **Done** (`e1f4bf4`) | **PASS** | [JP-P2.1](../verifications/JP-L-CYBERDECK-001-P2.1.md) — chat state hook — merged `02414ce` — **8,414 lines** |

Merged history is complete; **remaining work is tracked in the PR Queue below.**

---

## Metrics ratchet (live)

| Metric | P1 complete | P2.1 (merged) | Ceiling |
|--------|------------:|--------------:|--------:|
| `cyberdeck-app.tsx` lines | 8,544 | **8,414** | 8,414 |
| Import lines | 151 | **151** | 152 |

Probe: **PASS** · `tsc`: **PASS** · MUTHUR probes: **PASS** · `main` @ `02414ce`

---

## PR Queue (operating model)

**Model:** FIFO of independent PRs. Each slice branches from **fresh `main`**, is verified at the queue head, and merges (pops) before the next branches. This is a **queue, not a stack** — nothing branches off an unmerged branch.

### Invariants

1. **One in-flight extraction PR at a time through P2** (all P2 slices edit `cyberdeck-app.tsx` — serial avoids same-file collisions).
2. **Branch from fresh `main`** after each merge — never off the previous feature branch.
3. **FAIL stays at the head** — rework pushes to the same branch; the queue does not advance until judicial PASS.
4. **Merge = pop** — merging to `main` is the only way to advance the queue.
5. **P3+ may relax invariant 1** where slices touch disjoint files (gateway vs operator vs survey).

### Loop

```text
pop head → branch from main → dev → tsc + probes → tester VERIFY → JP PASS → merge → advance
                                   ↑___________ FAIL (check ID + log) ___________|
```

### Queue state

| Pos | Slice | PR title | Deliverables | Status |
|----:|-------|----------|--------------|--------|
| — | P2.1 | `refactor: muthur chat state hook` | D2.1, D2.2 | **MERGED** `02414ce` |
| **1** | **P2.2** | `refactor: muthur send intent routing` | D2.3, D2.4 | **HEAD — ready to branch** |
| 2 | P2.3 | `refactor: extract handleSend to use-muthur-chat-send` | D2.5, D2.6 | queued |
| 3 | P2.4 | `refactor: muthur chat column component` | D2.7 | queued |
| 4 | P2.5 | `refactor: muthur commander handlers hook` | D2.8, D2.9 | queued |
| 5 | P3.1 | `refactor: gateway column extraction` | D3.1–D3.3 | queued |
| 6 | P4.1 | `refactor: layout shell and workspace chrome` | D4.1–D4.6 | queued |
| 7 | P5.1 | `refactor: operator pane host` | D5.1–D5.4 | queued |
| 8 | P6.1 | `refactor: survey hub host + boundary probe` | D6.1–D6.3 | queued |
| 9 | P7.1 | `refactor: split cyberdeck-chat route` | D7.1–D7.5 | queued |
| 10 | P8.1 | `chore: survey/powerfist rename cleanup` | D8.1–D8.4 | queued |

Deliverable detail: [L-CYBERDECK-001 work order](./L-CYBERDECK-001-cyberdeck-app-extraction.md).

### Open a queue PR (GitHub)

Each queue pop = **one GitHub PR**. CONDUCTOR tracks the program; GitHub tracks the **in-flight head**.

| Artifact | Path |
|----------|------|
| PR template (web UI) | [.github/PULL_REQUEST_TEMPLATE/cyberdeck-extraction.md](../.github/PULL_REQUEST_TEMPLATE/cyberdeck-extraction.md) |
| Pre-filled body (P2.2) | [docs/pr-queue/P2.2-pr-body.md](../pr-queue/P2.2-pr-body.md) |

**Developer — after implement + push:**

```powershell
cd f:\dev\echo-mirage-cyberdeck
git checkout main; git pull
git checkout -b cursor/extract-p2.2-muthur-send-intents
# ... implement, commit ...
git push -u origin HEAD

gh pr create `
  --title "refactor: muthur send intent routing (L-CYBERDECK-001 P2.2)" `
  --body-file docs/pr-queue/P2.2-pr-body.md `
  --base main
```

**Web UI:** GitHub → New PR → choose template **L-CYBERDECK-001 extraction**, or `?template=cyberdeck-extraction.md`.

**Tester:** verify the **PR branch**; comment JP link or commit `JP-P2.x.md` on branch.

**Merge = pop:** merge PR on GitHub → `git pull` on `main` → update queue row to MERGED → next slice branches from new `main`.

---

## Current action items

| # | Owner | Action |
|---|-------|--------|
| 1 | **Developer agent** | Branch `cursor/extract-p2.2-muthur-send-intents` from `main`; implement D2.3/D2.4; **open GitHub PR** with `docs/pr-queue/P2.2-pr-body.md` |
| 2 | **Tester agent** | Create VERIFY-P2.2 + verify head-of-queue; write JP-P2.2 |
| 3 | **Human** | Merge (pop) P2.2 after JP PASS → advances queue to P2.3 |
| 4 | **Human / dev** | (Backlog) Fix stale `DECK_COMMAND_INPUT` selector in `e2e/helpers/cyberdeck-page.ts` — chore PR or fold into P2.3 |

---

## Conductor decisions log

| Date | Decision |
|------|----------|
| 2026-07-07 | P0 judicial PASS |
| 2026-07-07 | P1.1 judicial PASS |
| 2026-07-08 | P2.1 judicial PASS — [JP-P2.1](../verifications/JP-L-CYBERDECK-001-P2.1.md); merged `02414ce` |
| 2026-07-08 | Adopted **PR Queue** operating model — one in-flight PR through P2; queue = pop-on-merge (not a stack) |
| 2026-07-08 | Added GitHub PR template + P2.2 body file — extraction PRs open on GitHub, CONDUCTOR tracks program queue |
