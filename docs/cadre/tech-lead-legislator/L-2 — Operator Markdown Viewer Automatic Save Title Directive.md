# L-2 — Operator Markdown Viewer Automatic Save Title Directive

Status: ACTIVE  
Branch: Legislator  
Authority: tech-lead-legislator  
Date: 2026-05-21

## Objective

Update the Echo Mirage OperatorMarkdownViewer save/download behavior so the save button automatically derives the filename from the markdown H1 title.

Operators should not need to manually copy/paste document names during save operations.

---

## Requirements

### H1 Title Parsing

The save system must:

- parse the first markdown H1 line
- use the H1 as the canonical document title
- generate the default filename automatically

Example:

```md
# L-1 — Preview Matrix Mode System Directive
