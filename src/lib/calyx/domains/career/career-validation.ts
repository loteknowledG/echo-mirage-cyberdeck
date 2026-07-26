import type {
  CareerAccomplishmentCategory,
  CareerEvidenceRecordType,
  CareerRecordStatus,
  EvidenceConfidence,
  SkillProficiency,
} from "./career-types";

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; errors: string[] };

const MAX_SHORT = 256;
const MAX_MEDIUM = 2048;
const MAX_LONG = 8192;
const MAX_STATEMENT = 4096;

const RECORD_STATUSES = new Set<CareerRecordStatus>([
  "DRAFT",
  "VERIFIED",
  "DISPUTED",
  "ARCHIVED",
]);

const EVIDENCE_CONFIDENCE = new Set<EvidenceConfidence>([
  "USER_CONFIRMED",
  "HIGH",
  "MEDIUM",
  "LOW",
  "UNKNOWN",
]);

const SKILL_PROFICIENCY = new Set<SkillProficiency>([
  "AWARE",
  "WORKING",
  "PROFICIENT",
  "ADVANCED",
  "EXPERT",
]);

const ACCOMPLISHMENT_CATEGORIES = new Set<CareerAccomplishmentCategory>([
  "LEADERSHIP",
  "ARCHITECTURE",
  "FRONTEND",
  "BACKEND",
  "CLOUD",
  "DATA",
  "AI",
  "DEVOPS",
  "DELIVERY",
  "BUSINESS_IMPACT",
  "OTHER",
]);

const EVIDENCE_SOURCE_TYPES = new Set([
  "USER_ENTRY",
  "RESUME",
  "DOCUMENT",
  "PORTFOLIO",
  "URL",
  "INTERVIEW",
  "OTHER",
] as const);

const EVIDENCE_RECORD_TYPES = new Set<CareerEvidenceRecordType>([
  "PROFILE",
  "EMPLOYER",
  "ENGAGEMENT",
  "PROJECT",
  "ACCOMPLISHMENT",
  "SKILL",
  "EDUCATION",
  "CERTIFICATION",
]);

function trimOptional(value: unknown, max: number): string | undefined {
  if (value == null) return undefined;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > max) return undefined;
  return trimmed;
}

function requireString(
  value: unknown,
  field: string,
  max: number,
  errors: string[],
): string | null {
  if (typeof value !== "string") {
    errors.push(`${field} must be a string`);
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    errors.push(`${field} is required`);
    return null;
  }
  if (trimmed.length > max) {
    errors.push(`${field} exceeds maximum length of ${max}`);
    return null;
  }
  return trimmed;
}

function optionalString(
  value: unknown,
  field: string,
  max: number,
  errors: string[],
): string | undefined {
  if (value == null || value === "") return undefined;
  if (typeof value !== "string") {
    errors.push(`${field} must be a string`);
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > max) {
    errors.push(`${field} exceeds maximum length of ${max}`);
    return undefined;
  }
  return trimmed;
}

function optionalBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  return fallback;
}

function optionalNumber(value: unknown, field: string, errors: string[]): number | undefined {
  if (value == null || value === "") return undefined;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    errors.push(`${field} must be a non-negative number`);
    return undefined;
  }
  return value;
}

function validateDatePair(
  startDate: string | undefined,
  endDate: string | undefined,
  current: boolean,
  errors: string[],
  label: string,
): void {
  if (current && endDate) {
    errors.push(`${label}: current records must not include an end date`);
  }
  if (startDate && endDate && endDate < startDate) {
    errors.push(`${label}: end date must not precede start date`);
  }
}

function rejectOwnerId(payload: Record<string, unknown>, errors: string[]): void {
  if ("ownerId" in payload) {
    errors.push("ownerId must not be supplied in request payloads");
  }
}

function rejectId(payload: Record<string, unknown>, errors: string[]): void {
  if ("id" in payload) {
    errors.push("id must not be supplied in create payloads");
  }
}

export type UpdateCareerProfileInput = {
  displayName?: string;
  headline?: string;
  summary?: string;
  location?: string;
  email?: string;
  phone?: string;
  linkedInUrl?: string;
  githubUrl?: string;
  portfolioUrl?: string;
};

export type CreateEmployerInput = {
  name: string;
  title?: string;
  employmentType?: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  current: boolean;
  summary?: string;
};

export type UpdateEmployerInput = Partial<CreateEmployerInput>;

