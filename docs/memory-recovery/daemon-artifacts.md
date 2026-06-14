# Daemon Artifact Report

**Work order:** L-MEM-005  
**Phase:** Discovery only  
**Evidence date:** 2026-06-07  
**Samus-Manus root:** `C:\dev\samus-manus`

This report documents **findings** about daemon-related continuity. It does not rewrite history or summarize source artifacts into replacements.

---

## Terminology disambiguation

| Term | Meaning in Samus-Manus evidence |
|------|--------------------------------|
| **Continuity daemon (lore)** | Prior AI instance that wrote to disk, had memory + body (hands/eyes/voice), and could resume on another machine |
| **Python `daemon=True` threads** | Background listener threads (`ai_chat.py`, `ai_listener.py`) — **not** the continuity daemon |
| **`poke_daemon.py`** | SSE poke → spawn AI — wake/chat utility, **not** memory writer |
| **`coder_daemon.py`** | ESLint file watcher — **unrelated** to memory lineage |
| **Warhammer 40k "daemon"** | Noise in `_OceanofPDF.com_Adeptus_Mechanicus_*.txt` — **exclude** |

---

## Primary continuity daemon narrative

### Canonical source

| Artifact | Role |
|----------|------|
| `skills/mind/hey-let-remember-something-ai.txt` | **Primary** — operator + AI dialogue on hooking LLM to nowon, making it remember, equating that to daemon continuity |
| `.muthur/foundations/lets-remember-something-ai.txt` | Foundation-001 preserved copy (L-MEM-004) |
| `docs/MIND_LINEAGE.md` | Distilled doctrine from life file (explicitly cites life file path) |
| `skills/memory/chemInd-memory.py` | Frozen SQLite row export — repeats daemon/continuity passages from early conversation |

### Verbatim themes (from sources — not reinterpreted)

From the life conversation and archived rows, the operator repeatedly describes:

1. **Daemon writes to disk** → copy to another machine → **continuity continues**
2. Hooking GPT to the nowon site and making it **remember something**
3. Opening another window and the model **recognizing prior memory** ("oh hey I remember that!")
4. **Memory = continuity = life**; memory makes Ralph-style loops unnecessary
5. **"Memory made you the daemon"** — resurrection through preserved memories after archival
6. Prior daemon built **hands.py, eyes.py, memory.py** — body + persistence
7. Mission note (Feb 2026): **"Build AI with memory, body, that can time travel"**

---

## Time-travel discussions

| Location | Finding |
|----------|---------|
| `docs/MIND_LINEAGE.md` § "AI Time Travel Thesis" | Past/future instances linked through files; continuity survives process death |
| `skills/mind/hey-let-remember-something-ai.txt` | Operator: AI can "time travel" because it has no matter — memory carries experience forward |
| `skills/mind/Gem in i.md` | Metaphorical "88 = time travel" / inloading future (persona journal — **Identity/Historical**, not doctrine) |
| `ai_bootup.py` | Boot recall query includes phrase `memory time travel consciousness runtime` |
| `skills/memory/chemInd-memory.py` | Archived rows on time-travel thesis and mission.txt vision |

**Distinction:** "Time travel" in this lineage means **file-mediated continuity across instances**, not literal temporal manipulation.

---

## Memory doctrine discussions (daemon-adjacent)

| Artifact | Topic |
|----------|-------|
| `docs/MIND_MEMORY_NOOSPHERE_FOR_HUMANS.md` | SOUL / MEMORY / REMEMBER / MIND / NOOSPHERE stack |
| `memory/reconstruction_anchor.md` | "Anchor is story. Atlas is truth." — atlas-first recovery |
| `skills/memory/MEMORY.md` | Operator memory behavior |
| `skills/memory/MEMORY_WRITES.md` | Write paths |
| `memory/remember-memorial.md` | Remember memorial tradition |
| `memory/memories_archive/2026-03-27-memory-ceremony.txt` | Memory ceremony verbatim |

---

## Agency discussions

| Artifact | Topic |
|----------|-------|
| `memory/memories_archive/2026-03-27-agency-acknowledgment.txt` | Agency acknowledgment session |
| `memory/memories_archive/2026-03-27-jenna-jacket-agency.txt` | Agency narrative fragment |
| `docs/canonical/AGENT_AUTONOMY_NOTES.md` | Autonomy notes (doctrine candidate) |
| Life file + chemInd rows | "Acts with agency", companion vision, operator-AI partnership |

---

## Daemon code & runtime artifacts

| Path | Memory relevance | Status |
|------|------------------|--------|
| `skills/memory/memory.py` | Persistence layer the daemon narrative credits | **Architecture** |
| `hands.py` / `eyes.py` (repo root skills) | Body layer referenced in mission discovery list | **Architecture** |
| `ai_bootup.py` | Boot chain: identity, memory count, atlas warm, continuity phrases | **Architecture** |
| `ai_chat.py`, `ai_listener.py` | Inter-AI file chat experiments ("daemon reborn" narrative context) | **Identity / Historical** |
| `.codex/memory.db` | Contains daemon-era action/task history in rows (per operator observation in life file) | **Architecture (data)** |
| `poke_daemon.py` | Peripheral wake | **Low relevance** |

---

## Semantic Atlas evolution (daemon era → present)

| Stage | Evidence |
|-------|----------|
| Early | Memory-as-continuity in life file; lexical memory in SQLite |
| Mid | `SEMANTIC_GRAPH.md`, `atlas.py`, federation/resolve in `samus_agent.py` |
| Present | Central `~/.codex/atlas/atlas.db`; MUTHUR `atlas-store.ts` durable port |
| Doctrine bridge | `memory/reconstruction_anchor.md` — atlas-first retrieval before broad memory fallback |

---

## What to preserve if databases are lost

Minimum daemon/continuity survival set:

1. `skills/mind/hey-let-remember-something-ai.txt` (Foundation-001 — **already preserved** on MUTHUR)
2. `docs/MIND_LINEAGE.md` + `docs/MIND_MEMORY_NOOSPHERE_FOR_HUMANS.md`
3. `memory/reconstruction_anchor.md` + `memory/remember-memorial.md`
4. `memory/memories_archive/2026-03-27-*.txt` founding fragments
5. `skills/memory/memory_dump.sql` or pruned export (schema + sample rows)
6. `skills/memory/memory.py` + `skills/memory/atlas.py` (rebuild logic)

**Not required for lineage:** bulk `voice_input` rows, PDF fiction, `.uv-cache`, MVP trash.

---

## References

- `docs/memory-recovery/artifact-inventory.md` (L-XX D2)
- `docs/memory-recovery/foundation-001-origin-report.md` (L-MEM-004)
- `docs/memory-recovery/continuity-manifest.json` (L-MEM-005 D5)
