# Survey EMP — backend flip guide

How to switch between **Next.js in-process** services and **Go sidecars** for EMP Survey (Echo + Mirage + PowerFist), and what can go wrong when you flip.

Related code:

- Transport overview: [`src/lib/cyberdeck/survey-boundary.ts`](../src/lib/cyberdeck/survey-boundary.ts)
- Phase 0/1 extension capture tests: [`docs/survey-network-tests.md`](./survey-network-tests.md)
- Go project: [`f:\dev\survey-emp-go`](../../survey-emp-go) (sibling repo)
- Mirage relay client: [`src/lib/cyberdeck/survey-relay-base.ts`](../src/lib/cyberdeck/survey-relay-base.ts)
- Hub bridge: [`src/lib/server/powerfist-hub-bridge.server.ts`](../src/lib/server/powerfist-hub-bridge.server.ts)

---

## What has a “backend”?

EMP uses three links (see boundary doc). Only **two** of them have a swappable implementation today:

| Link | Transport | Default (Next) | Optional (Go) |
|------|-----------|----------------|---------------|
| Echo ↔ Mirage / PowerFist (cross-network) | **B — Cloud relay** | Next `/api/survey/relay/*` + file or Upstash store | `survey-emp-go` relay on `:8090` |
| Mirage ↔ PowerFist (hub) | **C — WebSocket hub** | Node `ws` inside Mirage process | `survey-emp-go` hub on `:3054` |
| Echo ↔ Mirage (same LAN) | **A — Direct HTTP** | Echo `:3050` | *unchanged* — not replaced by Go |

**Analyze / MUTHUR** (`/api/survey/analyze`, mission ingest) stays in Next in both modes. Go hub forwards missions; solve still runs in Mirage.

---

## Default mode (Next only)

**No Go env vars set.** This is the normal `pnpm dev` / `pnpm survey:emp` path.

- Relay: browser and Echo hit **relative** `/api/survey/relay/*` on Mirage.
- Hub: `ensurePowerfistWsServer()` starts the in-process Node WebSocket server.
- Pairing state: `.tmp/powerfist-ws.json` (written by Next).

You do **not** need `survey-emp-go` running.

---

## Go sidecar mode

Go runs as **optional sidecars** configured by env. Mirage/Echo clients call Go URLs instead of in-app routes when those vars are set.

| Service | Command | Default port |
|---------|---------|--------------|
| Relay | `go run ./cmd/relay` | `8090` |
| Hub | `go run ./cmd/hub` | `3054` |
| All-in-one dev | `go run ./cmd/emp` | starts relay + hub + satellite + Next |

---

## Flip checklist: Next → Go

### 1. Start Go services

```bash
cd f:\dev\survey-emp-go
go run ./cmd/relay    # terminal 1
go run ./cmd/hub      # terminal 2
```

Or one shot:

```bash
go run ./cmd/emp
```

Confirm health:

```bash
curl http://127.0.0.1:8090/healthz
curl http://127.0.0.1:3054/healthz
```

### 2. Set Mirage env (`.env.local`)

```env
# Transport B — cloud relay → Go
SURVEY_RELAY_BASE_URL=http://127.0.0.1:8090
NEXT_PUBLIC_SURVEY_RELAY_BASE_URL=http://127.0.0.1:8090

# Transport C — PowerFist hub → Go
ECHO_MIRAGE_POWERFIST_EXTERNAL_HUB=1
ECHO_MIRAGE_POWERFIST_HUB_HTTP=http://127.0.0.1:3054
ECHO_MIRAGE_POWERFIST_WS_PORT=3054
NEXT_PUBLIC_ECHO_MIRAGE_POWERFIST_WS_PORT=3054
```

Restart Next after changing env.

### 3. Set Echo Satellite env (when using relay from Echo)

Echo push/poll uses `SURVEY_RELAY_BASE_URL` when set; otherwise it uses `ECHO_MIRAGE_CYBERDECK_URL`.

```env
SURVEY_RELAY_BASE_URL=http://127.0.0.1:8090
SURVEY_RELAY_SECRET=your-secret   # if you use auth — must match on Go relay
```

For capture-desk WebSocket (Echo → hub):

```env
ECHO_MIRAGE_POWERFIST_WS_PORT=3054
# optional override if not using pairing-returned host:
# ECHO_MIRAGE_POWERFIST_WS_HOST=127.0.0.1
```

### 4. Shared state paths (recommended for local dev)

