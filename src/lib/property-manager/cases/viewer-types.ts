import type { TranscriptJson } from "@/lib/property-manager/cases/transcript-files";
import type { CaseEvent, PropertyCase } from "@/lib/property-manager/cases/types";

export type CaseBoardFilter =
  | "open"
  | "urgent"
  | "emergency"
  | "waiting"
  | "needs-eta"
  | "closed"
  | "all";

export type CaseListItem = {
  slug: string;
  id: string;
  title: string;
  propertyName: string;
  unitId: string;
  stage: PropertyCase["stage"];
  status: PropertyCase["status"];
  severity: PropertyCase["severity"];
  lastContactAt: string | null;
  callCount: number;
  tags: string[];
  updatedAt: string;
};

export type CaseCallListItem = {
  callId: string;
  startedAt: string | null;
  endedAt: string | null;
  summaryMd: string | null;
  hasTranscriptMd: boolean;
  hasTranscriptJson: boolean;
};

export type CaseDetailPayload = {
  case: PropertyCase;
  summaryMd: string | null;
  timelineMd: string | null;
  events: CaseEvent[];
  calls: CaseCallListItem[];
};

export type CaseCallDetailPayload = {
  callId: string;
  summaryMd: string | null;
  transcriptMd: string | null;
  transcriptJson: TranscriptJson | null;
};
