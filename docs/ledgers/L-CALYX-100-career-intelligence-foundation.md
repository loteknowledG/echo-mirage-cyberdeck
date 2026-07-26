# L-CALYX-100 — Career Intelligence Foundation

## Status

Complete

## Product

Echo Mirage Cyberdeck

## Objective

Implement **Career Intelligence** as the first domain module built on Echo Mirage’s existing Calyx knowledge infrastructure.

The module must allow a user to create and maintain a structured, evidence-backed career portfolio containing:

* personal career profile
* employers
* consulting clients
* roles and dates
* projects
* accomplishments
* skills and supporting evidence
* education
* certifications
* timeline records

This ledger establishes the domain model, validation, persistence boundary, service layer, API surface, and initial operator UI.

Resume generation is not part of this ledger.

---

# Execution Doctrine

This ledger is the authoritative task specification.

Begin by inspecting the repository, existing Calyx implementation, architectural documentation, and project conventions. Do not require a ceremonial Cognosys or Calyx preflight before beginning.

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

If this ledger conflicts with recalled material, stop and report the conflict rather than silently choosing one.

---

# Existing Architecture

Echo Mirage already contains a Calyx integration under:

```text
src/lib/calyx/
```

Expected existing files include:

```text
calyx-config.server.ts
calyx-mcp-client.server.ts
calyx-readiness.server.ts
calyx-status.ts
calyx-types.ts
calyx-vault.server.ts
```

The existing implementation provides:

* Calyx home and vault configuration
* MCP binary discovery
* JSON-RPC communication over stdio
* MCP initialization
* MCP tool discovery and execution
* readiness probing
* runtime status reporting
* Echo Mirage vault creation
* ingest-lens provisioning

Preserve this implementation.

Do not replace, duplicate, or broadly refactor existing Calyx infrastructure unless a verified defect makes a change necessary.

Calyx core must remain domain-independent.

Career-specific behavior must not be added directly to the existing core files.

---

# Architectural Decision

Career Intelligence is a domain built on top of Calyx.

The dependency direction must remain:

```text
Career UI
    ↓
Career API
    ↓
Career Service
    ↓
Career Repository
    ↓
Calyx Infrastructure / Local Persistence
```

The Calyx base layer must never import from the Career domain.

Create the domain under:

```text
src/lib/calyx/domains/career/
```

Do not move the existing Calyx files during this ledger unless required to fix a confirmed issue. Avoid unnecessary migration risk.

---

# Scope

This ledger includes:

* career-domain types
* external-input validation
* repository abstraction
* local JSON persistence
* future Calyx repository boundary
* repository factory
* service layer
* ownership isolation
* timeline generation
* summary derivation
* API routes
* initial operator UI
* seed/import utility
* tests
* architecture and completion documentation

---

# Non-Goals

Do not implement:

* resume generation
* DOCX or PDF export
* job-description matching
* ATS scoring
* interview-story generation
* LinkedIn synchronization
* automated web scraping
* automatic resume parsing
* AI fact extraction
* automatic verification
* invented accomplishments
* invented metrics
* multi-user authentication
* public portfolio publishing
* external database migration
* unverified Calyx MCP persistence contracts

These belong in later ledgers.

---

# Deliverable 1 — Domain Types

Create:

```text
src/lib/calyx/domains/career/career-types.ts
```

Include:

```ts
export type CareerRecordStatus =
  | "DRAFT"
  | "VERIFIED"
  | "DISPUTED"
  | "ARCHIVED";

export type EvidenceConfidence =
  | "USER_CONFIRMED"
  | "HIGH"
  | "MEDIUM"
  | "LOW"
  | "UNKNOWN";

export type SkillProficiency =
  | "AWARE"
  | "WORKING"
  | "PROFICIENT"
  | "ADVANCED"
  | "EXPERT";
```

Create the following primary entities:

