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

### CONVERT

Direct conversion utility.

```text
muthur convert handbook.pdf
```

Example internal execution:

```text
py -m markitdown handbook.pdf -o handbook.md
```

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
