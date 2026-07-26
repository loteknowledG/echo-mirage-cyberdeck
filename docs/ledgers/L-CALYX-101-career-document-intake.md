# L-CALYX-101 — Career Document Intake & Evidence Extraction

## Status

Proposed

## Product

Echo Mirage Cyberdeck

## Objective

Implement document ingestion for the Career domain.

Users must be able to import career documents (DOCX, PDF, Markdown, TXT, and future formats), extract candidate career records, preserve source evidence, and review all extracted information before it becomes part of the verified Career Intelligence knowledge base.

This ledger establishes the intake pipeline, extraction engine, review workflow, evidence storage, and UI for approving imported records.

No AI-generated facts may become verified automatically.

Resume generation is not part of this ledger.

---

# Vision

Transform:

```text
Resume.pdf
```

into:

```text
Employer
  ↓
Client
  ↓
Project
  ↓
Skill
  ↓
Accomplishment
  ↓
Evidence
  ↓
Timeline
```

The uploaded document remains the source of truth.

Every extracted fact maintains a link back to the original evidence.

---

# Architectural Decision — Calyx Intake Engine

Career document intake is the **first domain implementation** of a reusable **Calyx Intake Engine**.

The pipeline is domain-independent:

```text
Upload
  ↓
Store Original
  ↓
Extract Text
  ↓
Normalize
  ↓
Extract Candidate Records   ← domain-specific extractor
  ↓
Generate Evidence
  ↓
Create DRAFT Objects        ← domain-specific mapper
  ↓
Operator Review
  ↓
Verify
  ↓
Domain Knowledge
```

Future domains reuse the same engine:

```text
Calyx Intake Engine
  ↓
Career
  ↓
Property
  ↓
Medical
  ↓
Research
  ↓
Legal
```

Only the **entity extractor** and **domain mapper** change per domain.

Dependency direction:

```text
Career Intake UI
    ↓
Career Intake API
    ↓
Career Intake Adapter (domain mapper + entity extractor)
    ↓
Calyx Intake Engine (domain-independent)
    ↓
Calyx Infrastructure / Local Persistence
```

The Calyx intake core must never import from Career (or any other domain).

Career is not the feature — Career is the proof that the Calyx Intake Engine works.

Create domain-independent intake under:

```text
src/lib/calyx/intake/
```

Create Career-specific intake under:

```text
src/lib/calyx/domains/career/intake/
```

Do not duplicate intake infrastructure inside the Career domain when the engine can own it.

---

# Execution Doctrine

This ledger is the authoritative task specification.

Begin by inspecting the repository, L-CALYX-100 Career domain, existing document upload and storage conventions (Drop Bay, operator file surface, document pane), and project conventions. Do not require a ceremonial Cognosys or Calyx preflight before beginning.

Use the **trigger-based need-arises recall doctrine**:

1. Act directly when the task and existing project pattern are clear.
2. Recall Cognosys knowledge when the user explicitly asks for recall, briefing, memory, or a known playbook.
3. Recall when the task depends on previous architectural decisions, project conventions, or operator procedures not available in the current context.
4. Recall when a specialized workflow or application-specific playbook is known to exist.
5. Recall after one failed attempt, unexpected state, contradictory implementation, or unresolved ambiguity.
6. Recall before destructive, irreversible, security-sensitive, or production-impacting actions.
7. Recall before inventing a new convention when an established project convention may already exist.
8. Load only the smallest relevant knowledge unit, then continue execution.

Do not repeatedly rediscover solved procedures.

Do not recall merely to satisfy ceremony.

If this ledger conflicts with recalled material or L-CALYX-100, stop and report the conflict rather than silently choosing one.

---

# Existing Architecture (L-CALYX-100)

Career Intelligence foundation is implemented under:

```text
src/lib/calyx/domains/career/
```

Existing capabilities to preserve and extend:

* domain types with `DRAFT` / `VERIFIED` / `DISPUTED` / `ARCHIVED`
* `CareerEvidence`, `CareerEvidenceLink`
* local JSON persistence under `<CALYX_HOME>/echo-mirage-domains/career/<ownerId>/`
* service layer with explicit verification
* API routes under `/api/calyx/career/*`
* Cyberdeck Career pane at `/cyberdeck/career`

Do not replace L-CALYX-100 infrastructure unless a verified defect requires it.

Do not add intake-specific behavior directly to existing Calyx core files (`calyx-config`, `calyx-mcp-client`, etc.) unless required for a confirmed shared capability.

---

# Scope

This ledger includes:

* Calyx Intake Engine (domain-independent core)
* Career document uploads
* document registry
* text extraction pipeline (DOCX, PDF, Markdown, TXT)
* candidate entity extraction (Career adapter)
* review queue
* evidence linkage to source documents
* DRAFT record creation (never auto-VERIFIED)
* approval / reject / merge / split workflow
* duplicate detection presentation
* import history
* extraction confidence metadata
* Career Intake UI (three-panel review)
* API routes
* probes/tests
* architecture documentation update

