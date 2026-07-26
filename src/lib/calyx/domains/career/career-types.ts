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

export type CareerStorageMode = "local" | "calyx";

export type CareerCollectionFile<T> = {
  schemaVersion: 1;
  ownerId: string;
  updatedAt: string;
  records: T[];
};

export type CareerProfileFile = {
  schemaVersion: 1;
  ownerId: string;
  updatedAt: string;
  record: CareerProfile;
};
