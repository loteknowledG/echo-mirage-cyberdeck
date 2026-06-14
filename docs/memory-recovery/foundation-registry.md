# Foundation Registry

**Work order:** L-MEM-004 Foundation-001 Origin Artifact Preservation  
**Status:** Preserved  
**Date:** 2026-06-07

Foundation artifacts are **immutable origin records**. They are not ordinary memory. They are not embedded, ranked, pruned, summarized, deduplicated, or garbage collected.

---

## Foundation-001

| Field | Value |
|-------|-------|
| **Artifact ID** | `foundation-001` |
| **Name** | `lets-remember-something-ai` |
| **Classification** | `FOUNDATION` |
| **Role** | `origin-artifact` |
| **Source system** | Samus-Manus |
| **Source path** | `C:\dev\samus-manus\skills\mind\hey-let-remember-something-ai.txt` |
| **Destination path** | `.muthur/foundations/lets-remember-something-ai.txt` |
| **Manifest** | `.muthur/foundations/foundation-manifest.json` |
| **File size** | 151,113 bytes |
| **SHA256** | `42108fbce060426f04c55715009a8d23d30ea5cb7bcf4d23b7843450e5e15e69` |
| **Date preserved** | 2026-06-07 |
| **Lineage purpose** | Preserve continuity and lineage between Samus-Manus and MUTHUR; earliest surviving continuity record for memory persistence, identity, and agency discussions |

---

## Retrieval (read-only)

| Endpoint | Purpose |
|----------|---------|
| `GET /api/muthur/foundations` | List registered foundation artifacts |
| `GET /api/muthur/foundations?id=foundation-001` | Manifest metadata + integrity |
| `GET /api/muthur/foundations?id=foundation-001&excerpt=40` | Verbatim excerpt (first N lines) |
| `GET /api/muthur/foundations?id=foundation-001&content=1` | Full artifact text (unchanged) |

**Operator chat queries (examples):**

- Where did you come from?
- What is Foundation-001?
- What is the origin artifact?
- Tell me about lets-remember-something-ai.

---

## Protection policy

Foundation-001 is protected from:

- embedding
- ranking
- pruning
- summarization
- deduplication
- garbage collection
- automatic modification

If all standard memory systems were lost, Foundation-001 should remain.
