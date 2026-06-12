import { validateCaseAction, type CaseActionId, type CaseActionInput } from "@/lib/property-manager/actions";
import { nextCaseEventId } from "@/lib/property-manager/cases/event-sequence.server";
import { loadCaseDetail } from "@/lib/property-manager/cases/reader.server";
import { buildCaseSummaryMarkdown } from "@/lib/property-manager/cases/summary";
import {
  appendCaseEvent,
  readCaseEvents,
  readCaseRecord,
  readTimelineMarkdown,
  writeCaseRecord,
  writeCaseSummaryMarkdown,
  writeTimelineMarkdown,
} from "@/lib/property-manager/cases/store.server";
import { appendActionTimelineEntry } from "@/lib/property-manager/cases/timeline";
import type { CaseDetailPayload } from "@/lib/property-manager/cases/viewer-types";
import type { CaseEvent, PropertyCase } from "@/lib/property-manager/cases/types";

function withoutNeedsEtaTag(tags: string[]): string[] {
  return tags.filter((tag) => tag !== "needs-eta" && tag !== "needs_eta");
}

function applyActionToCase(
  caseRecord: PropertyCase,
  action: CaseActionId,
  body: CaseActionInput,
  nowIso: string,
): { caseRecord: PropertyCase; timelineNote: string; eventType: CaseEvent["type"]; payload: Record<string, unknown> } {
  switch (action) {
    case "assign_technician": {
      if (body.action !== "assign_technician") throw new Error("Invalid payload");
      const technicianName = body.input.technicianName.trim();
      const vendor = body.input.vendor?.trim();
      const notes = body.input.notes?.trim();
      return {
        caseRecord: {
          ...caseRecord,
          stage: "assigned",
          status: caseRecord.status === "waiting" ? "open" : caseRecord.status,
          assignment: {
            technicianName,
            ...(vendor ? { vendor } : {}),
            ...(notes ? { notes } : {}),
            assignedAt: nowIso,
          },
          updatedAt: nowIso,
        },
        timelineNote: `Technician ${technicianName} assigned${vendor ? ` (${vendor})` : ""}.`,
        eventType: "technician_assigned",
        payload: {
          technician: technicianName,
          ...(vendor ? { vendor } : {}),
          ...(notes ? { notes } : {}),
        },
      };
    }
    case "add_eta": {
      if (body.action !== "add_eta") throw new Error("Invalid payload");
      const eta = body.input.eta.trim();
      const notes = body.input.notes?.trim();
      return {
        caseRecord: {
          ...caseRecord,
          eta: {
            value: eta,
            ...(notes ? { notes } : {}),
            recordedAt: nowIso,
          },
          lookup: {
            ...caseRecord.lookup,
            tags: withoutNeedsEtaTag(caseRecord.lookup.tags),
          },
          updatedAt: nowIso,
        },
        timelineNote: `ETA added: ${eta}.`,
        eventType: "eta_added",
        payload: { eta, ...(notes ? { notes } : {}) },
      };
    }
    case "mark_en_route":
      return {
        caseRecord: { ...caseRecord, stage: "en_route", updatedAt: nowIso },
        timelineNote: `Technician ${caseRecord.assignment?.technicianName ?? "assigned"} en route.`,
        eventType: "technician_en_route",
        payload: { technician: caseRecord.assignment?.technicianName ?? null },
      };
    case "mark_on_site":
      return {
        caseRecord: { ...caseRecord, stage: "on_site", updatedAt: nowIso },
        timelineNote: `Technician ${caseRecord.assignment?.technicianName ?? "assigned"} on site.`,
        eventType: "technician_on_site",
        payload: { technician: caseRecord.assignment?.technicianName ?? null },
      };
    case "mark_repair_in_progress":
      return {
        caseRecord: { ...caseRecord, stage: "repair_in_progress", updatedAt: nowIso },
        timelineNote: "Repair in progress.",
        eventType: "repair_in_progress",
        payload: {},
      };
    case "mark_resolved":
      return {
        caseRecord: {
          ...caseRecord,
          stage: "resolved",
          status: "resolved",
          updatedAt: nowIso,
        },
        timelineNote: "Case marked resolved.",
        eventType: "case_resolved",
        payload: {},
      };
    case "verify_resolution":
      return {
        caseRecord: { ...caseRecord, stage: "verified", updatedAt: nowIso },
        timelineNote: "Resident resolution verified.",
        eventType: "resolution_verified",
        payload: {},
      };
    case "close_case":
      return {
        caseRecord: {
          ...caseRecord,
          stage: "closed",
          status: "closed",
          updatedAt: nowIso,
        },
        timelineNote: "Case closed.",
        eventType: "case_closed",
        payload: {},
      };
    case "escalate_emergency":
      return {
        caseRecord: {
          ...caseRecord,
          severity: "emergency",
          lookup: {
            ...caseRecord.lookup,
            tags: [...new Set([...caseRecord.lookup.tags, "severity:emergency"])],
          },
          updatedAt: nowIso,
        },
        timelineNote: "Case escalated to emergency severity.",
        eventType: "case_escalated",
        payload: { severity: "emergency" },
      };
    case "send_resident_update": {
      if (body.action !== "send_resident_update") throw new Error("Invalid payload");
      const message = body.input.message.trim();
      const prior = caseRecord.residentUpdates ?? [];
      return {
        caseRecord: {
          ...caseRecord,
          residentUpdates: [...prior, { message, sentAt: nowIso }],
          updatedAt: nowIso,
        },
        timelineNote: "Resident update sent.",
        eventType: "resident_update_sent",
        payload: { message },
      };
    }
    case "add_operator_note": {
      if (body.action !== "add_operator_note") throw new Error("Invalid payload");
      const note = body.input.note.trim();
      return {
        caseRecord: { ...caseRecord, updatedAt: nowIso },
        timelineNote: `Operator note: ${note}`,
        eventType: "operator_note_added",
        payload: { note },
      };
    }
    default:
      throw new Error(`Unsupported action: ${action}`);
  }
}

