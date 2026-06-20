# L-MUTHUR-CONTROL-001 — Pi Computer Use Delegation & Take Control Lease System

See acceptance criteria **JP-L-MUTHUR-CONTROL-001**.

## Runtime surfaces

| Surface | Path |
|---------|------|
| Lease store | `src/lib/muthur/control/pi-control-lease-store.ts` |
| Intent detection | `src/lib/muthur/control/computer-use-intent.ts` |
| Commander doctrine | `src/lib/muthur/control/muthur-control-doctrine.ts` |
| API | `GET/POST /api/muthur/control-lease` |
| UI | `src/components/cyberdeck/muthur-control-lease-host.tsx` |
| Pi execute gate | `POST /api/pi-computer-use/execute` (403 without active lease) |
| MUTHUR tools | `request_pi_control_lease`, `delegate_pi_computer_use` |

## Probe

```bash
pnpm probe:muthur-control-lease
```

## Manual JP tests

1. **Draw cat** — `MUTHUR draw me a cat.` → control request modal, Pi selected, no manual tab pick.
2. **Grant** — Grant Control → active overlay, Pi tab focused, `muthur-pi-mission` event fired.
3. **Conflict** — Move mouse during lease → conflict modal.
4. **Retake** — `← ← → → ↑ ↓ ↑ ↓` or Retake Control → lease terminated, `authority.return` receipt.
5. **Complete** — `POST { action: "terminate" }` or lease expiry → user regains control.