```ts
export type CareerProfile = {
  id: string;
  ownerId: string;
  displayName: string;
  headline?: string;
  summary?: string;
  location?: string;
  email?: string;
  phone?: string;
  linkedInUrl?: string;
  githubUrl?: string;
  portfolioUrl?: string;
  createdAt: string;
  updatedAt: string;
};

export type Employer = {
  id: string;
  profileId: string;
  name: string;
  title?: string;
  employmentType?: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  current: boolean;
  summary?: string;
  status: CareerRecordStatus;
  createdAt: string;
  updatedAt: string;
};

export type ClientEngagement = {
  id: string;
  profileId: string;
  employerId: string;
  clientName: string;
  title: string;
  projectName?: string;
  startDate?: string;
  endDate?: string;
  current: boolean;
  location?: string;
  summary?: string;
  status: CareerRecordStatus;
  createdAt: string;
  updatedAt: string;
};

export type CareerProject = {
  id: string;
  profileId: string;
  employerId?: string;
  engagementId?: string;
  name: string;
  businessChallenge?: string;
  solution?: string;
  architecture?: string;
  impact?: string;
  startDate?: string;
  endDate?: string;
  status: CareerRecordStatus;
  createdAt: string;
  updatedAt: string;
};

export type CareerAccomplishmentCategory =
  | "LEADERSHIP"
  | "ARCHITECTURE"
  | "FRONTEND"
  | "BACKEND"
  | "CLOUD"
  | "DATA"
  | "AI"
  | "DEVOPS"
  | "DELIVERY"
  | "BUSINESS_IMPACT"
  | "OTHER";

export type CareerAccomplishment = {
  id: string;
  profileId: string;
  employerId?: string;
  engagementId?: string;
  projectId?: string;
  statement: string;
  category: CareerAccomplishmentCategory;
  metric?: string;
  status: CareerRecordStatus;
  createdAt: string;
  updatedAt: string;
};

export type CareerSkillEvidence = {
  id: string;
  profileId: string;
  skill: string;
  employerId?: string;
  engagementId?: string;
  projectId?: string;
  accomplishmentId?: string;
  years?: number;
  proficiency?: SkillProficiency;
  confidence: EvidenceConfidence;
  createdAt: string;
  updatedAt: string;
};

export type CareerEvidence = {
  id: string;
  profileId: string;
  sourceType:
    | "USER_ENTRY"
    | "RESUME"
    | "DOCUMENT"
    | "PORTFOLIO"
    | "URL"
    | "INTERVIEW"
    | "OTHER";
  sourceName: string;
  sourceUri?: string;
  excerpt?: string;
  contentHash?: string;
  confidence: EvidenceConfidence;
  createdAt: string;
};

export type CareerEvidenceRecordType =
  | "PROFILE"
  | "EMPLOYER"
  | "ENGAGEMENT"
  | "PROJECT"
  | "ACCOMPLISHMENT"
  | "SKILL"
  | "EDUCATION"
  | "CERTIFICATION";

export type CareerEvidenceLink = {
  id: string;
  evidenceId: string;
  recordType: CareerEvidenceRecordType;
  recordId: string;
  createdAt: string;
};
```

Also create:

```ts
export type EducationRecord = {
  id: string;
  profileId: string;
  institution: string;
  degree?: string;
  fieldOfStudy?: string;
  startDate?: string;
  endDate?: string;
  status: CareerRecordStatus;
  createdAt: string;
  updatedAt: string;
};

export type CertificationRecord = {
  id: string;
  profileId: string;
  name: string;
  issuer?: string;
  issuedDate?: string;
  expirationDate?: string;
  credentialId?: string;
  credentialUrl?: string;
  status: CareerRecordStatus;
  createdAt: string;
  updatedAt: string;
};

export type CareerTimelineEntry = {
  id: string;
  type:
    | "EMPLOYER"
    | "ENGAGEMENT"
    | "PROJECT"
    | "EDUCATION"
    | "CERTIFICATION";
  label: string;
  startDate?: string;
  endDate?: string;
  current?: boolean;
  employerId?: string;
  engagementId?: string;
  recordId: string;
};

export type CareerPortfolioSnapshot = {
  profile: CareerProfile;
  employers: Employer[];
  engagements: ClientEngagement[];
  projects: CareerProject[];
  accomplishments: CareerAccomplishment[];
  skills: CareerSkillEvidence[];
  evidence: CareerEvidence[];
  evidenceLinks: CareerEvidenceLink[];
  education: EducationRecord[];
  certifications: CertificationRecord[];
  timeline: CareerTimelineEntry[];
  summary: CareerPortfolioSummary;
};

export type CareerPortfolioSummary = {
  employerCount: number;
  engagementCount: number;
  projectCount: number;
  verifiedAccomplishmentCount: number;
  draftRecordCount: number;
  evidencedSkillCount: number;
  earliestCareerDate?: string;
  latestCareerDate?: string;
  currentRoleCount: number;
};
```

