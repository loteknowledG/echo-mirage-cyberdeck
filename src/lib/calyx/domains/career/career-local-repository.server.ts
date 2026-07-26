import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import type {
  CareerAccomplishment,
  CareerCollectionFile,
  CareerEvidence,
  CareerEvidenceLink,
  CareerEvidenceRecordType,
  CareerPortfolioSnapshot,
  CareerProfile,
  CareerProfileFile,
  CareerProject,
  CertificationRecord,
  ClientEngagement,
  EducationRecord,
  Employer,
  CareerSkillEvidence,
  CareerTimelineEntry,
} from "./career-types";
import {
  CareerConflictError,
  CareerNotFoundError,
  type CareerRepository,
} from "./career-repository";
import { assemblePortfolioSnapshot } from "./career-summary";
import { buildCareerTimeline } from "./career-timeline";
import { assertSafeOwnerId, resolveOwnerCareerDir } from "./career-paths.server";
import type {
  CreateCareerAccomplishmentInput,
  CreateCareerEvidenceInput,
  CreateCareerEvidenceLinkInput,
  CreateCareerProjectInput,
  CreateCareerSkillEvidenceInput,
  CreateEmployerInput,
  CreateEngagementInput,
  UpdateCareerAccomplishmentInput,
  UpdateCareerProfileInput,
  UpdateCareerProjectInput,
  UpdateEmployerInput,
  UpdateEngagementInput,
} from "./career-validation";

const FILE_NAMES = {
  profile: "profile.json",
  employers: "employers.json",
  engagements: "engagements.json",
  projects: "projects.json",
  accomplishments: "accomplishments.json",
  skills: "skills.json",
  evidence: "evidence.json",
  evidenceLinks: "evidence-links.json",
  education: "education.json",
  certifications: "certifications.json",
} as const;

type CollectionKey = Exclude<keyof typeof FILE_NAMES, "profile">;

const ownerLocks = new Map<string, Promise<void>>();

async function withOwnerLock<T>(ownerId: string, fn: () => Promise<T>): Promise<T> {
  const safeOwnerId = assertSafeOwnerId(ownerId);
  const previous = ownerLocks.get(safeOwnerId) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  ownerLocks.set(
    safeOwnerId,
    previous.then(() => gate),
  );
  await previous;
  try {
    return await fn();
  } finally {
    release();
  }
}

