# Echo Mirage Memory Spec

Echo Mirage needs a small durable memory layer before it can feel like an AI that
actually lives inside the cyberdeck.

The goal is not full history.
The goal is continuity.

## Core Idea

- **Memory** stores what the system needs to remember now.
- **Hat** is the active posture loaded from that memory.
- **Continuity** is the feeling that the AI knows what it is already carrying.

## What Memory Is For

Memory should keep:

- the current active project
- the current open document
- the current voice master or tuning state
- user preferences that matter across sessions
- recent decisions that should survive refresh
- a short working summary of the current task
- searchable tags for things worth locating later
- project/location pointers for where work lives

Memory should not try to be:

- a full version history
- a git log
- a chain of every edit
- a giant transcript dump

## Suggested Shape

```json
{
  "schemaVersion": 1,
  "owner": "MUTHUR",
  "project": "echo-mirage",
  "activeSurface": "operator",
  "activeDocument": {
    "name": "muthur.json",
    "path": "docs/muthur.json"
  },
  "voice": {
    "preset": "MUTHUR",
    "mode": "live",
    "source": "MichelleNeural"
  },
  "preferences": {
    "copyFirst": true,
    "archiveBeforeWrite": true,
    "keepOriginalSafe": true
  },
  "tags": [
    "header-label-placement",
    "square-card-grid",
    "mirage-backup"
  ],
  "locations": [
    {
      "label": "Echo Mirage repo",
      "path": "F:/dev/echo-mirage-cyberdeck"
    },
    {
      "label": "Atlas workspace",
      "path": "C:/dev/samus-manus"
    }
  ],
  "recentDecisions": [
    "Operator edits save back to the same file name",
    "Archive old copies before overwriting live files"
  ],
  "workingSummary": "The cyberdeck AI should feel present, file-aware, and copy-first."
}
```

## Hat

The hat is the loaded posture.

When memory is worn as a hat, the AI should act like:

- it knows the current file
- it knows the current voice state
- it knows the working rules
- it carries the current task without starting over

## Rules

1. Memory is durable.
2. Hat is active context.
3. History is optional and separate.
4. The AI should load memory, not re-derive it every turn.
5. The system should stay copy-first and non-destructive.
6. Tags and locations should make later retrieval easy.
7. Memory entries should be signed to the assistant that owns them.

## Why This Matters

This is what makes Echo Mirage feel different from a normal chat box:

- the AI can be present in the cyberdeck
- the AI can remember what it is wearing
- the user can return later without rebuilding the whole posture
- the workspace stays local-first and usable

## Short Version

Memory stores the important state.
The hat loads that state into the AI.
Continuity is the result.