export async function applyCaseAction(
  caseSlug: string,
  body: CaseActionInput,
  actor: "operator" = "operator",
): Promise<CaseDetailPayload> {
  const action = body.action;
  const caseRecord = await readCaseRecord(caseSlug);
  if (!caseRecord) {
    throw new Error("Case not found");
  }

  const validation = validateCaseAction(caseRecord, action);
  if (!validation.ok) {
    throw new Error(validation.reason);
  }

  if (action === "assign_technician" && body.action === "assign_technician") {
    if (!body.input.technicianName.trim()) {
      throw new Error("Technician name is required.");
    }
  }
  if (action === "add_eta" && body.action === "add_eta") {
    if (!body.input.eta.trim()) {
      throw new Error("ETA is required — do not invent an ETA.");
    }
  }
  if (action === "send_resident_update" && body.action === "send_resident_update") {
    if (!body.input.message.trim()) {
      throw new Error("Resident update message is required.");
    }
  }
  if (action === "add_operator_note" && body.action === "add_operator_note") {
    if (!body.input.note.trim()) {
      throw new Error("Operator note is required.");
    }
  }

  const nowIso = new Date().toISOString();
  const eventId = await nextCaseEventId();
  const { caseRecord: nextCase, timelineNote, eventType, payload } = applyActionToCase(
    caseRecord,
    action,
    body,
    nowIso,
  );

  const event: CaseEvent = {
    id: eventId,
    type: eventType,
    timestamp: nowIso,
    actor,
    caseId: caseRecord.id,
    payload,
  };

  const priorEvents = await readCaseEvents(caseSlug);
  if (priorEvents.length > 0) {
    const last = priorEvents[priorEvents.length - 1];
    if (last?.id === eventId) {
      throw new Error("Duplicate event id — aborting to preserve append-only log.");
    }
  }

  await appendCaseEvent(caseSlug, event);

  const timeline = appendActionTimelineEntry(await readTimelineMarkdown(caseSlug), nowIso, timelineNote);
  await writeTimelineMarkdown(caseSlug, timeline);
  await writeCaseRecord(nextCase);
  await writeCaseSummaryMarkdown(caseSlug, buildCaseSummaryMarkdown(nextCase));

  const detail = await loadCaseDetail(caseSlug);
  if (!detail) {
    throw new Error("Failed to reload case after action");
  }
  return detail;
}