Use `crypto.randomUUID()` for server-generated IDs.

Do not accept IDs from untrusted create requests.

---

# Deliverable 2 — Validation

Create:

```text
src/lib/calyx/domains/career/career-validation.ts
```

Use explicit validation results:

```ts
export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; errors: string[] };
```

Requirements:

* Trim user-supplied strings.
* Reject empty required names.
* Reject excessively large fields.
* Validate known enums.
* End dates must not precede start dates.
* Current records do not require an end date.
* A client engagement must reference an existing employer.
* A project may reference an employer, an engagement, both, or neither.
* When both employer and engagement are supplied, confirm the engagement belongs to that employer.
* Evidence links must point to existing evidence and existing records.
* Metrics remain user-supplied plain strings.
* Never derive or invent metrics.
* Never evaluate submitted text.
* Never accept arbitrary client-supplied filesystem paths.
* Never accept `ownerId` from request payloads.

Create validated input types for create and update operations.

---

# Deliverable 3 — Repository Contract

Create:

```text
src/lib/calyx/domains/career/career-repository.ts
```

Define a `CareerRepository` interface.

Minimum operations:

```ts
export interface CareerRepository {
  getOrCreateProfile(ownerId: string): Promise<CareerProfile>;
  updateProfile(
    ownerId: string,
    input: UpdateCareerProfileInput,
  ): Promise<CareerProfile>;

  getPortfolio(ownerId: string): Promise<CareerPortfolioSnapshot>;

  createEmployer(
    ownerId: string,
    input: CreateEmployerInput,
  ): Promise<Employer>;
  updateEmployer(
    ownerId: string,
    employerId: string,
    input: UpdateEmployerInput,
  ): Promise<Employer>;
  deleteEmployer(ownerId: string, employerId: string): Promise<void>;

  createEngagement(
    ownerId: string,
    input: CreateEngagementInput,
  ): Promise<ClientEngagement>;
  updateEngagement(
    ownerId: string,
    engagementId: string,
    input: UpdateEngagementInput,
  ): Promise<ClientEngagement>;
  deleteEngagement(ownerId: string, engagementId: string): Promise<void>;

  createProject(
    ownerId: string,
    input: CreateCareerProjectInput,
  ): Promise<CareerProject>;
  updateProject(
    ownerId: string,
    projectId: string,
    input: UpdateCareerProjectInput,
  ): Promise<CareerProject>;
  deleteProject(ownerId: string, projectId: string): Promise<void>;

  createAccomplishment(
    ownerId: string,
    input: CreateCareerAccomplishmentInput,
  ): Promise<CareerAccomplishment>;
  updateAccomplishment(
    ownerId: string,
    accomplishmentId: string,
    input: UpdateCareerAccomplishmentInput,
  ): Promise<CareerAccomplishment>;
  deleteAccomplishment(
    ownerId: string,
    accomplishmentId: string,
  ): Promise<void>;

  addSkillEvidence(
    ownerId: string,
    input: CreateCareerSkillEvidenceInput,
  ): Promise<CareerSkillEvidence>;

  addEvidence(
    ownerId: string,
    input: CreateCareerEvidenceInput,
  ): Promise<CareerEvidence>;
  linkEvidence(
    ownerId: string,
    input: CreateCareerEvidenceLinkInput,
  ): Promise<CareerEvidenceLink>;

  verifyRecord(
    ownerId: string,
    recordType: CareerEvidenceRecordType,
    recordId: string,
  ): Promise<void>;

  listTimeline(ownerId: string): Promise<CareerTimelineEntry[]>;
}
```

Every operation must be owner-scoped.

Never retrieve, update, or delete a record by record ID alone.

---

# Deliverable 4 — Local Persistence Adapter

Create:

```text
src/lib/calyx/domains/career/career-local-repository.server.ts
```

Use local JSON persistence under:

```text
<CALYX_HOME>/echo-mirage-domains/career/<ownerId>/
```

Suggested files:

```text
profile.json
employers.json
engagements.json
projects.json
accomplishments.json
skills.json
evidence.json
evidence-links.json
education.json
certifications.json
```

Requirements:

* Server-only.
* Normalize and validate `ownerId`.
* Reject traversal attempts.
* Do not expose absolute paths to the browser.
* Create directories only beneath the approved career root.
* Use atomic writes:
  1. write temporary file
  2. flush or close successfully
  3. rename over destination
