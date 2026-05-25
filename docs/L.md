# ECHO MIRAGE // OPERATOR LEXICON

Status: LIVING
Authority: operator
Scope: MUTHUR, Echo Mirage, Cyberdeck

## PURPOSE

L.md is the operational lookup and continuity layer for MUTHUR and Echo Mirage.

It contains:

- command references
- workflow notes
- operator doctrine
- subsystem descriptions
- recovery procedures
- ingestion patterns
- memory conventions
- bridge terminology

This document is intended to be human-readable and AI-readable.

---

## CORE PRINCIPLES

Context thinks.
Memory recalls.
Documents decide.

MUTHUR dreams only when the bridge is quiet.

The operator remains the final authority.

---

## COMMANDS

### HELP

Display available commands.

```text
muthur help
```

Examples:

```text
muthur help ingest
muthur help voice
muthur help atlas
```

---

### INGEST

Import external artifacts into Echo Mirage.

```text
muthur ingest document.pdf
```

Pipeline:

- extract
- convert
- chunk
- index
- atlas link
- summarize

Supported:

- pdf
- md
- txt
- json

Future:

- images
- audio
- video
- OCR scans

---

### CONVERT (IMPORT)

PDF or DOCX → markdown via MarkItDown.

```text
muthur md handbook.pdf
muthur convert handbook.pdf to markdown
```

Operator pane: **Import MD** toolbar button (PDF/DOCX picker).

Example internal execution:

```text
py -m markitdown handbook.pdf -o handbook.md
```

Requires:

```text
pip install "markitdown[pdf,docx]"
```

---

### EXPORT (DOCX / PDF)

Markdown → Word via `@mohtasham/md-to-docx`, or PDF via `md-to-pdf`.

```text
export to docx
export to pdf
muthur export to docx
muthur export to pdf
muthur docx docs/L.md
muthur pdf docs/L.md
muthur export handbook.md to docx
muthur export handbook.md to pdf
```

Operator pane: **export rolodex** — scroll to **Export to DOCX** or **Export to PDF**, release to run (current markdown document).

Output:

- browser download of `.docx` / `.pdf`, or
- `handbook.md` → `handbook.docx` / `handbook.pdf` beside source when invoked with a file path

Engines:

- DOCX: Node library `@mohtasham/md-to-docx`
- PDF: `md-to-pdf` (Puppeteer/Chromium)

MarkItDown is import-only (PDF/DOCX → MD).

---

### MEMORY

Query long-term memory.

```text
muthur memory "voice pipeline"
```

Future:

- semantic retrieval
- timeline queries
- relation tracing

---

### ATLAS

Inspect semantic atlas entities and relationships.

```text
muthur atlas echo-mirage
```

Future:

- graph visualization
- dependency maps
- operational topology

---

### VOICE

Voice subsystem controls.

```text
muthur voice list
muthur voice set muthur
muthur voice test
```

Current target profile:

- clinical
- slow
- feminine
- restrained
- ship computer tone

Inspirations:

- Alien MUTHUR
- Weyland-Yutani terminals
- cold operational AI systems

---

## OPERATOR MODES

### STANDARD

Default interaction mode.

---

### INGEST MODE

Focused on artifact processing and indexing.

---

### ARCHIVIST MODE

Focused on memory organization and recovery.

---

### WEYLAND MODE

Minimal conversational output.
Operational-only responses.

---

## FAILURE STATES

### CONVERT FAILURE

Possible causes:

- invalid path
- locked file
- OCR-only PDF
- malformed PDF
- missing dependencies

Recovery:

1. test markitdown manually
2. retry with safe filename
3. fallback OCR
4. inspect stderr

---

### EXPORT FAILURE

Possible causes:

- empty markdown
- unsupported source extension (must be `.md` / `.markdown`)
- write permission denied beside source file
- `@mohtasham/md-to-docx` or `md-to-pdf` runtime error (PDF requires Chromium/Puppeteer)

Recovery:

1. confirm operator document kind is markdown
2. retry export from operator **export rolodex** (DOCX or PDF)
3. test `muthur docx path/to/file.md` or `muthur pdf path/to/file.md` from chat
4. inspect API `/api/convert-markdown-to-docx` or `/api/convert-markdown-to-pdf` response

---

## FUTURE SYSTEMS

### DREAM MODE

Runs during idle periods.

Responsibilities:

- summarize memories
- reinforce associations
- extract entities
- improve retrieval structure

Dream mode never modifies canonical doctrine.

---

### BRIDGE LOGS

Operational event history.

Tracks:

- commands
- failures
- operator actions
- subsystem state changes

---

## DESIGN LANGUAGE

Echo Mirage is:

- operational
- interruptible
- observable
- collaborative
- continuity-oriented

Not:

- theatrical
- deceptive
- authoritarian
- hidden

---

## END OF FILE