export type CreateEngagementInput = {
  employerId: string;
  clientName: string;
  title: string;
  projectName?: string;
  startDate?: string;
  endDate?: string;
  current: boolean;
  location?: string;
  summary?: string;
};

export type UpdateEngagementInput = Partial<
  CreateEngagementInput & { employerId: string }
>;

export type CreateCareerProjectInput = {
  name: string;
  employerId?: string;
  engagementId?: string;
  businessChallenge?: string;
  solution?: string;
  architecture?: string;
  impact?: string;
  startDate?: string;
  endDate?: string;
};

export type UpdateCareerProjectInput = Partial<CreateCareerProjectInput>;

export type CreateCareerAccomplishmentInput = {
  statement: string;
  category: CareerAccomplishmentCategory;
  employerId?: string;
  engagementId?: string;
  projectId?: string;
  metric?: string;
};

export type UpdateCareerAccomplishmentInput = Partial<CreateCareerAccomplishmentInput>;

export type CreateCareerSkillEvidenceInput = {
  skill: string;
  employerId?: string;
  engagementId?: string;
  projectId?: string;
  accomplishmentId?: string;
  years?: number;
  proficiency?: SkillProficiency;
  confidence: EvidenceConfidence;
};

export type CreateCareerEvidenceInput = {
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
};

export type CreateCareerEvidenceLinkInput = {
  evidenceId: string;
  recordType: CareerEvidenceRecordType;
  recordId: string;
};

export function validateUpdateCareerProfile(
  input: unknown,
): ValidationResult<UpdateCareerProfileInput> {
  if (!input || typeof input !== "object") {
    return { ok: false, errors: ["Profile update payload must be an object"] };
  }
  const payload = input as Record<string, unknown>;
  const errors: string[] = [];
  rejectOwnerId(payload, errors);

  const value: UpdateCareerProfileInput = {
    displayName: optionalString(payload.displayName, "displayName", MAX_SHORT, errors),
    headline: optionalString(payload.headline, "headline", MAX_MEDIUM, errors),
    summary: optionalString(payload.summary, "summary", MAX_LONG, errors),
    location: optionalString(payload.location, "location", MAX_SHORT, errors),
    email: optionalString(payload.email, "email", MAX_SHORT, errors),
    phone: optionalString(payload.phone, "phone", MAX_SHORT, errors),
    linkedInUrl: optionalString(payload.linkedInUrl, "linkedInUrl", MAX_MEDIUM, errors),
    githubUrl: optionalString(payload.githubUrl, "githubUrl", MAX_MEDIUM, errors),
    portfolioUrl: optionalString(payload.portfolioUrl, "portfolioUrl", MAX_MEDIUM, errors),
  };

  if (
    !value.displayName &&
    !value.headline &&
    !value.summary &&
    !value.location &&
    !value.email &&
    !value.phone &&
    !value.linkedInUrl &&
    !value.githubUrl &&
    !value.portfolioUrl
  ) {
    errors.push("At least one profile field must be provided");
  }

  return errors.length ? { ok: false, errors } : { ok: true, value };
}

export function validateCreateEmployer(input: unknown): ValidationResult<CreateEmployerInput> {
  if (!input || typeof input !== "object") {
    return { ok: false, errors: ["Employer payload must be an object"] };
  }
  const payload = input as Record<string, unknown>;
  const errors: string[] = [];
  rejectOwnerId(payload, errors);
  rejectId(payload, errors);

  const name = requireString(payload.name, "name", MAX_SHORT, errors);
  const current = optionalBoolean(payload.current, false);
  const startDate = optionalString(payload.startDate, "startDate", 32, errors);
  const endDate = optionalString(payload.endDate, "endDate", 32, errors);
  validateDatePair(startDate, endDate, current, errors, "Employer");

  if (errors.length || !name) return { ok: false, errors };

  return {
    ok: true,
    value: {
      name,
      title: optionalString(payload.title, "title", MAX_MEDIUM, errors),
      employmentType: optionalString(payload.employmentType, "employmentType", MAX_SHORT, errors),
      location: optionalString(payload.location, "location", MAX_SHORT, errors),
      startDate,
      endDate: current ? undefined : endDate,
      current,
      summary: optionalString(payload.summary, "summary", MAX_LONG, errors),
    },
  };
}

