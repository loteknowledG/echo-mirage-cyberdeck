import type { PropertyCase, PropertyCaseStage } from "@/lib/property-manager/cases/types";

export type CaseActionId =
  | "assign_technician"
  | "add_eta"
  | "mark_en_route"
  | "mark_on_site"
  | "mark_repair_in_progress"
  | "mark_resolved"
  | "verify_resolution"
  | "close_case"
  | "escalate_emergency"
  | "send_resident_update"
  | "add_operator_note";

export type AssignTechnicianInput = {
  technicianName: string;
  vendor?: string;
  notes?: string;
};

export type AddEtaInput = {
  eta: string;
  notes?: string;
};

export type SendResidentUpdateInput = {
  message: string;
};

export type AddOperatorNoteInput = {
  note: string;
};

export type CaseActionInput =
  | { action: "assign_technician"; input: AssignTechnicianInput }
  | { action: "add_eta"; input: AddEtaInput }
  | { action: "send_resident_update"; input: SendResidentUpdateInput }
  | { action: "add_operator_note"; input: AddOperatorNoteInput }
  | { action: Exclude<CaseActionId, "assign_technician" | "add_eta" | "send_resident_update" | "add_operator_note"> };

export type CaseActionDefinition = {
  id: CaseActionId;
  label: string;
  eventType: string;
};

export const CASE_ACTION_DEFINITIONS: readonly CaseActionDefinition[] = [
  { id: "assign_technician", label: "Assign Technician", eventType: "technician_assigned" },
  { id: "add_eta", label: "Add ETA", eventType: "eta_added" },
  { id: "mark_en_route", label: "Mark En Route", eventType: "technician_en_route" },
  { id: "mark_on_site", label: "Mark On Site", eventType: "technician_on_site" },
  { id: "mark_repair_in_progress", label: "Mark Repair In Progress", eventType: "repair_in_progress" },
  { id: "mark_resolved", label: "Mark Resolved", eventType: "case_resolved" },
  { id: "verify_resolution", label: "Verify Resolution", eventType: "resolution_verified" },
  { id: "close_case", label: "Close Case", eventType: "case_closed" },
  { id: "escalate_emergency", label: "Escalate Emergency", eventType: "case_escalated" },
  { id: "send_resident_update", label: "Send Resident Update", eventType: "resident_update_sent" },
  { id: "add_operator_note", label: "Add Operator Note", eventType: "operator_note_added" },
] as const;

const CLOSED_STATUSES = new Set<PropertyCase["status"]>(["closed", "resolved"]);

const STAGE_RANK: Record<PropertyCaseStage, number> = {
  intake: 0,
  triage: 1,
  dispatched: 2,
  assigned: 3,
  en_route: 4,
  on_site: 5,
  repair_in_progress: 6,
  resident_followup: 6,
  resolved: 7,
  verified: 8,
  closed: 9,
};

export type CaseActionValidation = { ok: true } | { ok: false; reason: string };

function isTerminal(caseRecord: PropertyCase): boolean {
  return caseRecord.status === "closed" || caseRecord.stage === "closed";
}

function hasTechnician(caseRecord: PropertyCase): boolean {
  return Boolean(caseRecord.assignment?.technicianName?.trim());
}

export function validateCaseAction(
  caseRecord: PropertyCase,
  action: CaseActionId,
): CaseActionValidation {
  if (isTerminal(caseRecord)) {
    return { ok: false, reason: "Case is closed — no operational actions allowed." };
  }

  switch (action) {
    case "assign_technician":
      if (CLOSED_STATUSES.has(caseRecord.status)) {
        return { ok: false, reason: "Cannot assign technician on a closed case." };
      }
      if (STAGE_RANK[caseRecord.stage] >= STAGE_RANK.resolved) {
        return { ok: false, reason: "Cannot assign technician after resolution." };
      }
      return { ok: true };

    case "add_eta":
      if (CLOSED_STATUSES.has(caseRecord.status)) {
        return { ok: false, reason: "Cannot add ETA on a closed case." };
      }
      return { ok: true };

    case "mark_en_route":
      if (!hasTechnician(caseRecord)) {
        return { ok: false, reason: "Cannot Mark En Route until technician is assigned." };
      }
      if (STAGE_RANK[caseRecord.stage] < STAGE_RANK.assigned) {
        return { ok: false, reason: "Assign a technician before marking en route." };
      }
      if (STAGE_RANK[caseRecord.stage] >= STAGE_RANK.en_route) {
        return { ok: false, reason: "Technician is already en route or further along." };
      }
      return { ok: true };

    case "mark_on_site":
      if (!hasTechnician(caseRecord)) {
        return { ok: false, reason: "Cannot Mark On Site until technician is assigned." };
      }
      if (caseRecord.stage !== "en_route") {
        return { ok: false, reason: "Mark En Route before Mark On Site." };
      }
      return { ok: true };

    case "mark_repair_in_progress":
      if (caseRecord.stage !== "on_site") {
        return { ok: false, reason: "Mark On Site before repair in progress." };
      }
      return { ok: true };

    case "mark_resolved":
      if (!["repair_in_progress", "on_site"].includes(caseRecord.stage)) {
        return {
          ok: false,
          reason: "Mark Repair In Progress or On Site before resolving.",
        };
      }
      return { ok: true };

    case "verify_resolution":
      if (caseRecord.stage !== "resolved") {
        return { ok: false, reason: "Mark Resolved before verifying resolution." };
      }
      return { ok: true };

    case "close_case":
      if (caseRecord.stage !== "verified") {
        return { ok: false, reason: "Verify Resolution before closing the case." };
      }
      return { ok: true };

    case "escalate_emergency":
      if (caseRecord.severity === "emergency") {
        return { ok: false, reason: "Case is already emergency severity." };
      }
      return { ok: true };

    case "send_resident_update":
    case "add_operator_note":
      return { ok: true };

    default:
      return { ok: false, reason: "Unknown action." };
  }
}

export function caseActionDisabledReason(
  caseRecord: PropertyCase,
  action: CaseActionId,
): string | null {
  const result = validateCaseAction(caseRecord, action);
  return result.ok ? null : result.reason;
}