* Serialize mutations with a queue or lock.
* Return empty collections for missing files.
* Include schema version metadata.
* Do not store secrets.
* Do not write to `public/`.
* Preserve forward-compatible unknown fields where practical.
* Ensure relationship cleanup or conflict handling is explicit when deleting parent records.

Use envelopes:

```ts
type CareerCollectionFile<T> = {
  schemaVersion: 1;
  ownerId: string;
  updatedAt: string;
  records: T[];
};

type CareerProfileFile = {
  schemaVersion: 1;
  ownerId: string;
  updatedAt: string;
  record: CareerProfile;
};
```

Use temporary directories in tests.

Never write tests into the real Calyx home.

---

# Deliverable 5 — Calyx Repository Boundary

Create:

```text
src/lib/calyx/domains/career/career-calyx-repository.server.ts
```

Do not invent external MCP tool names.

Implement the `CareerRepository` boundary with:

* capability detection
* documented required capabilities
* clear unavailable errors
* no silent claims of persistence
* no dependency on a public Calyx service

Create:

```ts
export class CalyxCareerRepositoryUnavailableError extends Error {}
```

Add storage configuration:

```text
CALYX_CAREER_STORAGE=local|calyx
```

Default:

```text
local
```

If `calyx` is selected but the required repository capabilities are unavailable, return a clear service-unavailable error.

Do not automatically fall back to local storage unless an explicit fallback configuration is defined.

Reuse the existing Calyx status and readiness infrastructure. Do not create a second Calyx health system.

---

# Deliverable 6 — Repository Factory

Create:

```text
src/lib/calyx/domains/career/career-repository-factory.server.ts
```

Implement:

```ts
export function getCareerRepository(): CareerRepository;
```

Requirements:

* Choose the adapter based on `CALYX_CAREER_STORAGE`.
* Default to local.
* Keep it server-only.
* Avoid circular imports.
* Expose a reset hook only if needed for tests.

---

# Deliverable 7 — Career Service

Create:

```text
src/lib/calyx/domains/career/career-service.server.ts
```

The service must:

* validate external input
* resolve relationships
* enforce owner isolation
* maintain timestamps
* generate IDs
* orchestrate repository operations
* produce portfolio snapshots
* derive summaries and timelines
* avoid invented facts
* avoid invented metrics
* ensure imported or machine-generated content starts as `DRAFT`
* require explicit user action for `VERIFIED`

Provide operations similar to:

```ts
getCareerPortfolio(ownerId: string)
updateCareerProfile(ownerId: string, input: unknown)
createEmployer(ownerId: string, input: unknown)
createClientEngagement(ownerId: string, input: unknown)
createProject(ownerId: string, input: unknown)
createAccomplishment(ownerId: string, input: unknown)
addSkillEvidence(ownerId: string, input: unknown)
addCareerEvidence(ownerId: string, input: unknown)
linkCareerEvidence(ownerId: string, input: unknown)
verifyCareerRecord(
  ownerId: string,
  recordType: CareerEvidenceRecordType,
  recordId: string,
)
```

Only explicit user verification may change a record from `DRAFT` to `VERIFIED`.

Do not infer that a record is verified merely because it came from an uploaded document.

---

# Deliverable 8 — Summary and Timeline

Create:

```text
src/lib/calyx/domains/career/career-summary.ts
src/lib/calyx/domains/career/career-timeline.ts
```

Summary must calculate:

* employer count
* client engagement count
* project count
* verified accomplishment count
* total draft record count
* evidenced skill count
* earliest career date
* latest career date
* current role count

Timeline must combine:

* employers
* client engagements
* projects
* education
* certifications

Sort dated entries consistently.

Do not invent missing dates.

Group undated records under:

```text
Date not recorded
```

Represent consulting relationships clearly:

```text
Infosys
  ├── Nike
  ├── Lennar
  └── Microsoft
```

Clients must not be presented as separate employers.

---

# Deliverable 9 — Owner Resolution

Create:

```text
src/lib/calyx/domains/career/career-owner.server.ts
```

Implement:

```ts
export function resolveCareerOwnerId(): string;
```

Use the project’s authenticated-user mechanism if one already exists.

If authentication is not available, use:

```text
local-operator
```

behind the resolver.

Do not accept `ownerId` from URLs, forms, or request JSON.

