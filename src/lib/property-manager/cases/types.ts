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

export type CaseTechnicianAssignment = {
  technicianName: string;
  vendor?: string;
  notes?: string;
  assignedAt: string;
};

export type CaseEtaRecord = {
  value: string;
  notes?: string;
  recordedAt: string;
};

export type CaseResidentUpdate = {
  message: string;
  sentAt: string;
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
  assignment?: CaseTechnicianAssignment;
  eta?: CaseEtaRecord;
  residentUpdates?: CaseResidentUpdate[];
  createdAt: string;
  updatedAt: string;
};

export type CaseEventType =
  | "call_started"
  | "call_ended"
  | "case_created"
  | "case_updated"
  | "timeline_note"
  | "technician_assigned"
  | "eta_added"
  | "technician_en_route"
  | "technician_on_site"
  | "repair_in_progress"
  | "case_resolved"
  | "resolution_verified"
  | "case_closed"
  | "case_escalated"
  | "resident_update_sent"
  | "operator_note_added"
  | "call_attached_to_case";

export type CaseEventActor = "operator" | "system";

export type CaseEvent = {
  id?: string;
  type: CaseEventType;
  timestamp: string;
  actor?: CaseEventActor;
  caseId?: string;
  callId?: string;
  note?: string;
  payload?: Record<string, unknown>;
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
