# MUTHUR // Operator command reference

Status: **IMPLEMENTED** commands as wired in `cyberdeck-app.tsx` and `/api/cyberdeck-chat` (May 2026).

Prefix notes:

- Most `/muthur …` forms also work **without** the slash (`muthur md file.pdf`).
- **`muthur, …`** / **`mother, …`** prefixes are stripped for browser commands.
- Anything not matched below is sent to the **active provider model** (OpenCode / OpenRouter / OpenAI).

---

## Gateway & uplink

| Command | Effect |
|---------|--------|
| *(paste API key when unauthenticated)* | Registers gateway key for active provider |
| `providers` · `connect providers` · `provider` | Lists configured providers (JSON in API; chat shortcut) |
| `models` · `list models` · `available models` | Lists sample models (API shortcut) |
| `status` · `connection status` | Connection snapshot (API shortcut) |
| `settings` · `/settings` | Opens SETTINGS pane (server `b`) |

---

## `/muthur` operator commands

| Command | Effect |
|---------|--------|
| `/muthur review` | Git diff → structured code review via active model |
| `/muthur read <path>` | Read file via `/api/read-file` (truncated display) |
| `/muthur history` | Recent git log via `/api/git-log` |
| `/muthur status` | Local uplink report (provider, model, keys, rate limits) |
| `clear` · `/clear` · `clear chat` · `muthur clear` · `/muthur clear` | Wipe MUTHUR chat log (local messages + persisted history) |

### Document conversion (import)

| Command | Effect |
|---------|--------|
| `/muthur md <path>` · `muthur md <path>` | PDF/DOCX → markdown, open in Operator pane |
| `/muthur convert <path> to markdown` | Same |
| `convert_document_to_markdown <path>` | Tool-style alias |

### Document export

| Command | Effect |
|---------|--------|
| `export to docx` · `/export to docx` · `muthur export to docx` | Export **current Operator** markdown → DOCX |
| `export to pdf` · `/export to pdf` · `muthur export to pdf` | Export **current Operator** markdown → PDF |
| `/muthur docx <path>` · `muthur docx <path.md>` | Export file at path → DOCX |
| `/muthur pdf <path>` · `muthur pdf <path.md>` | Export file at path → PDF |
| `/muthur export <path> to docx` · `… to pdf` | Path-based export |
| `export_markdown_to_docx <path>` · `export_markdown_to_pdf <path>` | Tool-style aliases |

---

## Custom tab commands

Optional prefix: `/tab` or `tab:`

| Command | Effect |
|---------|--------|
| `new tab` · `create tab` · `add tab` · `make tab` | Create custom rail tab (optional `named …`, `glyph …`) |
| `rename tab …` · `name tab …` · `label tab …` | Rename active custom tab |
| `convert tab to <kind>` · `set tab to <kind>` · `make tab <kind>` | Convert tab surface |
| `clear tab` · `reset tab` · `clear tab state` | Reset tab state |
| `delete tab` · `remove tab` · `close tab` | Close active custom tab |

**`<kind>` values:** `blank`, `document`, `web`, `settings`, `connection`, `pi`, `diagnostics`, `catalog`, `operators`, `memory-atlas`, `voice-lab`, `flight-log`, `glyph-channel`, `rola-dex`, `tunes` (aliases: `diagnostic`, `catelog`, `glyph`, `preview`, `roladex`, `sound-profile`, `soundprofile`, `music`).

---

## ASCII / Glyph channel

MUTHUR uses an **ASCII skill** (`ascii.render`): she picks template + style + intent; the renderer handles geometry. She should **not** hand-count spaces.

| Command | Effect |
|---------|--------|
| `ascii mode` · `glyph mode` · `ascii on` | Enable glyph routing mode |
| `ascii off` · `glyph off` | Disable glyph mode |
| `ascii clear` · `glyph clear` | Clear glyph channel |
| `ascii copy` · `glyph copy` | Copy glyph channel to clipboard |
| `ascii edit` · `glyph edit` | Glyph channel edit mode |
| `ascii view` · `glyph view` | Glyph channel view mode |
| `ascii render {…json…}` | Structured ASCII via `ascii.render` |
| `ascii <text>` · `glyph <text>` | Render plain ASCII to glyph channel |
| `figlet <text>` | Render FIGlet to glyph channel (append) |
| `figlet --font Impossible <text>` | FIGlet with explicit font |

**Templates:** `hud_box`, `sonar_title`, `boot_panel`, `warning_panel`, `operator_status`, `route_verify_report`

**Style profiles:** `weyland`, `muthur`, `echo_mirage`, `retro_terminal`, `alarm`, `stealth`