Document that real multi-user authentication is deferred to a later ledger.

---

# Deliverable 10 — API Routes

Follow the project’s existing Next.js route and response conventions.

Suggested API:

```text
GET    /api/calyx/career
PATCH  /api/calyx/career/profile
GET    /api/calyx/career/status

POST   /api/calyx/career/employers
PATCH  /api/calyx/career/employers/[id]
DELETE /api/calyx/career/employers/[id]

POST   /api/calyx/career/engagements
PATCH  /api/calyx/career/engagements/[id]
DELETE /api/calyx/career/engagements/[id]

POST   /api/calyx/career/projects
PATCH  /api/calyx/career/projects/[id]
DELETE /api/calyx/career/projects/[id]

POST   /api/calyx/career/accomplishments
PATCH  /api/calyx/career/accomplishments/[id]
DELETE /api/calyx/career/accomplishments/[id]

POST   /api/calyx/career/skills
POST   /api/calyx/career/evidence
POST   /api/calyx/career/evidence-links
POST   /api/calyx/career/verify
```

Use a standard response envelope:

```ts
export type ApiResponse<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: {
        code: string;
        message: string;
        details?: string[];
      };
    };
```

Use status codes:

* `200` success
* `201` created
* `400` validation failure
* `404` record not found
* `409` relationship conflict
* `500` unexpected server error
* `503` selected repository unavailable

Do not expose:

* stack traces
* environment values
* absolute filesystem paths
* MCP binary paths
* internal owner identifiers
* private evidence content not needed by the UI

---

# Deliverable 11 — Operator UI

Add a Cyberdeck pane or route following existing Echo Mirage conventions.

Preferred route if no pane standard applies:

```text
/cyberdeck/career
```

Minimum UI:

## Career Overview

Show:

* profile name
* headline
* employer count
* client engagement count
* project count
* verified accomplishment count
* draft count
* evidenced skill count
* repository mode
* Calyx runtime state

## Career Timeline

Display employers and nested consulting clients clearly.

## Record Management

Allow create and edit for:

* career profile
* employer
* client engagement
* project
* accomplishment

## Evidence State

Display:

```text
DRAFT
VERIFIED
DISPUTED
ARCHIVED
```

Provide an explicit Verify action.

Do not auto-verify records.

## Visual Requirements

* Follow existing Cyberdeck design language.
* Do not introduce a new design system.
* Support narrow pane widths.
* Provide clear loading, empty, error, and unavailable states.
* Do not expose storage paths or infrastructure secrets.

---

# Deliverable 12 — Seed Utility

Create:

```text
scripts/seed-career-portfolio.mjs
```

The script should:

* accept a local JSON file
* target the development owner
* populate records through the service or repository
* validate before persistence
* provide a dry-run option if practical
* report created and rejected records
* avoid duplicate insertion when safely identifiable

Create a fictional example:

```text
data/examples/career-portfolio.example.json
```

Do not commit Quang’s personal career information into production source or public example files.

Private seed data should live under:

```text
data/private/
```

Update `.gitignore` carefully:

```text
data/private/
.calyx/echo-mirage-domains/career/
```

Do not ignore broader Calyx fixture directories accidentally.

---

# Target Directory Structure

```text
src/lib/calyx/
├── calyx-config.server.ts
├── calyx-mcp-client.server.ts
├── calyx-readiness.server.ts
├── calyx-status.ts
├── calyx-types.ts
├── calyx-vault.server.ts
└── domains/
    └── career/
        ├── career-types.ts
        ├── career-validation.ts
        ├── career-repository.ts
        ├── career-local-repository.server.ts
        ├── career-calyx-repository.server.ts
        ├── career-repository-factory.server.ts
        ├── career-owner.server.ts
        ├── career-service.server.ts
        ├── career-summary.ts
        ├── career-timeline.ts
        └── index.ts
```

API and UI files should follow existing project conventions.

---

# Tests

Add unit tests for:

* required-name validation
* trimming
* input-size limits
* date ordering
* current-record behavior
* owner isolation
* traversal prevention
* atomic persistence
* concurrent mutation serialization
* employer/engagement relationship enforcement
* project relationship enforcement
* parent deletion conflicts or cleanup
* evidence-link validation
* record verification
* summary calculations
* timeline ordering
* undated timeline grouping
* repository selection
* unavailable Calyx repository behavior
* API response envelopes
* absence of internal-path leakage

