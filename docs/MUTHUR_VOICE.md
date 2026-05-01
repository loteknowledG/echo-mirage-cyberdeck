# MUTHUR Voice Lock

Current stable voice snapshot:

- Canonical lock: `C:\Users\quang\.codex\vault\muthur-voice.lock.json`
- Archive masters: `C:\Users\quang\.codex\vault\masters\`

Commands:

- `pnpm voice:save` to archive the current live preset and refresh the canonical lock
- `pnpm voice:restore` to restore `src/voice/muthurPreset.ts` from the canonical lock

Behavior:

- Old masters stay archived and are never overwritten.
- The live app reads from `src/voice/muthurPreset.ts`.
- If MUTHUR drifts later, restore from the canonical lock instead of retuning from scratch.