export function validateUpdateEmployer(input: unknown): ValidationResult<UpdateEmployerInput> {
  if (!input || typeof input !== "object") {
    return { ok: false, errors: ["Employer update payload must be an object"] };
  }
  const payload = input as Record<string, unknown>;
  const errors: string[] = [];
  rejectOwnerId(payload, errors);
  rejectId(payload, errors);

  const current =
    payload.current !== undefined ? optionalBoolean(payload.current, false) : undefined;
  const startDate = optionalString(payload.startDate, "startDate", 32, errors);
  const endDate = optionalString(payload.endDate, "endDate", 32, errors);
  if (current !== undefined || startDate !== undefined || endDate !== undefined) {
    validateDatePair(startDate, endDate, current ?? false, errors, "Employer");
  }

  const value: UpdateEmployerInput = {};
  if (payload.name !== undefined) {
    const name = requireString(payload.name, "name", MAX_SHORT, errors);
    if (name) value.name = name;
  }
  if (payload.title !== undefined) value.title = trimOptional(payload.title, MAX_MEDIUM);
  if (payload.employmentType !== undefined) {
    value.employmentType = trimOptional(payload.employmentType, MAX_SHORT);
  }
  if (payload.location !== undefined) value.location = trimOptional(payload.location, MAX_SHORT);
  if (payload.startDate !== undefined) value.startDate = startDate;
  if (payload.endDate !== undefined) value.endDate = current ? undefined : endDate;
  if (payload.current !== undefined) value.current = current;
  if (payload.summary !== undefined) value.summary = trimOptional(payload.summary, MAX_LONG);

  if (Object.keys(value).length === 0) {
    errors.push("At least one employer field must be provided");
  }

  return errors.length ? { ok: false, errors } : { ok: true, value };
}

export function validateCreateEngagement(
  input: unknown,
): ValidationResult<CreateEngagementInput> {
  if (!input || typeof input !== "object") {
    return { ok: false, errors: ["Engagement payload must be an object"] };
  }
  const payload = input as Record<string, unknown>;
  const errors: string[] = [];
  rejectOwnerId(payload, errors);
  rejectId(payload, errors);

  const employerId = requireString(payload.employerId, "employerId", MAX_SHORT, errors);
  const clientName = requireString(payload.clientName, "clientName", MAX_SHORT, errors);
  const title = requireString(payload.title, "title", MAX_MEDIUM, errors);
  const current = optionalBoolean(payload.current, false);
  const startDate = optionalString(payload.startDate, "startDate", 32, errors);
  const endDate = optionalString(payload.endDate, "endDate", 32, errors);
  validateDatePair(startDate, endDate, current, errors, "Engagement");

  if (errors.length || !employerId || !clientName || !title) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      employerId,
      clientName,
      title,
      projectName: optionalString(payload.projectName, "projectName", MAX_MEDIUM, errors),
      startDate,
      endDate: current ? undefined : endDate,
      current,
      location: optionalString(payload.location, "location", MAX_SHORT, errors),
      summary: optionalString(payload.summary, "summary", MAX_LONG, errors),
    },
  };
}

export function validateUpdateEngagement(
  input: unknown,
): ValidationResult<UpdateEngagementInput> {
  if (!input || typeof input !== "object") {
    return { ok: false, errors: ["Engagement update payload must be an object"] };
  }
  const payload = input as Record<string, unknown>;
  const errors: string[] = [];
  rejectOwnerId(payload, errors);
  rejectId(payload, errors);

  const value: UpdateEngagementInput = {};
  if (payload.employerId !== undefined) {
    const employerId = requireString(payload.employerId, "employerId", MAX_SHORT, errors);
    if (employerId) value.employerId = employerId;
  }
  if (payload.clientName !== undefined) {
    const clientName = requireString(payload.clientName, "clientName", MAX_SHORT, errors);
    if (clientName) value.clientName = clientName;
  }
  if (payload.title !== undefined) {
    const title = requireString(payload.title, "title", MAX_MEDIUM, errors);
    if (title) value.title = title;
  }
  if (payload.projectName !== undefined) {
    value.projectName = trimOptional(payload.projectName, MAX_MEDIUM);
  }
  if (payload.location !== undefined) value.location = trimOptional(payload.location, MAX_SHORT);
  if (payload.summary !== undefined) value.summary = trimOptional(payload.summary, MAX_LONG);
  if (payload.startDate !== undefined) {
    value.startDate = optionalString(payload.startDate, "startDate", 32, errors);
  }
  const current =
    payload.current !== undefined ? optionalBoolean(payload.current, false) : undefined;
  if (payload.endDate !== undefined) {
    value.endDate = optionalString(payload.endDate, "endDate", 32, errors);
  }
  if (current !== undefined) value.current = current;
  if (current && value.endDate) value.endDate = undefined;

  if (value.startDate !== undefined || value.endDate !== undefined || current !== undefined) {
    validateDatePair(value.startDate, value.endDate, current ?? false, errors, "Engagement");
  }

  if (Object.keys(value).length === 0) {
    errors.push("At least one engagement field must be provided");
  }

  return errors.length ? { ok: false, errors } : { ok: true, value };
}