Point both stacks at the same files under the Mirage repo:

```env
ECHO_MIRAGE_SURVEY_RELAY_STATE_PATH=f:\dev\echo-mirage-cyberdeck\.tmp\survey-cloud-relay.json
ECHO_MIRAGE_POWERFIST_STATE_PATH=f:\dev\echo-mirage-cyberdeck\.tmp\powerfist-ws.json
```

Set the **same** paths in Go’s environment when starting relay/hub.

### 5. Re-pair if needed

Flipping hub backends changes WS port (`3052` family → `3054`). If clients still have old host/port in localStorage, clear PowerFist pairing or reconnect from Survey Hub.

---

## Flip checklist: Go → Next

1. **Stop** Go relay and hub processes.
2. **Remove or comment out** all Go-related env vars (see table below).
3. **Restart** Next (`pnpm dev` or `pnpm survey:emp`).
4. Confirm nothing is listening on `:8090` / `:3054` unless you intend to.
5. Re-open Survey Hub / re-pair PowerFist if connections were stuck on the old port.

Mirage automatically falls back:

- Empty `SURVEY_RELAY_BASE_URL` → `/api/survey/relay/*` on Next.
- No `ECHO_MIRAGE_POWERFIST_HUB_HTTP` → in-process Node hub.

---

## Relay storage: file vs Upstash

Applies to **both** Next relay and Go relay (same env vars, same key layout).

| Store | Env | Use when |
|-------|-----|----------|
| **File** | *(default)* — optional `ECHO_MIRAGE_SURVEY_RELAY_STATE_PATH` | Single machine, local dev, easy debugging |
| **Upstash** | `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` | Echo and Mirage on different networks; Vercel-hosted Mirage |

**Flip file → Upstash:** set Upstash vars on **both** the process serving relay (Next or Go) and redeploy/restart. Existing file data is **not** migrated automatically.

**Flip Upstash → file:** unset Upstash vars; relay starts empty file store until Echo pushes a new bundle.

---

## Environment variable reference

### Mirage (Next)

| Variable | Next-only | Go mode | Notes |
|----------|-----------|---------|-------|
| `SURVEY_RELAY_BASE_URL` | unset | `http://127.0.0.1:8090` | Server-side relay URL (Echo push uses its own copy) |
| `NEXT_PUBLIC_SURVEY_RELAY_BASE_URL` | unset | same as above | Browser Survey Hub relay fetch |
| `ECHO_MIRAGE_POWERFIST_HUB_HTTP` | unset | `http://127.0.0.1:3054` | Next POSTs mission-solve / mission-capture here |
| `ECHO_MIRAGE_POWERFIST_EXTERNAL_HUB` | unset | `1` | Skip binding Node WS when Go hub is healthy |
| `ECHO_MIRAGE_POWERFIST_WS_PORT` | optional | `3054` | Written into pairing state; clients use for WS |
| `NEXT_PUBLIC_ECHO_MIRAGE_POWERFIST_WS_PORT` | unset | `3054` | Browser WS URL override |
| `NEXT_PUBLIC_ECHO_MIRAGE_POWERFIST_WS_HOST` | unset | rarely needed locally | Override WS host in browser |
| `SURVEY_RELAY_SECRET` | optional | same | Bearer auth on relay push/poll (Echo) |
| `ECHO_MIRAGE_SURVEY_RELAY_STATE_PATH` | optional | **same path on Go** | Shared relay file |
| `ECHO_MIRAGE_POWERFIST_STATE_PATH` | optional | **same path on Go** | Shared pairing JSON |

### Echo Satellite

| Variable | Next-only | Go mode |
|----------|-----------|---------|
| `SURVEY_RELAY_BASE_URL` | unset | `http://127.0.0.1:8090` |
| `ECHO_MIRAGE_CYBERDECK_URL` | Mirage origin | still needed for non-relay APIs |
| `ECHO_MIRAGE_POWERFIST_WS_PORT` | unset | `3054` |
| `ECHO_MIRAGE_POWERFIST_WS_HOST` | unset | optional |

### Go (`survey-emp-go`)

| Variable | Default |
|----------|---------|
| `SURVEY_RELAY_PORT` | `8090` |
| `ECHO_MIRAGE_POWERFIST_WS_PORT` | `3054` |
| `PORT` | `3052` — used for mission `ingestUrl` host in hub |
| `UPSTASH_REDIS_REST_URL` / `TOKEN` | optional Upstash relay store |

---