**Model `ascii.render` JSON** (in ` ```ascii-render ` fence, auto-applied):

```json
{
  "tool": "ascii.render",
  "template": "sonar_title",
  "text": "ECHO MIRAGE",
  "subtitle": "bridge live // operator visible",
  "style": "echo_mirage",
  "width": 72,
  "merge": "append"
}
```

Legacy figlet directive: `[GLYPH:engine=figlet text="ECHO MIRAGE" font=Impossible merge=append]`

API: `GET/POST /api/ascii/render` — catalog + server render.

---

## Browser (operator web pane)

Prefix optional: `/browser`, `browser:`, `/web`, `web:` — or natural phrases (`go to …`, `search the web for …`).

| Command | Effect |
|---------|--------|
| `back` · `go back` | Browser back |
| `forward` · `go forward` | Browser forward |
| `reload` · `refresh` | Reload page |
| `snapshot` · `capture` · `inspect` | Page snapshot text |
| `goto <url>` · `go to <url>` · `open <url>` · `navigate <url>` | Navigate |
| `click <selector>` · `press` · `tap` | Click element |
| `click the first result` | Click first link/button |
| `type <selector> with <text>` · `fill …` | Type into field |
| `submit <selector>` · `send <selector>` | Submit form |
| `find …` · `search …` · car/job shopping phrases | DuckDuckGo / derived search URL |

When **browser pane** is active, bare URLs and domain-like text also navigate.

After MUTHUR offers a web search, reply **`yes`** · **`ok`** · **`go ahead`** · **`search it`** to confirm.

---

## Computer use & Card Table

Matched when message contains keywords like: `status report`, `inspect`, `observe`, `workflow`, `card table`, `execution deck`, `indicate`, `highlight`, etc.

### Capabilities & screen

- `what computer use capabilities` · `what can you do` · `computer use status` · …
- `inspect screen` · `what's on my screen` · `take a screenshot` · …

### Workflow observation

- `start workflow observation` · `observe this workflow` · …
- `pause workflow observation` · `resume workflow observation`
- `stop workflow observation` · `stop observing`

### Observation Q&A (during workflow)

- `yes` · `no` · `skip` · `record this` · `ignore this` · `optional` · `recovery`
- Also: `muthur, yes` etc.

### Card Table / execution deck

- `show execution deck` · `show deck` · `describe deck` · …
- `prepare reviewer hand` · `prepare hand` · `stage workflow` · …
- `what is in my hand` · `describe staged hand` · …
- `clear deck` · `clear execution deck` · …
- `push hand to stack` · `commit hand` · …
- `execute deck` · `run the play` · … *(returns disabled reason — execution gated)*

### UI pointer

- `indicate …` · `highlight …` (targets: command input, voice lab, panels)
- `clear indicators` · `clear pointers`

### Teaching demo

- `muthur, start teaching demo` · `guide me through the interface`

---

## Model response hooks

If the assistant reply contains:

```text
[EXEC:read path=src/foo.ts]
[EXEC:diff]
[EXEC:log]
[EXEC:typecheck]
[EXEC:ls path=.]
```

…the client runs `/api/muthur-command` and posts a system line with the result.

---

## Server-side model tools

When `ENABLE_AUTOMATION = true`, the uplink model may call:

| Tool | Purpose |
|------|---------|
| `justbash` | Shell in workspace mirror |
| `localfs` | List/read/write files in project workspace |
| `clock` | Server date/time |
| `convert_document_to_markdown` | PDF/DOCX → MD |
| `export_markdown_to_docx` | MD → DOCX |
| `export_markdown_to_pdf` | MD → PDF |

**Current build:** `ENABLE_AUTOMATION = false` — tools are not invoked; chat is plain provider streaming only.

---

## Help

| Command | Effect |
|---------|--------|
| `help` · `/help` · `muthur help` · `/muthur help` | Command index |
| `muthur help <topic>` | Topic: `gateway` · `muthur` · `docs` · `tabs` · `glyph` · `browser` · `computer` · `chat` |
| `clear` · `clear chat` · `muthur clear` | Same as `/muthur` table above — clears chat without model call |

---

## Planned / documented but not wired in chat

From `docs/L.md` lexicon — **not** handled by local parsers today:

- `muthur ingest …`
- `muthur memory "…"` *(client memory context is automatic; no query command)*
- `muthur atlas …`
- `muthur voice list|set|test`

---

## Natural language

All other input → **provider chat** with MUTHUR system prompt, client memory context, optional browser snapshot, and recent history (last 8 turns).

Examples: `explain the repo`, `what changed in flight log`, `help me debug the uplink`, etc.