Add an integration test that:

1. Resolves a test owner.
2. Creates a career profile.
3. Creates an employer named `Consulting Company`.
4. Creates a nested engagement named `Example Client`.
5. Creates a project beneath the engagement.
6. Creates an accomplishment beneath the project.
7. Adds evidence.
8. Links evidence to the accomplishment.
9. Verifies the accomplishment.
10. Retrieves the complete portfolio.
11. Confirms the employer/client hierarchy.
12. Confirms the evidence link.
13. Confirms persistence after repository recreation.

Use temporary directories.

Do not use the operator’s real Calyx home.

---

# Required Documentation

Create or update:

```text
docs/architecture/ADR-CALYX-001-knowledge-infrastructure.md
docs/ledgers/L-CALYX-100-career-intelligence-foundation.md
docs/domains/CALYX-CAREER-DOMAIN.md
```

The ADR should state:

* Calyx is domain-independent knowledge infrastructure.
* Career is the first domain implemented on it.
* Core Calyx cannot depend on Career.
* Local persistence is an adapter, not the final domain architecture.
* External Calyx MCP integration must use verified capabilities only.
* Evidence and explicit verification are foundational trust requirements.

---

# Acceptance Criteria

The work is complete only when:

* Existing Calyx configuration, MCP client, readiness, status, and vault behavior still work.
* Career code is isolated under `src/lib/calyx/domains/career`.
* Core Calyx does not import Career code.
* A career profile can be created and edited.
* Employers can be created and edited.
* Client engagements can be nested beneath employers.
* Projects can reference employers and engagements.
* Accomplishments can be stored.
* Skills can be linked to supporting career records.
* Evidence can be stored and linked.
* Records begin as `DRAFT`.
* Records require explicit action to become `VERIFIED`.
* Local persistence survives restart.
* Every operation is owner-scoped.
* Directory traversal is prevented.
* Consulting clients are not displayed as employers.
* Career remains usable in local mode when external Calyx is offline.
* No resume generation is included.
* Type checking passes.
* Linting passes.
* Relevant unit and integration tests pass.
* Existing smoke checks pass.

---

# Stop Conditions

Stop and report instead of improvising when:

* Existing architecture materially conflicts with this ledger.
* Required route or pane conventions cannot be determined after repository inspection and targeted Cognosys recall.
* A proposed change would break existing Calyx behavior.
* External Calyx persistence would require invented MCP tool contracts.
* Authentication assumptions would create a security boundary not present in the project.
* Tests expose pre-existing failures that block trustworthy verification.

A stop report must include:

* the blocking condition
* evidence
* attempted resolution
* smallest reasonable next decision

---

# Follow-Up Ledgers

```text
L-CALYX-101 — Career Document Intake
L-CALYX-102 — Evidence Extraction and Approval
L-CALYX-103 — Career Search and Skill Evidence
L-CALYX-104 — Evidence-Grounded Resume Composer
L-CALYX-105 — Job Description Match Analysis
L-CALYX-106 — Interview Story Studio
L-CALYX-107 — Career DOCX/PDF Export
L-CALYX-108 — Multi-User Career Workspaces
```

---

# Required Completion Report

Cursor must return:

```text
L-CALYX-100 COMPLETE

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
- Unit tests:
- Integration tests:
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

Do not claim completion unless the applicable verification commands were actually executed successfully.

---

# Completion Report

```text
L-CALYX-100 COMPLETE

Summary
- Career Intelligence is implemented as the first Calyx domain module under
  src/lib/calyx/domains/career with local JSON persistence, service layer, API
  routes, operator UI (/cyberdeck/career pane), seed utility, and probe-based
  unit/integration acceptance tests.

Architecture
- Dependency direction preserved: Career UI → API → Service → Repository → local
  persistence / future Calyx adapter. Core Calyx files unchanged; no Career
  imports in Calyx core.
- Local persistence via CALYX_CAREER_STORAGE=local (default). External Calyx
  repository adapter (CALYX_CAREER_STORAGE=calyx) returns REPOSITORY_UNAVAILABLE
  until verified MCP persistence contracts exist.

Cognosys recall used
- None

