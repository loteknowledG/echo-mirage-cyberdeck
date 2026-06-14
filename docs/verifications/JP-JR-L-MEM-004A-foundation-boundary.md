# JP-JR-L-MEM-004A Foundation Server Boundary Verifier Report

## Verdict

PASS

The Foundation-001 retrieval path no longer leaks Node `fs` into the client bundle. `/cyberdeck` loads successfully, the `foundation-query` API works through the server-only retrieval path, and the L-UI-001 live visibility smoke can proceed.

## Files Inspected

- `src/lib/muthur-foundation-intent.ts`
- `src/lib/server/muthur-foundation-retrieval.server.ts`
- `src/app/api/muthur/foundation-query/route.ts`
- `src/app/api/muthur/foundations/route.ts`
- `src/muthur/foundations/foundation-store.ts`
- `src/features/cyberdeck/cyberdeck-app.tsx`
- `scripts/probe-foundation-server-boundary.ts`
- `scripts/probe-muthur-foundation-001.ts`
- `scripts/probe-muthur-response-visibility.ts`
- `scripts/probe-muthur-command-console.ts`
- `package.json`

Also checked `src/lib/muthur-foundation-retrieval.ts`: the mixed client/server module is absent.

## Commands Run

```powershell
pnpm probe:foundation-server-boundary
pnpm probe:muthur-foundation-001
pnpm probe:muthur-response-visibility
pnpm probe:muthur-command-console
pnpm exec tsc --noEmit
pnpm dev:stop
pnpm dev
```

Additional live checks:

```powershell
GET  http://127.0.0.1:3050/cyberdeck
POST http://127.0.0.1:3050/api/muthur/foundation-query
```

Manual UI command submitted in `/cyberdeck`:

```text
open L-ARCH-001.md
```

## Results

| Check | Result | Evidence |
|---|---:|---|
| Boundary probe | PASS | scanned 482 client-reachable files; no forbidden foundation imports |
| Foundation-001 probe | PASS | archive, manifest, artifact, SHA256 integrity, retrieval intents |
| Response visibility probe | PASS | diagnostic flood, ownership, watchdog, long response checks |
| Command console probe | PASS | scroll stability, collapse, completion, watchdog checks |
| TypeScript | PASS | `pnpm exec tsc --noEmit` exited 0 |
| `/cyberdeck` smoke | PASS | HTTP 200; no `Can't resolve 'fs'`; no `react-resizable` error |
| `foundation-query` smoke | PASS | HTTP 200 with `handled: true`, `foundation_id: "foundation-001"`, `read_only: true` |
| L-UI-001 manual command smoke | PASS | entered `composing`, reached `complete`, final response visible, diagnostics collapsed |

## Boundary Evidence

Previous bad chain is gone:

```text
cyberdeck-app.tsx
→ muthur-foundation-retrieval.ts
→ foundation-store.ts
→ fs
```

The new chain is present:

```text
cyberdeck-app.tsx
→ muthur-foundation-intent.ts
→ POST /api/muthur/foundation-query
→ muthur-foundation-retrieval.server.ts
→ foundation-store.ts
→ fs
```

`src/lib/muthur-foundation-intent.ts` contains only intent detection/types and imports no `fs`, `path`, `foundation-store`, or server retrieval module.

`src/lib/server/muthur-foundation-retrieval.server.ts` is clearly server-only by path, filename, and comment. It imports `foundation-store.ts`, which is acceptable on the server side.

`src/features/cyberdeck/cyberdeck-app.tsx` imports `parseFoundationQuery` from the client-safe intent module, calls `/api/muthur/foundation-query`, and does not import `foundation-store.ts`, `muthur-foundation-retrieval.server.ts`, or the removed mixed module.

## API Smoke

Request:

```json
{ "message": "Where did you come from?" }
```

Response summary:

```json
{
  "handled": true,
  "foundation_id": "foundation-001",
  "read_only": true
}
```

The response text references MUTHUR on Echo Mirage, Samus-Manus lineage, Foundation-001, immutable read-only classification, and integrity `PASS`.

No mutation method exists in `src/app/api/muthur/foundation-query/route.ts`; it exports `POST` only and returns read-only query results.

## Read-Only Evidence

`src/muthur/foundations/foundation-store.ts` only reads and verifies foundation data:

- reads manifest with `existsSync` and `readFileSync`
- reads artifact text with `readFile`
- resolves artifact paths
- computes SHA256 and file size for integrity verification

No write, repair, manifest update, hash update, or artifact mutation path was found.

Foundation-001 is not imported into normal memory from the client path. Foundation queries return early after the API response in `cyberdeck-app.tsx`, and server retrieval reads the foundation artifact directly as a read-only source.

## Browser Smoke Details

Clean server start:

```text
[dev] app :3050/cyberdeck | sidecar :3051/health
Next ready - sidecar :3051/health open
GET /cyberdeck 200
```

The in-app Browser surface was unavailable in this session, so I used local Playwright automation against the clean dev server.

The manual command smoke showed:

- initial footer: `MUTHUR composing…`
- final footer: `MUTHUR complete`
- visible response row: `[MUTHUR] Invalid API key.`
- Diagnostics button remained collapsed: `aria-expanded="false"`
- no stall banner
- no remaining `composing` state

Note: the selected provider returned `Invalid API key`, but the L-UI-001 visibility/lifecycle behavior under test still passed: the final response was committed, visible, complete, and not buried by diagnostics.

## Risks / Follow-Up Notes

- Provider authentication should be refreshed for semantic end-to-end command validation. The boundary and visibility checks do not depend on a successful provider answer, but a fully useful `open L-ARCH-001.md` command does.
- The in-app Browser connector was unavailable; Playwright was used as the browser automation fallback.
- Dev server was stopped after verification.