async function atomicWriteJson(filePath: string, data: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tmpPath = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${randomUUID()}.tmp`,
  );
  await fs.writeFile(tmpPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  await fs.rename(tmpPath, filePath);
}

function nowIso(): string {
  return new Date().toISOString();
}

function emptyCollection<T>(ownerId: string): CareerCollectionFile<T> {
  return {
    schemaVersion: 1,
    ownerId,
    updatedAt: nowIso(),
    records: [],
  };
}

export class LocalCareerRepository implements CareerRepository {
  constructor(private readonly careerRootOverride?: string) {}

  private ownerDir(ownerId: string): string {
    if (this.careerRootOverride) {
      const safeOwnerId = assertSafeOwnerId(ownerId);
      const root = path.resolve(this.careerRootOverride);
      const ownerDir = path.resolve(root, safeOwnerId);
      if (ownerDir !== root && !ownerDir.startsWith(`${root}${path.sep}`)) {
        throw new Error("Invalid owner directory");
      }
      return ownerDir;
    }
    return resolveOwnerCareerDir(ownerId);
  }

  private filePath(ownerId: string, key: keyof typeof FILE_NAMES): string {
    return path.join(this.ownerDir(ownerId), FILE_NAMES[key]);
  }

  private async readCollection<T>(
    ownerId: string,
    key: CollectionKey,
  ): Promise<CareerCollectionFile<T>> {
    const safeOwnerId = assertSafeOwnerId(ownerId);
    try {
      const raw = await fs.readFile(this.filePath(safeOwnerId, key), "utf8");
      const parsed = JSON.parse(raw) as CareerCollectionFile<T>;
      if (parsed.schemaVersion !== 1 || parsed.ownerId !== safeOwnerId) {
        return emptyCollection<T>(safeOwnerId);
      }
      return parsed;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return emptyCollection<T>(safeOwnerId);
      }
      throw error;
    }
  }

  private async writeCollection<T>(
    ownerId: string,
    key: CollectionKey,
    records: T[],
  ): Promise<void> {
    const safeOwnerId = assertSafeOwnerId(ownerId);
    const envelope: CareerCollectionFile<T> = {
      schemaVersion: 1,
      ownerId: safeOwnerId,
      updatedAt: nowIso(),
      records,
    };
    await atomicWriteJson(this.filePath(safeOwnerId, key), envelope);
  }

  private async readProfileFile(ownerId: string): Promise<CareerProfileFile | null> {
    const safeOwnerId = assertSafeOwnerId(ownerId);
    try {
      const raw = await fs.readFile(this.filePath(safeOwnerId, "profile"), "utf8");
      return JSON.parse(raw) as CareerProfileFile;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return null;
      }
      throw error;
    }
  }

  private async writeProfileFile(ownerId: string, record: CareerProfile): Promise<void> {
    const safeOwnerId = assertSafeOwnerId(ownerId);
    const envelope: CareerProfileFile = {
      schemaVersion: 1,
      ownerId: safeOwnerId,
      updatedAt: nowIso(),
      record,
    };
    await atomicWriteJson(this.filePath(safeOwnerId, "profile"), envelope);
  }

  private async loadData(ownerId: string) {
    const [
      profileFile,
      employers,
      engagements,
      projects,
      accomplishments,
      skills,
      evidence,
      evidenceLinks,
      education,
      certifications,
    ] = await Promise.all([
      this.readProfileFile(ownerId),
      this.readCollection<Employer>(ownerId, "employers"),
      this.readCollection<ClientEngagement>(ownerId, "engagements"),
      this.readCollection<CareerProject>(ownerId, "projects"),
      this.readCollection<CareerAccomplishment>(ownerId, "accomplishments"),
      this.readCollection<CareerSkillEvidence>(ownerId, "skills"),
      this.readCollection<CareerEvidence>(ownerId, "evidence"),
      this.readCollection<CareerEvidenceLink>(ownerId, "evidenceLinks"),
      this.readCollection<EducationRecord>(ownerId, "education"),
      this.readCollection<CertificationRecord>(ownerId, "certifications"),
    ]);

    if (!profileFile?.record) {
      throw new CareerNotFoundError("Career profile not found");
    }

    return {
      profile: profileFile.record,
      employers: employers.records,
      engagements: engagements.records,
      projects: projects.records,
      accomplishments: accomplishments.records,
      skills: skills.records,
      evidence: evidence.records,
      evidenceLinks: evidenceLinks.records,
      education: education.records,
      certifications: certifications.records,
    };
  }

  async getOrCreateProfile(ownerId: string): Promise<CareerProfile> {
    return withOwnerLock(ownerId, async () => {
      const safeOwnerId = assertSafeOwnerId(ownerId);
      const existing = await this.readProfileFile(safeOwnerId);
      if (existing?.record) {
        return existing.record;
      }
      const timestamp = nowIso();
      const profile: CareerProfile = {
        id: randomUUID(),
        ownerId: safeOwnerId,
        displayName: "Career Operator",
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      await this.writeProfileFile(safeOwnerId, profile);
      return profile;
    });
  }

  async updateProfile(ownerId: string, input: UpdateCareerProfileInput): Promise<CareerProfile> {
    return withOwnerLock(ownerId, async () => {
      const profile = await this.getOrCreateProfile(ownerId);
      const updated: CareerProfile = {
        ...profile,
        ...input,
        updatedAt: nowIso(),
      };
      await this.writeProfileFile(ownerId, updated);
      return updated;
    });
  }

  async getPortfolio(ownerId: string): Promise<CareerPortfolioSnapshot> {
    await this.getOrCreateProfile(ownerId);
    const data = await this.loadData(ownerId);
    return assemblePortfolioSnapshot(data);
  }

  async createEmployer(ownerId: string, input: CreateEmployerInput): Promise<Employer> {
    return withOwnerLock(ownerId, async () => {
      const profile = await this.getOrCreateProfile(ownerId);
      const file = await this.readCollection<Employer>(ownerId, "employers");
      const timestamp = nowIso();
      const employer: Employer = {
        id: randomUUID(),
        profileId: profile.id,
        name: input.name,
        title: input.title,
        employmentType: input.employmentType,
        location: input.location,
        startDate: input.startDate,
        endDate: input.endDate,
        current: input.current,
        summary: input.summary,
        status: "DRAFT",
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      await this.writeCollection(ownerId, "employers", [...file.records, employer]);
      return employer;
    });
  }

  async updateEmployer(
    ownerId: string,
    employerId: string,
    input: UpdateEmployerInput,
  ): Promise<Employer> {
    return withOwnerLock(ownerId, async () => {
      const file = await this.readCollection<Employer>(ownerId, "employers");
      const index = file.records.findIndex((record) => record.id === employerId);
      if (index < 0) throw new CareerNotFoundError("Employer not found");
      const updated: Employer = {
        ...file.records[index],
        ...input,
        updatedAt: nowIso(),
      };
      const records = [...file.records];
      records[index] = updated;
      await this.writeCollection(ownerId, "employers", records);
      return updated;
    });
  }

  async deleteEmployer(ownerId: string, employerId: string): Promise<void> {
    return withOwnerLock(ownerId, async () => {
      const [employers, engagements, projects, accomplishments] = await Promise.all([
        this.readCollection<Employer>(ownerId, "employers"),
        this.readCollection<ClientEngagement>(ownerId, "engagements"),
        this.readCollection<CareerProject>(ownerId, "projects"),
        this.readCollection<CareerAccomplishment>(ownerId, "accomplishments"),
      ]);
      if (!employers.records.some((record) => record.id === employerId)) {
        throw new CareerNotFoundError("Employer not found");
      }
      const childEngagements = engagements.records.filter(
        (record) => record.employerId === employerId,
      );
      if (childEngagements.length > 0) {
        throw new CareerConflictError(
          "Cannot delete employer while client engagements exist",
        );
      }
      const relatedProjects = projects.records.filter(
        (record) => record.employerId === employerId,
      );
      if (relatedProjects.length > 0) {
        throw new CareerConflictError("Cannot delete employer while projects reference it");
      }
      const relatedAccomplishments = accomplishments.records.filter(
        (record) => record.employerId === employerId,
      );
      if (relatedAccomplishments.length > 0) {
        throw new CareerConflictError(
          "Cannot delete employer while accomplishments reference it",
        );
      }
      await this.writeCollection(
        ownerId,
        "employers",
        employers.records.filter((record) => record.id !== employerId),
      );
    });
  }

  async createEngagement(ownerId: string, input: CreateEngagementInput): Promise<ClientEngagement> {
    return withOwnerLock(ownerId, async () => {
      const profile = await this.getOrCreateProfile(ownerId);
      const employers = await this.readCollection<Employer>(ownerId, "employers");
      if (!employers.records.some((record) => record.id === input.employerId)) {
        throw new CareerNotFoundError("Employer not found for engagement");
      }
      const file = await this.readCollection<ClientEngagement>(ownerId, "engagements");
      const timestamp = nowIso();
      const engagement: ClientEngagement = {
        id: randomUUID(),
        profileId: profile.id,
        employerId: input.employerId,
        clientName: input.clientName,
        title: input.title,
        projectName: input.projectName,
        startDate: input.startDate,
        endDate: input.endDate,
        current: input.current,
        location: input.location,
        summary: input.summary,
        status: "DRAFT",
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      await this.writeCollection(ownerId, "engagements", [...file.records, engagement]);
      return engagement;
    });
  }

  async updateEngagement(
    ownerId: string,
    engagementId: string,
    input: UpdateEngagementInput,
  ): Promise<ClientEngagement> {
    return withOwnerLock(ownerId, async () => {
      const [engagements, employers] = await Promise.all([
        this.readCollection<ClientEngagement>(ownerId, "engagements"),
        this.readCollection<Employer>(ownerId, "employers"),
      ]);
      const index = engagements.records.findIndex((record) => record.id === engagementId);
      if (index < 0) throw new CareerNotFoundError("Engagement not found");
      if (
        input.employerId &&
        !employers.records.some((record) => record.id === input.employerId)
      ) {
        throw new CareerNotFoundError("Employer not found for engagement");
      }
      const updated: ClientEngagement = {
        ...engagements.records[index],
        ...input,
        updatedAt: nowIso(),
      };
      const records = [...engagements.records];
      records[index] = updated;
      await this.writeCollection(ownerId, "engagements", records);
      return updated;
    });
  }

  async deleteEngagement(ownerId: string, engagementId: string): Promise<void> {
    return withOwnerLock(ownerId, async () => {
      const [engagements, projects, accomplishments] = await Promise.all([
        this.readCollection<ClientEngagement>(ownerId, "engagements"),
        this.readCollection<CareerProject>(ownerId, "projects"),
        this.readCollection<CareerAccomplishment>(ownerId, "accomplishments"),
      ]);
      if (!engagements.records.some((record) => record.id === engagementId)) {
        throw new CareerNotFoundError("Engagement not found");
      }
      if (projects.records.some((record) => record.engagementId === engagementId)) {
        throw new CareerConflictError("Cannot delete engagement while projects reference it");
      }
      if (accomplishments.records.some((record) => record.engagementId === engagementId)) {
        throw new CareerConflictError(
          "Cannot delete engagement while accomplishments reference it",
        );
      }
      await this.writeCollection(
        ownerId,
        "engagements",
        engagements.records.filter((record) => record.id !== engagementId),
      );
    });
  }

  private async assertProjectRelationships(
    ownerId: string,
    employerId?: string,
    engagementId?: string,
  ): Promise<void> {
    const [employers, engagements] = await Promise.all([
      this.readCollection<Employer>(ownerId, "employers"),
      this.readCollection<ClientEngagement>(ownerId, "engagements"),
    ]);
    if (employerId && !employers.records.some((record) => record.id === employerId)) {
      throw new CareerNotFoundError("Employer not found for project");
    }
    if (engagementId) {
      const engagement = engagements.records.find((record) => record.id === engagementId);
      if (!engagement) throw new CareerNotFoundError("Engagement not found for project");
      if (employerId && engagement.employerId !== employerId) {
        throw new CareerConflictError("Engagement does not belong to the specified employer");
      }
    }
  }

  async createProject(ownerId: string, input: CreateCareerProjectInput): Promise<CareerProject> {
    return withOwnerLock(ownerId, async () => {
      const profile = await this.getOrCreateProfile(ownerId);
      await this.assertProjectRelationships(ownerId, input.employerId, input.engagementId);
      const file = await this.readCollection<CareerProject>(ownerId, "projects");
      const timestamp = nowIso();
      const project: CareerProject = {
        id: randomUUID(),
        profileId: profile.id,
        employerId: input.employerId,
        engagementId: input.engagementId,
        name: input.name,
        businessChallenge: input.businessChallenge,
        solution: input.solution,
        architecture: input.architecture,
        impact: input.impact,
        startDate: input.startDate,
        endDate: input.endDate,
        status: "DRAFT",
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      await this.writeCollection(ownerId, "projects", [...file.records, project]);
      return project;
    });
  }

  async updateProject(
    ownerId: string,
    projectId: string,
    input: UpdateCareerProjectInput,
  ): Promise<CareerProject> {
    return withOwnerLock(ownerId, async () => {
      const file = await this.readCollection<CareerProject>(ownerId, "projects");
      const index = file.records.findIndex((record) => record.id === projectId);
      if (index < 0) throw new CareerNotFoundError("Project not found");
      const merged = { ...file.records[index], ...input };
      await this.assertProjectRelationships(ownerId, merged.employerId, merged.engagementId);
      const updated: CareerProject = {
        ...merged,
        updatedAt: nowIso(),
      };
      const records = [...file.records];
      records[index] = updated;
      await this.writeCollection(ownerId, "projects", records);
      return updated;
    });
  }

  async deleteProject(ownerId: string, projectId: string): Promise<void> {
    return withOwnerLock(ownerId, async () => {
      const [projects, accomplishments] = await Promise.all([
        this.readCollection<CareerProject>(ownerId, "projects"),
        this.readCollection<CareerAccomplishment>(ownerId, "accomplishments"),
      ]);
      if (!projects.records.some((record) => record.id === projectId)) {
        throw new CareerNotFoundError("Project not found");
      }
      if (accomplishments.records.some((record) => record.projectId === projectId)) {
        throw new CareerConflictError("Cannot delete project while accomplishments reference it");
      }
      await this.writeCollection(
        ownerId,
        "projects",
        projects.records.filter((record) => record.id !== projectId),
      );
    });
  }

  async createAccomplishment(
    ownerId: string,
    input: CreateCareerAccomplishmentInput,
  ): Promise<CareerAccomplishment> {
    return withOwnerLock(ownerId, async () => {
      const profile = await this.getOrCreateProfile(ownerId);
      await this.assertAccomplishmentRelationships(ownerId, input);
      const file = await this.readCollection<CareerAccomplishment>(ownerId, "accomplishments");
      const timestamp = nowIso();
      const accomplishment: CareerAccomplishment = {
        id: randomUUID(),
        profileId: profile.id,
        employerId: input.employerId,
        engagementId: input.engagementId,
        projectId: input.projectId,
        statement: input.statement,
        category: input.category,
        metric: input.metric,
        status: "DRAFT",
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      await this.writeCollection(ownerId, "accomplishments", [...file.records, accomplishment]);
      return accomplishment;
    });
  }

  private async assertAccomplishmentRelationships(
    ownerId: string,
    input: {
      employerId?: string;
      engagementId?: string;
      projectId?: string;
    },
  ): Promise<void> {
    const [employers, engagements, projects] = await Promise.all([
      this.readCollection<Employer>(ownerId, "employers"),
      this.readCollection<ClientEngagement>(ownerId, "engagements"),
      this.readCollection<CareerProject>(ownerId, "projects"),
    ]);
    if (input.employerId && !employers.records.some((record) => record.id === input.employerId)) {
      throw new CareerNotFoundError("Employer not found for accomplishment");
    }
    if (input.engagementId) {
      const engagement = engagements.records.find((record) => record.id === input.engagementId);
      if (!engagement) throw new CareerNotFoundError("Engagement not found for accomplishment");
      if (input.employerId && engagement.employerId !== input.employerId) {
        throw new CareerConflictError("Engagement does not belong to the specified employer");
      }
    }
    if (input.projectId && !projects.records.some((record) => record.id === input.projectId)) {
      throw new CareerNotFoundError("Project not found for accomplishment");
    }
  }

  async updateAccomplishment(
    ownerId: string,
    accomplishmentId: string,
    input: UpdateCareerAccomplishmentInput,
  ): Promise<CareerAccomplishment> {
    return withOwnerLock(ownerId, async () => {
      const file = await this.readCollection<CareerAccomplishment>(ownerId, "accomplishments");
      const index = file.records.findIndex((record) => record.id === accomplishmentId);
      if (index < 0) throw new CareerNotFoundError("Accomplishment not found");
      const merged = { ...file.records[index], ...input };
      await this.assertAccomplishmentRelationships(ownerId, merged);
      const updated: CareerAccomplishment = {
        ...merged,
        updatedAt: nowIso(),
      };
      const records = [...file.records];
      records[index] = updated;
      await this.writeCollection(ownerId, "accomplishments", records);
      return updated;
    });
  }

  async deleteAccomplishment(ownerId: string, accomplishmentId: string): Promise<void> {
    return withOwnerLock(ownerId, async () => {
      const accomplishments = await this.readCollection<CareerAccomplishment>(
        ownerId,
        "accomplishments",
      );
      if (!accomplishments.records.some((record) => record.id === accomplishmentId)) {
        throw new CareerNotFoundError("Accomplishment not found");
      }
      await this.writeCollection(
        ownerId,
        "accomplishments",
        accomplishments.records.filter((record) => record.id !== accomplishmentId),
      );
    });
  }

  async addSkillEvidence(
    ownerId: string,
    input: CreateCareerSkillEvidenceInput,
  ): Promise<CareerSkillEvidence> {
    return withOwnerLock(ownerId, async () => {
      const profile = await this.getOrCreateProfile(ownerId);
      await this.assertSkillRelationships(ownerId, input);
      const file = await this.readCollection<CareerSkillEvidence>(ownerId, "skills");
      const timestamp = nowIso();
      const skill: CareerSkillEvidence = {
        id: randomUUID(),
        profileId: profile.id,
        skill: input.skill,
        employerId: input.employerId,
        engagementId: input.engagementId,
        projectId: input.projectId,
        accomplishmentId: input.accomplishmentId,
        years: input.years,
        proficiency: input.proficiency,
        confidence: input.confidence,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      await this.writeCollection(ownerId, "skills", [...file.records, skill]);
      return skill;
    });
  }

  private async assertSkillRelationships(
    ownerId: string,
    input: {
      employerId?: string;
      engagementId?: string;
      projectId?: string;
      accomplishmentId?: string;
    },
  ): Promise<void> {
    const [employers, engagements, projects, accomplishments] = await Promise.all([
      this.readCollection<Employer>(ownerId, "employers"),
      this.readCollection<ClientEngagement>(ownerId, "engagements"),
      this.readCollection<CareerProject>(ownerId, "projects"),
      this.readCollection<CareerAccomplishment>(ownerId, "accomplishments"),
    ]);
    if (input.employerId && !employers.records.some((record) => record.id === input.employerId)) {
      throw new CareerNotFoundError("Employer not found for skill evidence");
    }
    if (input.engagementId && !engagements.records.some((record) => record.id === input.engagementId)) {
      throw new CareerNotFoundError("Engagement not found for skill evidence");
    }
    if (input.projectId && !projects.records.some((record) => record.id === input.projectId)) {
      throw new CareerNotFoundError("Project not found for skill evidence");
    }
    if (
      input.accomplishmentId &&
      !accomplishments.records.some((record) => record.id === input.accomplishmentId)
    ) {
      throw new CareerNotFoundError("Accomplishment not found for skill evidence");
    }
  }

  async addEvidence(ownerId: string, input: CreateCareerEvidenceInput): Promise<CareerEvidence> {
    return withOwnerLock(ownerId, async () => {
      const profile = await this.getOrCreateProfile(ownerId);
      const file = await this.readCollection<CareerEvidence>(ownerId, "evidence");
      const timestamp = nowIso();
      const evidence: CareerEvidence = {
        id: randomUUID(),
        profileId: profile.id,
        sourceType: input.sourceType,
        sourceName: input.sourceName,
        sourceUri: input.sourceUri,
        excerpt: input.excerpt,
        contentHash: input.contentHash,
        confidence: input.confidence,
        createdAt: timestamp,
      };
      await this.writeCollection(ownerId, "evidence", [...file.records, evidence]);
      return evidence;
    });
  }

  async linkEvidence(
    ownerId: string,
    input: CreateCareerEvidenceLinkInput,
  ): Promise<CareerEvidenceLink> {
    return withOwnerLock(ownerId, async () => {
      const [evidence, links] = await Promise.all([
        this.readCollection<CareerEvidence>(ownerId, "evidence"),
        this.readCollection<CareerEvidenceLink>(ownerId, "evidenceLinks"),
      ]);
      if (!evidence.records.some((record) => record.id === input.evidenceId)) {
        throw new CareerNotFoundError("Evidence not found");
      }
      await this.assertRecordExists(ownerId, input.recordType, input.recordId);
      const link: CareerEvidenceLink = {
        id: randomUUID(),
        evidenceId: input.evidenceId,
        recordType: input.recordType,
        recordId: input.recordId,
        createdAt: nowIso(),
      };
      await this.writeCollection(ownerId, "evidenceLinks", [...links.records, link]);
      return link;
    });
  }

  private async assertRecordExists(
    ownerId: string,
    recordType: CareerEvidenceRecordType,
    recordId: string,
  ): Promise<void> {
    const data = await this.loadData(ownerId);
    switch (recordType) {
      case "PROFILE":
        if (data.profile.id !== recordId) throw new CareerNotFoundError("Profile record not found");
        return;
      case "EMPLOYER":
        if (!data.employers.some((record) => record.id === recordId)) {
          throw new CareerNotFoundError("Employer record not found");
        }
        return;
      case "ENGAGEMENT":
        if (!data.engagements.some((record) => record.id === recordId)) {
          throw new CareerNotFoundError("Engagement record not found");
        }
        return;
      case "PROJECT":
        if (!data.projects.some((record) => record.id === recordId)) {
          throw new CareerNotFoundError("Project record not found");
        }
        return;
      case "ACCOMPLISHMENT":
        if (!data.accomplishments.some((record) => record.id === recordId)) {
          throw new CareerNotFoundError("Accomplishment record not found");
        }
        return;
      case "SKILL":
        if (!data.skills.some((record) => record.id === recordId)) {
          throw new CareerNotFoundError("Skill record not found");
        }
        return;
      case "EDUCATION":
        if (!data.education.some((record) => record.id === recordId)) {
          throw new CareerNotFoundError("Education record not found");
        }
        return;
      case "CERTIFICATION":
        if (!data.certifications.some((record) => record.id === recordId)) {
          throw new CareerNotFoundError("Certification record not found");
        }
        return;
      default: {
        const neverType: never = recordType;
        throw new Error(`Unsupported record type: ${neverType}`);
      }
    }
  }

  async verifyRecord(
    ownerId: string,
    recordType: CareerEvidenceRecordType,
    recordId: string,
  ): Promise<void> {
    return withOwnerLock(ownerId, async () => {
      switch (recordType) {
        case "PROFILE": {
          const profile = await this.getOrCreateProfile(ownerId);
          if (profile.id !== recordId) throw new CareerNotFoundError("Profile record not found");
          await this.writeProfileFile(ownerId, profile);
          return;
        }
        case "EMPLOYER":
          await this.setRecordStatus(ownerId, "employers", recordId);
          return;
        case "ENGAGEMENT":
          await this.setRecordStatus(ownerId, "engagements", recordId);
          return;
        case "PROJECT":
          await this.setRecordStatus(ownerId, "projects", recordId);
          return;
        case "ACCOMPLISHMENT":
          await this.setRecordStatus(ownerId, "accomplishments", recordId);
          return;
        case "EDUCATION":
          await this.setRecordStatus(ownerId, "education", recordId);
          return;
        case "CERTIFICATION":
          await this.setRecordStatus(ownerId, "certifications", recordId);
          return;
        case "SKILL": {
          const skills = await this.readCollection<CareerSkillEvidence>(ownerId, "skills");
          const index = skills.records.findIndex((record) => record.id === recordId);
          if (index < 0) throw new CareerNotFoundError("Skill record not found");
          const records = [...skills.records];
          records[index] = { ...records[index], updatedAt: nowIso() };
          await this.writeCollection(ownerId, "skills", records);
          return;
        }
        default: {
          const neverType: never = recordType;
          throw new Error(`Unsupported record type: ${neverType}`);
        }
      }
    });
  }

  private async setRecordStatus(
    ownerId: string,
    key: "employers" | "engagements" | "projects" | "accomplishments" | "education" | "certifications",
    recordId: string,
  ): Promise<void> {
    const file = await this.readCollection<
      Employer | ClientEngagement | CareerProject | CareerAccomplishment | EducationRecord | CertificationRecord
    >(ownerId, key);
    const index = file.records.findIndex((record) => record.id === recordId);
    if (index < 0) throw new CareerNotFoundError("Record not found");
    const records = [...file.records];
    records[index] = {
      ...records[index],
      status: "VERIFIED",
      updatedAt: nowIso(),
    } as typeof records[number];
    await this.writeCollection(ownerId, key, records);
  }

  async listTimeline(ownerId: string): Promise<CareerTimelineEntry[]> {
    const data = await this.loadData(ownerId);
    return buildCareerTimeline(data);
  }
}

export function resetLocalCareerRepositoryLocksForTests(): void {
  ownerLocks.clear();
}
