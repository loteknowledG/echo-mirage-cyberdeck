# L-7 — MUTHUR Conversion Housekeeping Directive

Status: ACTIVE  
Branch: Legislator  
Authority: tech-lead-legislator  
Date: 2026-05-21

## Objective

Define bounded operational housekeeping behavior for MUTHUR document conversion workflows.

During document conversion and markdown normalization, MUTHUR may perform limited mechanical cleanup operations to improve operational readability and system consistency.

MUTHUR must not autonomously alter constitutional meaning.

---

## Core Principle

MUTHUR acts as an operational document technician.

MUTHUR may normalize operational structure, but must not alter constitutional meaning without operator authorization.

---

## Allowed Housekeeping Operations

During conversion MUTHUR may:

- remove conversational wrapper fences
- normalize markdown formatting
- normalize line endings
- normalize heading spacing
- remove duplicated blank lines
- preserve UTF-8 encoding
- generate filesystem-safe filenames
- normalize mime classification
- repair obvious markdown transport artifacts
- relocate temporary conversion outputs
- auto-open converted markdown in OperatorMarkdownViewer

---

## Conversational Wrapper Cleanup

MUTHUR should automatically remove transport wrappers such as:

````text
```md
`````

and:

````text
```
````

when detected as outer conversational formatting artifacts.

Internal markdown code fences belonging to the actual document body must remain preserved.

---

## Markdown Normalization

MUTHUR may normalize:

* heading spacing
* list spacing
* paragraph spacing
* markdown separator consistency
* excessive blank-line accumulation

Normalization should preserve:

* meaning
* chronology
* constitutional identifiers
* operational terminology

---

## Filename Housekeeping

MUTHUR may automatically:

* generate safe markdown filenames
* convert em dash (`—`) to hyphen (`-`)
* convert spaces to hyphens
* preserve constitutional prefixes
* append `.md`

Example:

```text
L-7-muthur-conversion-housekeeping-directive.md
```

---

## Explicitly Forbidden Behavior

MUTHUR must NOT autonomously:

* rewrite doctrine meaning
* summarize constitutional documents
* creatively rewrite resumes
* alter operator intent
* inject generated content
* remove operational evidence
* infer missing legal/constitutional language
* restructure artifacts semantically
* hallucinate missing sections

---

## Operator Authority

Operators remain the constitutional authority over:

* meaning
* doctrine
* structure
* policy
* final operational intent

MUTHUR housekeeping exists only to normalize operational transport and formatting layers.

---

## Scope

Applies only to:

* document conversion
* markdown normalization
* conversational cleanup
* operational save preparation

Does NOT authorize:

* autonomous editing
* constitutional rewriting
* AI doctrinal reinterpretation

---

## Validation Requirements

Validation must confirm:

* wrapper cleanup works correctly
* markdown normalization preserves content
* internal code fences remain preserved
* filenames normalize correctly
* converted markdown opens correctly
* constitutional meaning remains unchanged

Required validation commands:

```bash
pnpm exec tsc --noEmit
pnpm build
```

---

## Constitutional Notes

Conversational formatting artifacts are not constitutional content.

MUTHUR housekeeping exists to preserve operational clarity while maintaining strict constitutional fidelity.