export function validateCreateProject(
  input: unknown,
): ValidationResult<CreateCareerProjectInput> {
  if (!input || typeof input !== "object") {
    return { ok: false, errors: ["Project payload must be an object"] };
  }
  const payload = input as Record<string, unknown>;
  const errors: string[] = [];
  rejectOwnerId(payload, errors);
  rejectId(payload, errors);

  const name = requireString(payload.name, "name", MAX_MEDIUM, errors);
  const startDate = optionalString(payload.startDate, "startDate", 32, errors);
  const endDate = optionalString(payload.endDate, "endDate", 32, errors);
  validateDatePair(startDate, endDate, false, errors, "Project");

  if (errors.length || !name) return { ok: false, errors };

  return {
    ok: true,
    value: {
      name,
      employerId: optionalString(payload.employerId, "employerId", MAX_SHORT, errors),
      engagementId: optionalString(payload.engagementId, "engagementId", MAX_SHORT, errors),
      businessChallenge: optionalString(
        payload.businessChallenge,
        "businessChallenge",
        MAX_LONG,
        errors,
      ),
      solution: optionalString(payload.solution, "solution", MAX_LONG, errors),
      architecture: optionalString(payload.architecture, "architecture", MAX_LONG, errors),
      impact: optionalString(payload.impact, "impact", MAX_LONG, errors),
      startDate,
      endDate,
    },
  };
}

export function validateUpdateProject(
  input: unknown,
): ValidationResult<UpdateCareerProjectInput> {
  if (!input || typeof input !== "object") {
    return { ok: false, errors: ["Project update payload must be an object"] };
  }
  const payload = input as Record<string, unknown>;
  const errors: string[] = [];
  rejectOwnerId(payload, errors);
  rejectId(payload, errors);

  const value: UpdateCareerProjectInput = {};
  if (payload.name !== undefined) {
    const name = requireString(payload.name, "name", MAX_MEDIUM, errors);
    if (name) value.name = name;
  }
  if (payload.employerId !== undefined) {
    value.employerId = trimOptional(payload.employerId, MAX_SHORT);
  }
  if (payload.engagementId !== undefined) {
    value.engagementId = trimOptional(payload.engagementId, MAX_SHORT);
  }
  if (payload.businessChallenge !== undefined) {
    value.businessChallenge = trimOptional(payload.businessChallenge, MAX_LONG);
  }
  if (payload.solution !== undefined) value.solution = trimOptional(payload.solution, MAX_LONG);
  if (payload.architecture !== undefined) {
    value.architecture = trimOptional(payload.architecture, MAX_LONG);
  }
  if (payload.impact !== undefined) value.impact = trimOptional(payload.impact, MAX_LONG);
  if (payload.startDate !== undefined) {
    value.startDate = optionalString(payload.startDate, "startDate", 32, errors);
  }
  if (payload.endDate !== undefined) {
    value.endDate = optionalString(payload.endDate, "endDate", 32, errors);
  }
  if (value.startDate !== undefined || value.endDate !== undefined) {
    validateDatePair(value.startDate, value.endDate, false, errors, "Project");
  }

  if (Object.keys(value).length === 0) {
    errors.push("At least one project field must be provided");
  }

  return errors.length ? { ok: false, errors } : { ok: true, value };
}

