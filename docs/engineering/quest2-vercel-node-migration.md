# Quest 2 prerequisite — Vercel Node migration

**Deadline:** Vercel will fail new builds on Node.js **20 and older** starting **September 30, 2026**.  
**Authoritative repo:** `C:\dev\echo-mirage-cyberdeck` (NVMe)  
**Local runtime:** Node **24.17.0** (matches Vercel **24.x** line)

This is advance notice — deployments can still succeed today. Treat migration as a **staged rollout**, not a bulk dashboard change.

---

## Rollout checklist

```text
Vercel Node migration
  → inventory affected projects
  → preview upgrade
  → runtime smoke tests
  → production promotion
  → record receipt
```

---

## Step 1 — Inventory (2026-08-10)

Account: **loteknowledg's projects** (`vercel project ls` / `vercel project inspect`)

### Already on Node 24.x (no action for Sept 2026 gate)

| Project | Production URL | Node |
|---------|----------------|------|
| **echo-mirage-cyberdeck** | https://echo-mirage-cyberdeck.vercel.app | **24.x** |
| keepseek | https://keepseek-app.vercel.app | 24.x |
| voice-lab | https://voice-lab-ashy.vercel.app | 24.x |
| m4trix | https://m4trix.vercel.app | 24.x |
| pages-app | https://pages-app-loteknowledgs-projects.vercel.app | 24.x |
| muthur | https://muthur-tawny.vercel.app | 24.x |
| mp4-joiner | https://mp4-joiner.vercel.app | 24.x |
| nowon | https://nowon-nine.vercel.app | 24.x |
| noosphere | https://noosphere-six.vercel.app | 24.x |
| nextjs-ai-chatbot | https://nextjs-ai-chatbot-iota-ruby-29.vercel.app | 24.x |

### Affected — Node 20 or older (must upgrade before 2026-09-30)

| Project | Node | Framework | Notes |
|---------|------|-----------|-------|
| **lotek** | 14.x | Next.js | Legacy; upgrade individually after Echo Mirage receipt |
| **nextjs-blog** | 12.x | Next.js | Oldest runtime in account |
| **blitzjs** | 14.x | Blitz.js (Legacy) | May need framework audit before 24.x |
| **n00sphere** | 18.x | Next.js | Closest to target; good second candidate |
| **with-apollo-app** | 14.x | Next.js | Template/starter; low risk if unused |

**Do not upgrade all five together.** One project per promotion cycle with preview smoke.

---

## Step 2 — Echo Mirage preview / production (Node 24)

**Dashboard state (verified):** `echo-mirage-cyberdeck` → **Node.js Version: 24.x** (`vercel project inspect echo-mirage-cyberdeck`, 2026-08-10).

No dashboard upgrade required for Echo Mirage. Remaining work:

1. Align repo `package.json` so local/CI/Vercel cannot drift silently:

   ```json
   "engines": {
     "node": "24.x"
   }
   ```

   Use **major line only** (`24.x`), not an exact patch — Vercel selects supported versions within the major.

2. Push a preview deployment with `engines` committed (next PR to `cursor/voice-lab-mechanicus-wip` or Quest 2 branch).
3. Re-run preview smoke (below) before merging to production track.

---

## Step 3 — Runtime smoke tests

### Production receipt (Node 24.x already live) — 2026-08-10

| Check | URL | Result |
|-------|-----|--------|
| Cyberdeck | `/cyberdeck` | **200** |
| MUTHUR health | `/api/muthur/health` | **200** |
| Registry | `/registry` | **200** |
| Mechanicus TTS | `POST /api/tts` | **200** — `ok=true`, edge-tts (2026-08-10) |

Survey integration and auth require operator session / Tailscale — not fully automatable from CLI; run manually on preview URL after next deploy.

### Preview gate (after `engines` PR deploy)

- [ ] `/cyberdeck` loads
- [ ] Critical API routes (`/api/muthur/health`, `/api/tts`, `/api/glyph/render`)
- [ ] Voice Lab / Mechanicus preview (operator)
- [ ] Survey relay endpoints (if preview env has keys)
- [ ] Authentication flows (if applicable on preview)
- [ ] Vercel **Functions** / build logs — no Node version mismatch warnings

---

## Step 4 — Production promotion

Echo Mirage production is **already 24.x**. Promotion for this project means:

1. Merge `engines` + any Quest 2 changes through normal PR review.
2. Confirm production deploy succeeds post-merge.
3. Re-run production smoke row above.

Other four legacy projects: repeat steps 2–4 **individually** (dashboard Node version → preview deploy → smoke → production).

Suggested order after Echo Mirage receipt:

1. **n00sphere** (18.x → 24.x, smallest jump)
2. **with-apollo-app** (if still in use)
3. **lotek**
4. **nextjs-blog**
5. **blitzjs** (legacy Blitz — may need code changes, not just dashboard)

---

## Step 5 — Receipt log

| Date | Project | Action | Node before | Node after | Smoke | Notes |
|------|---------|--------|-------------|------------|-------|-------|
| 2026-08-10 | echo-mirage-cyberdeck | Inventory + prod smoke | 24.x | 24.x | Routes + TTS 200 | Dashboard already 24.x; `engines` added in repo (uncommitted) |
| | lotek | Pending | 14.x | — | — | |
| | nextjs-blog | Pending | 12.x | — | — | |
| | blitzjs | Pending | 14.x | — | — | |
| | n00sphere | Pending | 18.x | — | — | |
| | with-apollo-app | Pending | 14.x | — | — | |

---

## References

- [Vercel runtime selection (Academy)](https://examples.vercel.com/academy/svelte-on-vercel/runtime-selection) — pin `nodejs24.x` / major-line guidance
- Quest 1 NVMe baseline: Node **24.17.0**, warm production build + Voice/TTS smoke passed locally
- Quest 2 Experiment 1: production webpack cache benchmarks under Node 24
