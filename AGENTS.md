# AGENTS.md

## Cursor Cloud specific instructions

### What this repo is
Single **Next.js 16** app ("Echo Mirage Cyberdeck") that is also packaged as an Electron desktop app. It hosts many feature surfaces under `src/app` (`/cyberdeck` landing, `/editor-00` document editor, `/property-manager`, `/registry`, `/powerfist`, plus `/api/*`). The `apps/` satellites (Tauri + Electron capture drones) and the Electron desktop shell are optional and not needed to run the core web product.

### Package manager / toolchain
- Uses **pnpm** (pinned via `packageManager: pnpm@10.33.2`). `.npmrc` sets `node-linker=hoisted` — keep it; Next/webpack relies on the flat `node_modules`.
- Repo nominally targets Node 20, but it runs fine on the VM's Node 22.
- `pnpm.onlyBuiltDependencies` is already set, so `pnpm install` builds native modules (node-pty, node-screenshots, puppeteer chrome, etc.) non-interactively — do not run `pnpm approve-builds`.
- The optional native dep `node-liblzma` fails to compile (needs system `liblzma-dev`). This is non-fatal, `pnpm install` still exits 0, and it only affects electron-builder xz packaging — not the web app.

### Running the app (dev)
- `pnpm dev` → app on **http://localhost:3050/cyberdeck**, a zero-Next readiness sidecar on **:3051/health**, and the PowerFist WebSocket server on **:3052**. Bundler defaults to **webpack** (`pnpm dev:turbo` for turbopack).
- Wait for `Ready in` / `[dev] Next ready` in the log; routes compile lazily on first hit (first load of a route can take 10-30s).
- Stop with `pnpm dev:stop`. If startup prints port 3051 `EADDRINUSE`, a previous dev session is still running — run `pnpm dev:stop` first. Dev writes session state to `.tmp/dev-server.json`.
- Do NOT use production `next build`/`pnpm start` for development; use `pnpm dev`.

### Env vars / AI keys
- Copy `.env.demo.example` → `.env.local` (gitignored). No database server is required (state is SQLite files + JSON on disk).
- AI/MUTHUR chat features need at least one provider key (`OPENCODE_ZEN_API_KEY`, `OPENAI_API_KEY`, or `OPENROUTER_API_KEY`). **Without keys the app still boots and serves all pages**, but chat/agent responses stay in a "NO KEY" state.
- Deterministic features that work with no keys: the **Glyph ASCII engine** (`POST /api/glyph/render` with `{"text":"...","engine":"figlet"|"ascii"|"oneline","font":"..."}`), the `/registry` showroom (live figlet rendering + rolling font picker), document-conversion `/api/convert-*`, and the `/property-manager` viewer.

### Lint / typecheck / test
- `pnpm exec tsc --noEmit` — typecheck, passes clean.
- `pnpm lint` — currently reports pre-existing "Definition for rule 'X' was not found" errors because `eslint.config.mjs` is a minimal flat config that does not register the typescript-eslint / next / react-hooks plugins that inline `eslint-disable` comments reference. This is a repo-config condition, not an environment problem.
- `pnpm e2e` runs Playwright (auto-starts `pnpm dev` on 3050 per `playwright.config.ts`). Many `pnpm probe:*` scripts are `tsx` integration probes.

### Gotchas
- The `/editor-00` Lexical editor does not reliably accept synthetic/automated keyboard input (computer-use tooling limitation), even though it is fully interactive for a human. Prefer the `/registry` glyph picker or API-level checks for automated verification of core behavior.
