# L-5 — MUTHUR Document Conversion Tool Directive

Status: ACTIVE  
Branch: Legislator  
Authority: tech-lead-legislator  
Date: 2026-05-21

## Objective

Add a document conversion capability to MUTHUR that converts external document formats into canonical markdown for Echo Mirage operational use.

Markdown becomes the editable operational format inside Echo Mirage.

PDF and DOCX remain import/export interoperability formats.

---

## Core Principle

Echo Mirage is not a word processor.

Markdown is the canonical operational document format.

External document types must convert into markdown before entering the operational workflow system.

---

## Supported Input Formats

Initial required formats:

- `.pdf`
- `.docx`

Future formats may include:

- `.pptx`
- `.xlsx`
- `.html`
- `.epub`
- `.txt`

---

## Tool Name

Recommended internal tool name:

`convert_document_to_markdown`

Alternative CLI shorthand:

`muthur md <filepath>`

---

## Command Behavior

Example operator command:

```text
muthur convert resume.pdf to markdown
````

or:

```text
muthur md resume.pdf
```

---

## Conversion Pipeline

The tool must:

1. receive filepath
2. detect document type
3. invoke Microsoft MarkItDown locally
4. generate markdown output
5. open resulting markdown in OperatorMarkdownViewer
6. classify output as `text/markdown`

---

## Conversion Engine

Use:

Microsoft MarkItDown

Repository:

[https://github.com/microsoft/markitdown](https://github.com/microsoft/markitdown)

Required install:

```bash
pip install 'markitdown[pdf,docx]'
```

Expected command pattern:

```bash
markitdown <input-file> -o <output-file.md>
```

---

## Output Behavior

Generated markdown should:

* preserve document structure where possible
* preserve headings
* preserve lists
* preserve readable spacing
* remain operator-editable

Output markdown may initially save:

* beside source file
  OR
* inside temporary import workspace

---

## Operator Workflow

Expected operator flow:

```text
PDF/DOCX
→ MUTHUR conversion
→ Markdown generation
→ OperatorMarkdownViewer
→ Edit / Save / Review
```

---

## Scope

Initial implementation scope:

* local conversion only
* import only
* markdown output only

Do NOT implement yet:

* DOCX editing
* PDF editing
* export pipelines
* OCR enhancement systems
* cloud conversion services
* backend persistence systems

---

## Validation Requirements

Validation must confirm:

* PDF converts successfully
* DOCX converts successfully
* resulting markdown opens correctly
* markdown is editable
* markdown save/download still works
* output classifies as `text/markdown`

Required validation commands:

```bash
pnpm exec tsc --noEmit
pnpm build
```

---

## Constitutional Notes

Markdown is the constitutional operational document format of Echo Mirage.

External document formats exist as interoperability artifacts.

MUTHUR document conversion serves as an intake bridge into the markdown operational ecosystem.

```
```