---

# Non-Goals

Do not implement:

* resume generation
* DOCX or PDF export
* job-description matching
* ATS scoring
* interview-story generation
* automatic merge without operator choice
* automatic verification of extracted entities
* invented accomplishments, metrics, dates, or employment relationships
* multi-user authentication
* LinkedIn synchronization
* full knowledge graph (L-CALYX-102)
* skill evidence engine beyond basic extraction (L-CALYX-103)
* Calyx MCP persistence for intake documents (unless verified contracts exist)

---

# Supported Formats

Phase 1:

```text
DOCX
PDF
Markdown (.md)
Plain text (.txt)
```

Design the text extraction pipeline to support future formats without rewriting the intake engine:

```text
HTML
RTF
ODT
LinkedIn export
JSON
Email (.eml)
```

Reject unsupported formats with clear errors. Do not accept arbitrary client-supplied filesystem paths.

---

# Pipeline States

```text
UPLOADED
TEXT_EXTRACTED
ENTITIES_IDENTIFIED
DRAFT_CREATED
UNDER_REVIEW
COMPLETE
FAILED
```

State transitions must be explicit and persisted. Failed imports retain the original document and error metadata.

---

# Deliverable 1 — Intake Engine Types

Create:

```text
src/lib/calyx/intake/intake-types.ts
```

Define domain-independent types:

```ts
export type IntakeExtractionStatus =
  | "UPLOADED"
  | "TEXT_EXTRACTED"
  | "ENTITIES_IDENTIFIED"
  | "DRAFT_CREATED"
  | "UNDER_REVIEW"
  | "COMPLETE"
  | "FAILED";

export type IntakeDocument = {
  id: string;
  ownerId: string;
  domain: string;
  filename: string;
  mimeType: string;
  checksum: string;
  uploadDate: string;
  source: "OPERATOR_UPLOAD" | "API" | "SEED";
  storageKey: string;
  extractionStatus: IntakeExtractionStatus;
  extractedTextHash?: string;
  pageCount?: number;
  byteSize: number;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
};

export type IntakeTextSpan = {
  page?: number;
  startLine?: number;
  endLine?: number;
  startOffset?: number;
  endOffset?: number;
  excerpt: string;
};

export type IntakeCandidateEntity = {
  id: string;
  importId: string;
  entityType: string;
  label: string;
  payload: Record<string, unknown>;
  confidence: "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";
  sourceSpan?: IntakeTextSpan;
  duplicateOfExistingId?: string;
  reviewStatus: "PENDING" | "APPROVED" | "REJECTED" | "MERGED" | "DISCARDED";
  createdAt: string;
  updatedAt: string;
};

export type IntakeImportRecord = {
  id: string;
  ownerId: string;
  domain: string;
  documentId: string;
  status: IntakeExtractionStatus;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  entitiesExtracted: number;
  entitiesApproved: number;
  entitiesRejected: number;
  errors: string[];
  createdAt: string;
  updatedAt: string;
};
```

Use `crypto.randomUUID()` for server-generated IDs.

---

# Deliverable 2 — Intake Engine Core

Create:

```text
src/lib/calyx/intake/intake-document.server.ts
src/lib/calyx/intake/intake-text-extractor.server.ts
src/lib/calyx/intake/intake-pipeline.server.ts
src/lib/calyx/intake/intake-review.server.ts
src/lib/calyx/intake/intake-history.server.ts
src/lib/calyx/intake/intake-storage.server.ts
src/lib/calyx/intake/index.ts
```

Requirements:

* Server-only.
* Owner-scoped operations (reuse owner validation patterns from L-CALYX-100).
* Store original documents immutably under an approved intake root:

```text
<CALYX_HOME>/echo-mirage-intake/<domain>/<ownerId>/documents/<documentId>/
```

* Store extracted text separately with content hash.
* Atomic writes for metadata JSON.
* Serialize mutations per owner.
* Reject directory traversal.
* Never expose absolute paths to the browser.
* Pluggable text extractors by MIME type / extension.
* Pipeline orchestration with explicit state transitions.
* Review queue abstraction (pending / approved / rejected entities).
* Import history with counts and timing.

Text extractors for Phase 1:

* DOCX — reuse existing project libraries where available
* PDF — reuse `pdfjs-dist` or existing PDF utilities in the repo
* Markdown / TXT — direct read with normalization

Do not invent text when extraction fails; mark import `FAILED` with reason.

---

# Deliverable 3 — Intake Extractor Contract

Create:

```text
src/lib/calyx/intake/intake-extractor.ts
```

Define:

