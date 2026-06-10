export type PropertyCaseSeverity = "low" | "normal" | "urgent" | "emergency";

export type PropertyCaseStage =
  | "intake"
  | "triage"
  | "dispatched"
  | "assigned"
  | "en_route"
  | "on_site"
  | "repair_in_progress"
  | "resident_followup"
  | "resolved"
  | "verified"
  | "closed";

export type PropertyCaseStatus = "open" | "waiting" | "blocked" | "resolved" | "closed";

export type CaseLookupMetadata = {
  key: string;
  aliases: string[];
  tags: string[];
};

export type PropertyCase = {
  id: string;
  title: string;
  slug: string;
  propertyId: string;
  propertyName: string;
  unitId: string;
  residentName?: string;
  residentPhone?: string;
  category: string;
  issue: string;
  severity: PropertyCaseSeverity;
  stage: PropertyCaseStage;
  status: PropertyCaseStatus;
  callIds: string[];
  activeWorkOrderIds: string[];
  lookup: CaseLookupMetadata;
  createdAt: string;
  updatedAt: string;
};

export type CaseEventType =
  | "call_started"
  | "call_ended"
  | "case_created"
  | "case_updated"
  | "timeline_note";

export type CaseEvent = {
  type: CaseEventType;
  timestamp: string;
  callId?: string;
  caseId?: string;
  note?: string;
};

export type PersistedCallRecord = {
  callId: string;
  caseId: string;
  caseSlug: string;
  folderRelative: string;
  createdCase: boolean;
  matchedExistingCase: boolean;
};

export type CaseMatchCandidate = {
  caseId: string;
  slug: string;
  title: string;
  status: PropertyCaseStatus;
  severity: PropertyCaseSeverity;
  callCount: number;
  matchReasons: string[];
};
