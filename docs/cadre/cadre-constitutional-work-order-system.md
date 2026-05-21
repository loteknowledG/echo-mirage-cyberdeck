# Cadre Constitutional Work Order System

## Overview

Cadre operates as a mechanical constitutional workflow system.

This is not agile task management.

Cadre models operational state transitions between constitutional branches:

* Legislator
* Executive
* Judicial

Documents are markdown artifacts representing work orders, implementation threads, evidence submissions, judicial outcomes, and operational descriptions.

---

# Constitutional Branches

## Legislator

Prefix:

`L`

Role:

* defines directives
* establishes requirements
* creates work orders
* defines constitutional intent

Example:

`L-1 — Preview Matrix Mode System Directive`

---

## Executive

Prefix:

`E`

Role:

* implements directives
* maintains implementation thread
* responds to judicial corrections
* updates operational state

Example:

`E-1 — Preview Matrix Mode System Directive`

The executive document remains stable for the lifetime of the work order.

`E-1` is a living implementation thread, not a one-time submission.

---

## Judicial

Prefixes:

* `JR`
* `JP`
* `JF`

Role:

* validates implementation
* issues corrections
* closes work orders
* escalates constitutional failures

---

# Description Text

Each artifact contains a human-readable operational description.

Pattern:

`<PREFIX-ID> — <Description>`

Examples:

`L-1 — Preview Matrix Mode System Directive`

`E-1 — Preview Matrix Mode System Directive`

`JR-1.1 — Compact mode pane behavior incorrect`

`JP-1.3 — Preview Matrix implementation approved`

Descriptions provide:

* operational context
* human readability
* feed clarity
* machine grouping visibility

The constitutional ID provides machine identity.

The description provides operational meaning.

---

# Judicial States

## JR — Judicial Rework

Meaning:

* implementation requires correction
* work order remains active
* executive must continue iteration

Examples:

`JR-1.1`
`JR-1.2`

A JR document may be updated multiple times during a work-order cycle.

---

## JP — Judicial Pass

Meaning:

* implementation satisfies directive requirements
* work order is complete

Example:

`JP-1.3`

This indicates:

* work order 1
* passed on review cycle 3

---

## JF — Judicial Fail

Meaning:

* constitutional or architectural failure
* legislator intervention required
* current directive cannot continue safely

Example:

`JF-1.2`

A fail condition typically results in creation of a new legislator directive:

`L-2`

---

# Evidence Receipts

Prefix:

`ER`

Role:

* records evidence for a specific judicial review cycle
* stores screenshots, logs, validation outputs, build results, notes, or proof artifacts

Examples:

`ER-1.1`
`ER-1.2`

Evidence receipts pair with judicial review cycles.

---

# Numbering System

## Root Work Order

The root number represents the constitutional work order.

Examples:

`L-1`
`E-1`

These remain stable for the lifetime of the directive cycle.

---

## Review / Evidence Iterations

Decimals represent judicial review iterations.

Examples:

`ER-1.1`
`JR-1.1`

`ER-1.2`
`JR-1.2`

`ER-1.3`
`JP-1.3`

This means:

* work order 1
* review/evidence cycle 3
* passed on cycle 3

---

# Mechanical Flow

Example operational sequence:

`L-1`
Directive issued

↓

`E-1`
Implementation thread created

↓

`ER-1.1`
Evidence submission

↓

`JR-1.1`
Rework required

↓

`ER-1.2`
Updated evidence submission

↓

`JR-1.2`
Additional correction required

↓

`ER-1.3`
Final evidence submission

↓

`JP-1.3`
Work order approved

---

# Core Principles

## Append-Only History

Cadre preserves operational chronology.

Artifacts are not overwritten.
State transitions are recorded historically.

---

## Mechanical State Machine

Cadre is not an agile workflow system.

Cadre behaves as a constitutional mechanical process system.

Documents represent:

* state
* authority
* routing
* validation
* operational transitions

---

## Shared Work Order Identity

All artifacts within the same constitutional cycle share the same root work-order number.

Example:

`L-1`
`E-1`
`ER-1.x`
`JR-1.x`
`JP-1.x`

This preserves mechanical linkage across the full operational cycle.

---

# Markdown as Constitutional Truth

Markdown documents are the canonical human-readable operational artifacts of Cadre.

Markdown serves as:

* directive storage
* implementation history
* judicial review
* operational feed content
* constitutional memory

Additional systems may later transform markdown into:

* PDFs
* dashboards
* overlays
* feeds
* reports
* operational displays

However markdown remains the canonical source artifact.
