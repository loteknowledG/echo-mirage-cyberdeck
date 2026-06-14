# JP-L-FS-001 — Workspace Folder Creation Verification

## Verdict

**PASS** (probe + architecture)

Operators can create folders from the workspace picker via **+ FOLDER**, with server-side validation, immediate tree refresh, and save-triggered tree refresh.

---

## Acceptance Criteria

| Test | Expected | Result |
|------|----------|--------|
| Create `Architect-Design-Reason` under `docs/cadre` | Folder created, visible without reload | PASS (probe creates under `docs/cadre`) |
| Create nested folder | Nested folder created, tree refresh path correct | PASS (probe nested `ADR`) |
| Invalid name (`../escape`) | Rejected with 400 | PASS |
| Path traversal (`../../tmp`) | Blocked, no filesystem change | PASS |

---

## Implementation Summary

### API

`POST /api/workspace/create-folder`

```json
{ "parentPath": "docs/cadre", "folderName": "Architect-Design-Reason" }
```

```json
{ "success": true, "path": "docs/cadre/Architect-Design-Reason" }
```

`GET /api/workspace/root` — exposes workspace root for client path mapping (local dev only).

### Validation

Shared module rejects:

- empty names
- reserved Windows names (`CON`, `PRN`, …)
- invalid characters (`<>:"|?*`, control chars)
- path traversal (`..`, absolute paths)

### UI

`OperatorDocFolderPane`:

- **+ FOLDER** button (distinct from **ADD FOLDER** root picker)
- Uses selected folder (or parent of selected file) as create target
- Requires disk-backed workspace root (`diskPath`)
- Refreshes parent folder and selects new folder after success
- Listens for `echo-mirage-operator-file-saved` to refresh parent folder on document save

### Save refresh

`saveOperatorDocInPlace` dispatches `echo-mirage-operator-file-saved` with `{ logicalPath }` so the folder tree updates after in-place save without reload.

---

## Files Changed

| File | Change |
|------|--------|
| `src/lib/workspace-folder-validation.ts` | **New** — shared name/path validation |
| `src/lib/server/workspace-create-folder.server.ts` | **New** — mkdir with workspace boundary checks |
| `src/app/api/workspace/create-folder/route.ts` | **New** — create-folder endpoint |
| `src/app/api/workspace/root/route.ts` | **New** — workspace root for client mapping |
| `src/lib/workspace-create-folder.ts` | **New** — client fetch + save event constant |
| `src/lib/operator-folder-nav.ts` | `findFolderTreeNode` helper |
| `src/components/cyberdeck/operator-doc-folder-pane.tsx` | + FOLDER UI, refresh, save listener |
| `src/features/cyberdeck/cyberdeck-app.tsx` | Save event includes `logicalPath` |
| `src/components/cyberdeck/operator-pane-body.tsx` | Remove duplicate save event dispatch |
| `scripts/probe-workspace-create-folder.ts` | **New** acceptance probes |
| `package.json` | `probe:workspace-create-folder` script |

---

## Commands Run

```powershell
pnpm probe:workspace-create-folder
pnpm exec tsc --noEmit
```

---

## Operator Workflow (Manual)

1. Open Document tab → **Open folders** → **ADD FOLDER** → pick repo or `docs` subfolder.
2. Select `cadre` (or `docs/cadre` depending on root mount).
3. Click **+ FOLDER** → enter `Architect-Design-Reason`.
4. Confirm folder appears under selection without page reload.
5. Save an open document → parent folder refreshes in tree.

---

## Excluded (Future Work)

- Delete / rename / move folder
- Drag-and-drop organization
- MUTHUR voice/command folder creation