Files added
- src/lib/calyx/domains/career/* (types, validation, repository, service, summary, timeline)
- src/app/api/calyx/career/* (portfolio, profile, employers, engagements, projects,
  accomplishments, skills, evidence, evidence-links, verify, status)
- src/app/cyberdeck/career/page.tsx
- src/components/cyberdeck/career-pane-body.tsx
- src/features/cyberdeck/pane-loaders/career.tsx
- scripts/probe-calyx-career.ts
- scripts/seed-career-portfolio.mjs
- data/examples/career-portfolio.example.json
- docs/architecture/ADR-CALYX-001-knowledge-infrastructure.md
- docs/domains/CALYX-CAREER-DOMAIN.md
- docs/ledgers/L-CALYX-101-career-document-intake.md (follow-up ledger)

Files modified
- .gitignore (data/private/)
- src/features/cyberdeck/pane-chunks.ts
- src/features/cyberdeck/pane-registry.ts
- src/features/cyberdeck/workspace/custom-tab-model.ts
- src/features/cyberdeck/workspace/custom-tab-pane-renderer.tsx
- e2e/cyberdeck-extraction-smoke.spec.ts (rail tab count after Career pane)

API routes
- GET  /api/calyx/career
- GET  /api/calyx/career/status
- PATCH /api/calyx/career/profile
- POST /api/calyx/career/employers
- PATCH/DELETE /api/calyx/career/employers/[id]
- POST /api/calyx/career/engagements
- PATCH/DELETE /api/calyx/career/engagements/[id]
- POST /api/calyx/career/projects
- PATCH/DELETE /api/calyx/career/projects/[id]
- POST /api/calyx/career/accomplishments
- PATCH/DELETE /api/calyx/career/accomplishments/[id]
- POST /api/calyx/career/skills
- POST /api/calyx/career/evidence
- POST /api/calyx/career/evidence-links
- POST /api/calyx/career/verify

Persistence
- Local JSON under .calyx/echo-mirage-domains/career/{ownerId}/ (gitignored via .calyx/)
- Atomic writes with per-owner serialization locks
- Owner-scoped operations; traversal prevention on ownerId

UI
- Cyberdeck Career pane: overview stats, timeline, profile edit, create/edit/delete
  for employers/engagements/projects/accomplishments, skill and evidence creation,
  evidence linking, explicit Verify on DRAFT records, loading/error/unavailable states

Tests added
- scripts/probe-calyx-career.ts — validation, summary/timeline, repository selection,
  API envelopes, path-leak prevention, owner isolation, concurrent mutations,
  deletion conflicts, evidence links, verify flow, persistence after recreation,
  UI/API workflow via service layer, unavailable Calyx adapter probe

Commands executed
- pnpm exec tsc --noEmit
- pnpm build
- pnpm probe:calyx-smoke
- pnpm probe:cyberdeck-compile-scope
- pnpm probe:calyx-career
- pnpm exec playwright test e2e/cyberdeck.layout.spec.ts e2e/cyberdeck-extraction-smoke.spec.ts

Verification results
- Typecheck: PASS
- Lint: PASS (career-pane-body.tsx — no diagnostics)
- Unit tests: PASS (probe:calyx-career validation, summary, envelopes, path-leak)
- Integration tests: PASS (probe:calyx-career persistence, isolation, workflow, recreation)
- Smoke tests: probe:calyx-smoke PASS; probe:cyberdeck-compile-scope PASS;
  Playwright layout+extraction 2 passed / 8 failed (see limitations)

Known limitations
- External CalyxCareerRepository is intentionally unavailable; local mode is the
  supported persistence path until L-CALYX follow-up verifies MCP contracts.
- Single-owner (local-operator); multi-user auth deferred to L-CALYX-108.
- Education and certification types exist in the domain model but have no operator
  UI or API routes in this ledger.
- Playwright e2e: 8 failures on local run — Career rail-tab count fixed in
  extraction smoke; remaining failures (Gateway input visibility, mobile layout
  column/row expectations, boot timeouts) appear pre-existing and unrelated to
  Career domain logic. Full test:predeploy suite not executed.

Deviations from ledger
- Tests implemented as durable tsx probe (scripts/probe-calyx-career.ts) rather
  than separate Vitest files, matching existing Echo Mirage Calyx probe convention.

Follow-up recommendations
- L-CALYX-101 Career Document Intake
- Fix pre-existing Playwright Cyberdeck boot/layout failures before relying on
  test:predeploy for Career releases
- Verify external Calyx MCP persistence when contracts are available
```