```ts
export interface DomainIntakeExtractor {
  domain: string;
  extractEntities(input: {
    ownerId: string;
    document: IntakeDocument;
    normalizedText: string;
  }): Promise<IntakeCandidateEntity[]>;
  mapApprovedEntities(input: {
    ownerId: string;
    entities: IntakeCandidateEntity[];
  }): Promise<void>;
}
```

The engine invokes the domain extractor after text extraction.

The engine never hard-codes Career entity types.

---

# Deliverable 4 — Career Intake Adapter

Create:

```text
src/lib/calyx/domains/career/intake/career-document.server.ts
src/lib/calyx/domains/career/intake/career-document-parser.server.ts
src/lib/calyx/domains/career/intake/career-entity-extractor.server.ts
src/lib/calyx/domains/career/intake/career-review.server.ts
src/lib/calyx/domains/career/intake/career-import-history.server.ts
src/lib/calyx/domains/career/intake/career-intake-service.server.ts
src/lib/calyx/domains/career/intake/index.ts
```

Implement `DomainIntakeExtractor` for Career.

Detect candidate entities:

* employers
* clients (consulting engagements)
* titles
* projects
* technologies / skills
* dates (only when explicitly present in text)
* education
* certifications
* achievements / accomplishments
* locations

Rules:

* Never invent missing information.
* Never infer dates.
* Never infer metrics.
* Never infer employment relationships.
* Never overwrite verified records.
* Never merge automatically.

Each extracted candidate maps to L-CALYX-100 types as `DRAFT` only.

Each candidate generates `CareerEvidence` with:

* `sourceType`: `RESUME` or `DOCUMENT`
* source document reference
* excerpt with page/line span when available
* confidence from extraction

Link evidence to candidate entities via `CareerEvidenceLink`.

---

# Deliverable 5 — Duplicate Detection

When an extracted entity may match an existing record (e.g., employer name "Nike"):

* Do not auto-merge.
* Flag `duplicateOfExistingId` on the candidate entity.
* Present operator choices:

```text
Possible duplicate

Existing Employer: Nike
Imported Employer: Nike

Choose:
  Merge
  Keep Separate
  Discard
```

Merge requires explicit operator action through the review API.

---

# Deliverable 6 — Career Intake Service

Extend Career service layer (or intake service) with:

```ts
uploadCareerDocument(ownerId: string, file: Buffer, meta: UploadMeta)
runCareerImport(ownerId: string, documentId: string)
getCareerImport(ownerId: string, importId: string)
listCareerImports(ownerId: string)
reviewCareerImportEntity(ownerId: string, importId: string, entityId: string, action)
approveCareerImportSelections(ownerId: string, importId: string, entityIds: string[])
rejectCareerImportSelections(ownerId: string, importId: string, entityIds: string[])
searchCareerIntake(ownerId: string, query: IntakeSearchQuery)
```

Approved entities create or link L-CALYX-100 DRAFT records.

Verification remains a separate explicit step (reuse L-CALYX-100 `verify` flow).

---

# Deliverable 7 — API Routes

```text
POST   /api/calyx/career/import
GET    /api/calyx/career/imports
GET    /api/calyx/career/imports/[id]
POST   /api/calyx/career/imports/[id]/review
POST   /api/calyx/career/imports/[id]/approve
POST   /api/calyx/career/imports/[id]/reject
GET    /api/calyx/career/imports/search
```

Use the L-CALYX-100 `ApiResponse` envelope.

Status codes: 200, 201, 400, 404, 409, 413 (file too large), 415 (unsupported type), 500, 503.

Do not expose storage paths, checksum internals beyond UI need, or stack traces.

Multipart upload for `POST /import`. Enforce max file size.

---

# Deliverable 8 — Career Intake UI

Extend Cyberdeck Career pane or add sub-route:

```text
/cyberdeck/career/intake
```

Three-panel layout:

**Left — Uploaded documents**

* import history
* extraction status badges
* re-run / delete draft import actions

**Center — Extracted entities**

* grouped by type (employer, client, project, skill, accomplishment, education, certification)
* confidence badges
* duplicate warnings with merge / keep separate / discard
* DRAFT status on all imports

**Right — Evidence preview**

* original document metadata
* extracted text excerpt with page/line highlight
* Approve / Reject / Edit actions per entity or batch

Navigation path in UI:

```text
Cyberdeck → Career → Documents → Review Queue → Evidence Viewer
```

Follow existing Cyberdeck design language. Support narrow pane widths.

Drag-and-drop upload on the intake view (reuse Drop Bay / operator drop patterns where practical).

---

# Deliverable 9 — Search

Support operator queries:

* show imported documents
* show draft entities from imports
* show records awaiting review
* show evidence for employer
* show evidence for accomplishment

Implement as filtered API + UI facets. Full-text search may use extracted text index locally; do not require Calyx MCP search for Phase 1.