## Footguns when flipping

### 1. Half-configured hub (most common)

**Symptom:** Missions fire but nothing reaches PowerFist or Echo capture; `delivered: 0`.

**Cause:** `ECHO_MIRAGE_POWERFIST_HUB_HTTP` is set but Go hub is **not** running. Broadcasts go to Go, fail, and **do not** fall back to Node.

**Fix:** Start Go hub, or remove `ECHO_MIRAGE_POWERFIST_HUB_HTTP` and restart Next.

### 2. `EXTERNAL_HUB=1` without healthy Go hub

**Symptom:** Next may skip starting Node WS if Go was up once, then you killed Go.

**Cause:** `ECHO_MIRAGE_POWERFIST_EXTERNAL_HUB=1` + stale `powerfist-ws.json` from Go.

**Fix:** Start Go hub again, or unset external hub env and restart Next (Node hub will bind again).

### 3. Port collision

**Symptom:** `[powerfist-ws] port … already in use` or Go hub fails to bind.

**Cause:** Both Node and Go trying to use the same port, or two Go hubs.

**Fix:** Go hub defaults to **3054**; Node defaults to **3052** (or `PORT+2`). Keep them distinct. Only one hub owner per port.

### 4. Relay split-brain

**Symptom:** Mirage sees a bundle; Echo thinks push succeeded; pair requests never match.

**Cause:** Echo points relay at Go (`SURVEY_RELAY_BASE_URL`) but Mirage browser still uses Next (`NEXT_PUBLIC_*` unset), or different `ECHO_MIRAGE_SURVEY_RELAY_STATE_PATH` / Upstash vs file mismatch.

**Fix:** Set **both** `SURVEY_RELAY_BASE_URL` and `NEXT_PUBLIC_SURVEY_RELAY_BASE_URL` to the same Go URL, or unset both for Next-only.

### 5. Stale WS credentials in browser

**Symptom:** PowerFist or deck socket connects to wrong port after flip.

**Cause:** `localStorage` still has old `wsPort` from pairing.

**Fix:** Unpair PowerFist in Survey Hub, or clear site data for Mirage origin; pair again.

### 6. Upstash vs file mismatch

**Symptom:** Relay works on one machine, empty on another.

**Cause:** One deployment uses Upstash, local Go uses file store.

**Fix:** Use the same storage mode and credentials everywhere, or accept separate stores per environment.

### 7. `SURVEY_RELAY_SECRET` drift

**Symptom:** Echo relay push/poll returns `401 Relay authorization failed`.

**Cause:** Secret set on Go relay but not Echo (or vice versa).

**Fix:** Align `SURVEY_RELAY_SECRET` on Echo, Go relay, and Mirage — or leave unset everywhere for local dev.

### 8. Mission ingest still on Next

**Symptom:** Go hub runs missions but analyze fails.

**Cause:** Expected — `ingestUrl` in mission envelope still targets Mirage `http://<lan>:3052/api/powerfist/mission/ingest`. Mirage must be up; MUTHUR analyze is not in Go.

**Fix:** Run Mirage Next dev server; do not expect Go to replace analyze until a future phase.

---

## Verify after a flip

### Next-only smoke

```bash
pnpm probe:survey-hub
```

### Go relay (relay must be running on :8090)

```bash
pnpm probe:survey-go-relay
```

### Manual relay check

```bash
curl "http://127.0.0.1:8090/healthz"
# After Echo push:
curl "http://127.0.0.1:8090/api/survey/relay/bundle?echoNodeId=<team-id>"
```

### Manual hub check

```bash
curl "http://127.0.0.1:3054/healthz"
# Deck WS URL from Mirage API (localhost only):
curl "http://127.0.0.1:3052/api/powerfist/pairing/deck"
```

---

## Quick decision guide

```text
Local solo dev, minimal moving parts?
  → Next only (no Go env)

Learning Go / stable WS while next dev restarts?
  → Go hub only (hub env) + Next relay, OR full Go sidecars

Echo on another machine / HTTPS PWA?
  → Relay required (Go or Next) + Upstash if not same file path

Production Vercel Mirage?
  → Next relay + Upstash today; Go relay on Fly/Railway optional later
```

---

## See also

- [`survey-emp-go` README](../../survey-emp-go/README.md) — build, ports, Go-specific env
- [`scripts/setup-survey-relay-upstash.ps1`](../scripts/setup-survey-relay-upstash.ps1) — Upstash + Vercel relay setup