export function validateCreateAccomplishment(
  input: unknown,
): ValidationResult<CreateCareerAccomplishmentInput> {
  if (!input || typeof input !== "object") {
    return { ok: false, errors: ["Accomplishment payload must be an object"] };
  }
  const payload = input as Record<string, unknown>;
  const errors: string[] = [];
  rejectOwnerId(payload, errors);
  rejectId(payload, errors);

  const statement = requireString(payload.statement, "statement", MAX_STATEMENT, errors);
  const categoryRaw = payload.category;
  if (typeof categoryRaw !== "string" || !ACCOMPLISHMENT_CATEGORIES.has(categoryRaw as CareerAccomplishmentCategory)) {
    errors.push("category must be a valid accomplishment category");
  }

  if (errors.length || !statement) return { ok: false, errors };

  return {
    ok: true,
    value: {
      statement,
      category: categoryRaw as CareerAccomplishmentCategory,
      employerId: optionalString(payload.employerId, "employerId", MAX_SHORT, errors),
      engagementId: optionalString(payload.engagementId, "engagementId", MAX_SHORT, errors),
      projectId: optionalString(payload.projectId, "projectId", MAX_SHORT, errors),
      metric: optionalString(payload.metric, "metric", MAX_MEDIUM, errors),
    },
  };
}

export function validateUpdateAccomplishment(
  input: unknown,
): ValidationResult<UpdateCareerAccomplishmentInput> {
  if (!input || typeof input !== "object") {
    return { ok: false, errors: ["Accomplishment update payload must be an object"] };
  }
  const payload = input as Record<string, unknown>;
  const errors: string[] = [];
  rejectOwnerId(payload, errors);
  rejectId(payload, errors);

  const value: UpdateCareerAccomplishmentInput = {};
  if (payload.statement !== undefined) {
    const statement = requireString(payload.statement, "statement", MAX_STATEMENT, errors);
    if (statement) value.statement = statement;
  }
  if (payload.category !== undefined) {
    if (
      typeof payload.category !== "string" ||
      !ACCOMPLISHMENT_CATEGORIES.has(payload.category as CareerAccomplishmentCategory)
    ) {
      errors.push("category must be a valid accomplishment category");
    } else {
      value.category = payload.category as CareerAccomplishmentCategory;
    }
  }
  if (payload.employerId !== undefined) {
    value.employerId = trimOptional(payload.employerId, MAX_SHORT);
  }
  if (payload.engagementId !== undefined) {
    value.engagementId = trimOptional(payload.engagementId, MAX_SHORT);
  }
  if (payload.projectId !== undefined) value.projectId = trimOptional(payload.projectId, MAX_SHORT);
  if (payload.metric !== undefined) value.metric = trimOptional(payload.metric, MAX_MEDIUM);

  if (Object.keys(value).length === 0) {
    errors.push("At least one accomplishment field must be provided");
  }

  return errors.length ? { ok: false, errors } : { ok: true, value };
}

export function validateCreateSkillEvidence(
  input: unknown,
): ValidationResult<CreateCareerSkillEvidenceInput> {
  if (!input || typeof input !== "object") {
    return { ok: false, errors: ["Skill evidence payload must be an object"] };
  }
  const payload = input as Record<string, unknown>;
  const errors: string[] = [];
  rejectOwnerId(payload, errors);
  rejectId(payload, errors);

  const skill = requireString(payload.skill, "skill", MAX_SHORT, errors);
  const confidenceRaw = payload.confidence;
  if (
    typeof confidenceRaw !== "string" ||
    !EVIDENCE_CONFIDENCE.has(confidenceRaw as EvidenceConfidence)
  ) {
    errors.push("confidence must be a valid evidence confidence level");
  }
  const proficiencyRaw = payload.proficiency;
  if (
    proficiencyRaw !== undefined &&
    (typeof proficiencyRaw !== "string" ||
      !SKILL_PROFICIENCY.has(proficiencyRaw as SkillProficiency))
  ) {
    errors.push("proficiency must be a valid skill proficiency level");
  }

  if (errors.length || !skill) return { ok: false, errors };

  return {
    ok: true,
    value: {
      skill,
      employerId: optionalString(payload.employerId, "employerId", MAX_SHORT, errors),
      engagementId: optionalString(payload.engagementId, "engagementId", MAX_SHORT, errors),
      projectId: optionalString(payload.projectId, "projectId", MAX_SHORT, errors),
      accomplishmentId: optionalString(
        payload.accomplishmentId,
        "accomplishmentId",
        MAX_SHORT,
        errors,
      ),
      years: optionalNumber(payload.years, "years", errors),
      proficiency: proficiencyRaw as SkillProficiency | undefined,
      confidence: confidenceRaw as EvidenceConfidence,
    },
  };
}

