# Cold Backup Receipts — Phase 1 Gate

**Work order:** L-XX Phase 1 MUTHUR Memory Wiring  
**Backup batch:** `20260613-214802`  
**Created:** 2026-06-13T21:48:02-04:00  
**Operator:** automated cold backup before Phase 1 code changes

---

## Protected files

| # | Source path | Backup path | Timestamp | Size (bytes) | SHA256 |
|---|-------------|-------------|-----------|--------------|--------|
| 1 | `C:\dev\samus-manus\.codex\memory.db` | `docs/memory-recovery/cold-backups/20260613-214802/samus-codex-memory.db` | 2026-06-13T21:48:02-04:00 | 4,890,624 | `8e81bdfdffd4b35f1b297c531dc44fd7ee893b18cf21a2bd66a200827b3dbf3f` |
| 2 | `C:\dev\samus-manus\skills\memory\memory.db` | `docs/memory-recovery/cold-backups/20260613-214802/samus-legacy-memory.db` | 2026-06-13T21:48:02-04:00 | 16,400,384 | `d795d273c6fe8b8614afffc499286be56ff4b0b7f71b84e8fa92b66156128ced` |
| 3 | `C:\Users\quang\.codex\atlas\atlas.db` | `docs/memory-recovery/cold-backups/20260613-214802/samus-central-atlas.db` | 2026-06-13T21:48:02-04:00 | 561,152 | `6d9fc395958c28d7421d9f73ecba287b7555a35366d6c1220198704412ade2c7` |
| 4 | `f:\dev\echo-mirage-cyberdeck\.muthur\memory\muthur-memory.db` | `docs/memory-recovery/cold-backups/20260613-214802/muthur-ship-memory.db` | 2026-06-13T21:48:02-04:00 | 126,976 | `42e671ce46ef274b65d294986a51d4e69ee8aa2e1a960a6784b89bc2d853f148` |

---

## Verification

To verify a backup file:

```powershell
Get-FileHash "f:\dev\echo-mirage-cyberdeck\docs\memory-recovery\cold-backups\20260613-214802\muthur-ship-memory.db" -Algorithm SHA256
```

Expected hash must match the table above.

---

## Gate status

**Phase 1 implementation authorized:** backup receipts exist for all four protected DB files.

No Samus data import is authorized by this backup step — preservation only.