---

# Deliverable 10 — Import History

Persist per import:

* import date
* source document
* entities extracted
* entities verified (after explicit verify step)
* entities rejected
* duration
* errors

Surface in UI and `GET /imports`.

---

# Target Directory Structure

```text
src/lib/calyx/
├── intake/
│   ├── intake-types.ts
│   ├── intake-extractor.ts
│   ├── intake-document.server.ts
│   ├── intake-text-extractor.server.ts
│   ├── intake-pipeline.server.ts
│   ├── intake-review.server.ts
│   ├── intake-history.server.ts
│   ├── intake-storage.server.ts
│   └── index.ts
└── domains/
    └── career/
        ├── intake/
        │   ├── career-document.server.ts
        │   ├── career-document-parser.server.ts
        │   ├── career-entity-extractor.server.ts
        │   ├── career-review.server.ts
        │   ├── career-import-history.server.ts
        │   ├── career-intake-service.server.ts
        │   └── index.ts
        └── ... (L-CALYX-100 files)
```

---

# Tests

Add tsx probes (repository convention) for:

* supported format detection
* text extraction for DOCX, PDF, MD, TXT fixtures
* pipeline state transitions
* owner isolation and traversal prevention
* extracted entities remain DRAFT
* evidence links to source document
* duplicate detection flags (no auto-merge)
* approve creates DRAFT career records
* reject does not create records
* verified records not overwritten
* import history accuracy
* API response envelopes
* no path leakage

Integration probe flow:

1. Upload sample resume fixture (fictional, in `data/examples/`).
2. Extract text.
3. Identify candidate employers and skills.
4. Present review queue.
5. Approve subset.
6. Confirm DRAFT records created with evidence links.
7. Explicitly verify one record.
8. Confirm original document retained.
9. Reject another candidate; confirm no record created.

Use temporary directories only.

---

# Required Documentation

Create or update:

```text
docs/ledgers/L-CALYX-101-career-document-intake.md
docs/architecture/ADR-CALYX-002-intake-engine.md
docs/domains/CALYX-CAREER-DOMAIN.md
```

ADR-CALYX-002 should state:

* Intake Engine is domain-independent infrastructure.
* Career is the first domain adapter.
* Upload → extract → review → evidence → knowledge is reusable.
* Original documents and evidence excerpts are immutable.
* Extraction produces candidates, not verified facts.

---

# Acceptance Criteria

The work is complete only when:

* A user can upload a DOCX or PDF resume.
* Text is extracted and normalized.
* Candidate employers, projects, and skills are identified.
* Supporting evidence excerpts are visible with document reference.
* Operator can approve selected entities → DRAFT records created.
* Operator can reject incorrect entities → no records created.
* Operator can resolve duplicate warnings explicitly.
* Approved records require separate verify action to become VERIFIED.
* Import history is browsable.
* Imported evidence is searchable/filterable.
* Original document is never lost.
* Calyx intake core does not import Career code.
* Career intake adapter does not duplicate engine logic.
* L-CALYX-100 Career foundation still works.
* Typecheck passes.
* Career intake probes pass.
* Existing Calyx smoke checks pass.

---

# Stop Conditions

Stop and report instead of improvising when:

* No viable text extraction library exists for a Phase 1 format without new dependencies — propose smallest addition.
* Extraction quality requires LLM inference with no operator review UI — do not ship auto-trust.
* Existing document storage conventions conflict with immutable intake storage.
* Duplicate detection would require invented fuzzy matching beyond name equality — document limitation and stop.

---

# Follow-Up Ledgers

```text
L-CALYX-102 — Knowledge Graph Relationships
L-CALYX-103 — Skill Evidence Engine
L-CALYX-104 — Career Search
L-CALYX-105 — Evidence-Grounded Resume Composer
L-CALYX-106 — Job Description Matching
L-CALYX-107 — Interview Studio
L-CALYX-108 — Multi-User Career Workspaces
```

Future domain intake (Property, Medical, Research, Legal) should add only:

```text
src/lib/calyx/domains/<domain>/intake/<domain>-entity-extractor.server.ts
```

plus domain types and UI — not a new intake pipeline.

---

# Required Completion Report

Cursor must return:

```text
L-CALYX-101 COMPLETE

Summary
- ...

Architecture
- ...

Cognosys recall used
- None
or
- <knowledge unit and why it was needed>

Files added
- ...

Files modified
- ...

API routes
- ...

Persistence
- ...

UI
- ...

Tests added
- ...

Commands executed
- ...

Verification results
- Typecheck:
- Lint:
- Intake probes:
- Integration probes:
- Smoke tests:

Known limitations
- ...

Deviations from ledger
- None
or
- ...

Follow-up recommendations
- ...
```

Do not claim completion unless applicable verification commands were actually executed successfully.