export function validateCreateEvidence(
  input: unknown,
): ValidationResult<CreateCareerEvidenceInput> {
  if (!input || typeof input !== "object") {
    return { ok: false, errors: ["Evidence payload must be an object"] };
  }
  const payload = input as Record<string, unknown>;
  const errors: string[] = [];
  rejectOwnerId(payload, errors);
  rejectId(payload, errors);

  const sourceName = requireString(payload.sourceName, "sourceName", MAX_MEDIUM, errors);
  const sourceTypeRaw = payload.sourceType;
  if (
    typeof sourceTypeRaw !== "string" ||
    !EVIDENCE_SOURCE_TYPES.has(sourceTypeRaw as CreateCareerEvidenceInput["sourceType"])
  ) {
    errors.push("sourceType must be a valid evidence source type");
  }
  const confidenceRaw = payload.confidence;
  if (
    typeof confidenceRaw !== "string" ||
    !EVIDENCE_CONFIDENCE.has(confidenceRaw as EvidenceConfidence)
  ) {
    errors.push("confidence must be a valid evidence confidence level");
  }

  const sourceUri = optionalString(payload.sourceUri, "sourceUri", MAX_MEDIUM, errors);
  if (sourceUri && (sourceUri.startsWith("/") || /^[a-zA-Z]:\\/.test(sourceUri))) {
    errors.push("sourceUri must not be a filesystem path");
  }

  if (errors.length || !sourceName) return { ok: false, errors };

  return {
    ok: true,
    value: {
      sourceType: sourceTypeRaw as CreateCareerEvidenceInput["sourceType"],
      sourceName,
      sourceUri,
      excerpt: optionalString(payload.excerpt, "excerpt", MAX_LONG, errors),
      contentHash: optionalString(payload.contentHash, "contentHash", MAX_SHORT, errors),
      confidence: confidenceRaw as EvidenceConfidence,
    },
  };
}

export function validateCreateEvidenceLink(
  input: unknown,
): ValidationResult<CreateCareerEvidenceLinkInput> {
  if (!input || typeof input !== "object") {
    return { ok: false, errors: ["Evidence link payload must be an object"] };
  }
  const payload = input as Record<string, unknown>;
  const errors: string[] = [];
  rejectOwnerId(payload, errors);
  rejectId(payload, errors);

  const evidenceId = requireString(payload.evidenceId, "evidenceId", MAX_SHORT, errors);
  const recordId = requireString(payload.recordId, "recordId", MAX_SHORT, errors);
  const recordTypeRaw = payload.recordType;
  if (
    typeof recordTypeRaw !== "string" ||
    !EVIDENCE_RECORD_TYPES.has(recordTypeRaw as CareerEvidenceRecordType)
  ) {
    errors.push("recordType must be a valid evidence record type");
  }

  if (errors.length || !evidenceId || !recordId) return { ok: false, errors };

  return {
    ok: true,
    value: {
      evidenceId,
      recordType: recordTypeRaw as CareerEvidenceRecordType,
      recordId,
    },
  };
}

export function validateVerifyRecord(input: unknown): ValidationResult<{
  recordType: CareerEvidenceRecordType;
  recordId: string;
}> {
  if (!input || typeof input !== "object") {
    return { ok: false, errors: ["Verify payload must be an object"] };
  }
  const payload = input as Record<string, unknown>;
  const errors: string[] = [];
  rejectOwnerId(payload, errors);

  const recordId = requireString(payload.recordId, "recordId", MAX_SHORT, errors);
  const recordTypeRaw = payload.recordType;
  if (
    typeof recordTypeRaw !== "string" ||
    !EVIDENCE_RECORD_TYPES.has(recordTypeRaw as CareerEvidenceRecordType)
  ) {
    errors.push("recordType must be a valid evidence record type");
  }

  if (errors.length || !recordId) return { ok: false, errors };

  return {
    ok: true,
    value: {
      recordType: recordTypeRaw as CareerEvidenceRecordType,
      recordId,
    },
  };
}

export function validateOwnerId(ownerId: string): ValidationResult<string> {
  const trimmed = ownerId.trim();
  const errors: string[] = [];
  if (!trimmed) errors.push("ownerId is required");
  if (trimmed.includes("..")) errors.push("ownerId must not contain '..'");
  if (/[/\\]/.test(trimmed)) errors.push("ownerId must not contain path separators");
  if (trimmed.length > 128) errors.push("ownerId exceeds maximum length");
  return errors.length ? { ok: false, errors } : { ok: true, value: trimmed };
}

export { RECORD_STATUSES, EVIDENCE_CONFIDENCE, SKILL_PROFICIENCY };
