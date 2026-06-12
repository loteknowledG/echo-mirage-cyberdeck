import { promises as fs } from "node:fs";
import path from "node:path";
import {
  detectParticipantType,
  normalizePhoneInput,
  type CallSession,
  type CallSessionParticipantType,
  type DialerEvent,
  type DialerEventType,
  type DialerState,
  type SimulatedInboundPresetId,
} from "@/lib/property-manager/call-sessions";
import { nextCaseEventId } from "@/lib/property-manager/cases/event-sequence.server";
import { persistPmCall } from "@/lib/property-manager/cases/persist-call.server";
import { readCaseRecord, appendCaseEvent, readTimelineMarkdown, writeTimelineMarkdown } from "@/lib/property-manager/cases/store.server";
import { appendActionTimelineEntry } from "@/lib/property-manager/cases/timeline";
import type { CaseEvent } from "@/lib/property-manager/cases/types";
import type { PmCallEpisodeDigest, PmCallScenarioCategory, PmCallTurn } from "@/lib/pm-call-center/types";

function toScenarioCategory(value: string | undefined): PmCallScenarioCategory {
  const allowed: PmCallScenarioCategory[] = [
    "plumbing",
    "maintenance",
    "leasing",
    "emergency",
    "billing",
    "general",
  ];
  if (value && allowed.includes(value as PmCallScenarioCategory)) {
    return value as PmCallScenarioCategory;
  }
  return "general";
}

const PM_DATA_ROOT = path.join(process.cwd(), "data", "property-manager");
const SESSIONS_FILE = path.join(PM_DATA_ROOT, "call-sessions.json");
const DIALER_EVENTS_FILE = path.join(PM_DATA_ROOT, "dialer-events.json");
const DIALER_SEQUENCE_FILE = path.join(PM_DATA_ROOT, ".dialer-event-sequence.json");

type SessionsStore = {
  sessions: CallSession[];
  incomingSessionId: string | null;
  activeSessionId: string | null;
};

const INBOUND_PRESETS: Record<
  SimulatedInboundPresetId,
  {
    participantName: string;
    phoneNumber: string;
    participantType: CallSessionParticipantType;
    subtitle?: string;
  }
> = {
  "resident-4b": {
    participantName: "Jordan",
    phoneNumber: "5551234567",
    participantType: "resident",
    subtitle: "Unit 4B",
  },
  "vendor-maintenance": {
    participantName: "Mike's Plumbing",
    phoneNumber: "5555551000",
    participantType: "vendor",
  },
};

async function ensureStoreDir(): Promise<void> {
  await fs.mkdir(PM_DATA_ROOT, { recursive: true });
}

async function readSessionsStore(): Promise<SessionsStore> {
  await ensureStoreDir();
  try {
    const raw = await fs.readFile(SESSIONS_FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<SessionsStore>;
    return {
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      incomingSessionId: parsed.incomingSessionId ?? null,
      activeSessionId: parsed.activeSessionId ?? null,
    };
  } catch {
    return { sessions: [], incomingSessionId: null, activeSessionId: null };
  }
}

async function writeSessionsStore(store: SessionsStore): Promise<void> {
  await ensureStoreDir();
  await fs.writeFile(SESSIONS_FILE, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

async function nextDialerEventId(): Promise<string> {
  await ensureStoreDir();
  let year = new Date().getFullYear();
  let next = 1;
  try {
    const raw = await fs.readFile(DIALER_SEQUENCE_FILE, "utf8");
    const parsed = JSON.parse(raw) as { year?: number; next?: number };
    if (typeof parsed.year === "number") year = parsed.year;
    if (typeof parsed.next === "number" && parsed.next > 0) next = parsed.next;
  } catch {
    // fresh sequence
  }
  const currentYear = new Date().getFullYear();
  if (year !== currentYear) {
    year = currentYear;
    next = 1;
  }
  const id = `DIAL-EVT-${year}-${String(next).padStart(5, "0")}`;
  await fs.writeFile(
    DIALER_SEQUENCE_FILE,
    `${JSON.stringify({ year, next: next + 1 }, null, 2)}\n`,
    "utf8",
  );
  return id;
}

async function appendDialerEvent(
  type: DialerEventType,
  session: CallSession,
  payload?: Record<string, unknown>,
): Promise<DialerEvent> {
  await ensureStoreDir();
  const event: DialerEvent = {
    id: await nextDialerEventId(),
    type,
    sessionId: session.id,
    timestamp: new Date().toISOString(),
    actor: "operator",
    payload,
  };
  let existing: DialerEvent[] = [];
  try {
    const raw = await fs.readFile(DIALER_EVENTS_FILE, "utf8");
    const parsed = JSON.parse(raw);
    existing = Array.isArray(parsed) ? (parsed as DialerEvent[]) : [];
  } catch {
    existing = [];
  }
  existing.push(event);
  await fs.writeFile(DIALER_EVENTS_FILE, `${JSON.stringify(existing, null, 2)}\n`, "utf8");
  return event;
}

function sessionById(store: SessionsStore, id: string): CallSession | undefined {
  return store.sessions.find((session) => session.id === id);
}

function upsertSession(store: SessionsStore, session: CallSession): void {
  const index = store.sessions.findIndex((entry) => entry.id === session.id);
  if (index >= 0) {
    store.sessions[index] = session;
  } else {
    store.sessions.push(session);
  }
}

export function buildDialerState(store: SessionsStore): DialerState {
  const incoming = store.incomingSessionId
    ? sessionById(store, store.incomingSessionId) ?? null
    : null;
  const active = store.activeSessionId ? sessionById(store, store.activeSessionId) ?? null : null;
  const recent = [...store.sessions]
    .filter((session) => session.status === "ended" || session.status === "declined")
    .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""))
    .slice(0, 8);
  return { incoming, active, recent };
}

function newSessionId(): string {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `CALL-SESSION-${stamp}-${rand}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function assertNoActiveCall(store: SessionsStore): void {
  if (store.activeSessionId) {
    throw new Error("End the active call before starting another.");
  }
}

async function appendCaseCallAttachedEvent(
  caseSlug: string,
  caseId: string,
  session: CallSession,
): Promise<void> {
  const timestamp = nowIso();
  const eventId = await nextCaseEventId();
  const event: CaseEvent = {
    id: eventId,
    type: "call_attached_to_case",
    timestamp,
    actor: "operator",
    caseId,
    callId: session.id,
    payload: {
      sessionId: session.id,
      direction: session.direction,
      phoneNumber: session.phoneNumber,
      participantType: session.participantType,
      participantName: session.participantName ?? null,
    },
  };
  await appendCaseEvent(caseSlug, event);
  const timeline = appendActionTimelineEntry(
    await readTimelineMarkdown(caseSlug),
    timestamp,
    `Call ${session.id} attached (${session.direction}, ${session.phoneNumber}).`,
  );
  await writeTimelineMarkdown(caseSlug, timeline);
}

async function persistAttachedDialerCall(session: CallSession): Promise<void> {
  if (!session.caseSlug || !session.startedAt) return;

  const startedMs = new Date(session.startedAt).getTime();
  const endedMs = session.endedAt ? new Date(session.endedAt).getTime() : Date.now();
  const caseRecord = await readCaseRecord(session.caseSlug);

  const operatorLine =
    session.direction === "outbound"
      ? `Outbound dial to ${session.participantName ?? session.phoneNumber}.`
      : `Inbound call from ${session.participantName ?? session.phoneNumber}.`;

  const turns: PmCallTurn[] = [
    {
      id: `${session.id}-open`,
      role: "system",
      text: `Phone session ${session.id} (${session.direction}).`,
      at: startedMs,
    },
    {
      id: `${session.id}-operator`,
      role: "operator",
      text: operatorLine,
      at: startedMs + 1_000,
    },
  ];

  if (session.participantType === "resident" && session.participantName) {
    turns.push({
      id: `${session.id}-resident`,
      role: "resident",
      text: `${session.participantName} connected via property manager phone.`,
      at: startedMs + 2_000,
    });
  }

  const digest: PmCallEpisodeDigest = {
    scenarioId: session.participantType === "resident" ? "leak-4b" : "dialer-phone",
    scenarioTitle: caseRecord?.title ?? "Phone Dialer Call",
    category:
      session.participantType === "vendor"
        ? "maintenance"
        : toScenarioCategory(caseRecord?.category),
    residentIntent: `${session.direction} phone call via property manager dialer.`,
    operatorActions: [operatorLine],
    routing: {
      department: session.participantType === "vendor" ? "maintenance" : "general",
      urgency: "medium",
    },
    goodPhrases: [],
    escalated: false,
    outcome: `Phone call ended. Session ${session.id}.`,
    lesson: "Dialer calls are recorded when attached to a case.",
  };

  await persistPmCall({
    scenarioId: digest.scenarioId,
    turns,
    digest,
    startedAt: startedMs,
    endedAt: endedMs,
    attachCaseSlug: session.caseSlug,
  });
}

function applyCaseContext(
  session: CallSession,
  caseSlug: string,
  caseRecord: NonNullable<Awaited<ReturnType<typeof readCaseRecord>>>,
): CallSession {
  return {
    ...session,
    caseId: caseRecord.id,
    caseSlug,
    caseTitle: caseRecord.title,
    casePropertyName: caseRecord.propertyName,
    caseUnitId: caseRecord.unitId,
    updatedAt: nowIso(),
  };
}

export async function getDialerState(): Promise<DialerState> {
  const store = await readSessionsStore();
  return buildDialerState(store);
}

export async function dialOutbound(params: {
  phoneNumber: string;
  caseSlug?: string;
  participantType?: CallSessionParticipantType;
  participantName?: string;
}): Promise<DialerState> {
  const phoneNumber = normalizePhoneInput(params.phoneNumber);
  if (!phoneNumber) {
    throw new Error("Enter a phone number before calling.");
  }

  const store = await readSessionsStore();
  assertNoActiveCall(store);

  const timestamp = nowIso();
  const participantType =
    params.participantType ?? detectParticipantType(phoneNumber);
  const participantName =
    params.participantName ??
    (participantType === "vendor" ? "Mike's Plumbing" : undefined);
  let session: CallSession = {
    id: newSessionId(),
    direction: "outbound",
    participantType,
    participantName,
    phoneNumber,
    status: "active",
    startedAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  if (params.caseSlug) {
    const caseRecord = await readCaseRecord(params.caseSlug);
    if (!caseRecord) throw new Error("Selected case not found.");
    session = applyCaseContext(session, params.caseSlug, caseRecord);
  }

  upsertSession(store, session);
  store.activeSessionId = session.id;
  await writeSessionsStore(store);
  await appendDialerEvent("outbound_call_started", session, {
    phoneNumber,
    caseSlug: session.caseSlug ?? null,
    participantType,
  });

  return buildDialerState(store);
}

export async function simulateInbound(presetId: SimulatedInboundPresetId): Promise<DialerState> {
  const preset = INBOUND_PRESETS[presetId];
  if (!preset) throw new Error("Unknown inbound preset.");

  const store = await readSessionsStore();
  if (store.incomingSessionId) {
    throw new Error("An incoming call is already ringing.");
  }
  assertNoActiveCall(store);

  const timestamp = nowIso();
  const session: CallSession = {
    id: newSessionId(),
    direction: "inbound",
    participantType: preset.participantType,
    participantName: preset.participantName,
    phoneNumber: preset.phoneNumber,
    status: "ringing",
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  upsertSession(store, session);
  store.incomingSessionId = session.id;
  await writeSessionsStore(store);
  await appendDialerEvent("incoming_call_ringing", session, {
    preset: presetId,
    subtitle: preset.subtitle ?? null,
  });

  return buildDialerState(store);
}

export async function pickUpIncoming(sessionId: string, caseSlug?: string): Promise<DialerState> {
  const store = await readSessionsStore();
  if (store.incomingSessionId !== sessionId) {
    throw new Error("No matching incoming call to pick up.");
  }
  assertNoActiveCall(store);

  const session = sessionById(store, sessionId);
  if (!session || session.status !== "ringing") {
    throw new Error("Incoming call is not ringing.");
  }

  const timestamp = nowIso();
  let next: CallSession = {
    ...session,
    status: "active",
    startedAt: timestamp,
    updatedAt: timestamp,
  };

  if (caseSlug) {
    const caseRecord = await readCaseRecord(caseSlug);
    if (!caseRecord) throw new Error("Selected case not found.");
    next = applyCaseContext(next, caseSlug, caseRecord);
  }

  upsertSession(store, next);
  store.incomingSessionId = null;
  store.activeSessionId = sessionId;
  await writeSessionsStore(store);
  await appendDialerEvent("inbound_call_started", next, {
    caseSlug: next.caseSlug ?? null,
  });

  return buildDialerState(store);
}

export async function declineIncoming(sessionId: string): Promise<DialerState> {
  const store = await readSessionsStore();
  if (store.incomingSessionId !== sessionId) {
    throw new Error("No matching incoming call to decline.");
  }

  const session = sessionById(store, sessionId);
  if (!session) throw new Error("Incoming call not found.");

  const timestamp = nowIso();
  const next: CallSession = {
    ...session,
    status: "declined",
    endedAt: timestamp,
    updatedAt: timestamp,
  };

  upsertSession(store, next);
  store.incomingSessionId = null;
  await writeSessionsStore(store);
  await appendDialerEvent("inbound_call_declined", next);

  return buildDialerState(store);
}

export async function attachActiveCallToCase(sessionId: string, caseSlug: string): Promise<DialerState> {
  const store = await readSessionsStore();
  if (store.activeSessionId !== sessionId) {
    throw new Error("No active call to attach.");
  }

  const session = sessionById(store, sessionId);
  if (!session || session.status !== "active") {
    throw new Error("Call is not active.");
  }

  const caseRecord = await readCaseRecord(caseSlug);
  if (!caseRecord) throw new Error("Case not found.");

  const next = applyCaseContext(session, caseSlug, caseRecord);
  upsertSession(store, next);
  await writeSessionsStore(store);
  await appendDialerEvent("call_attached_to_case", next, { caseSlug, caseId: caseRecord.id });
  await appendCaseCallAttachedEvent(caseSlug, caseRecord.id, next);

  return buildDialerState(store);
}

export async function hangUpCall(sessionId: string): Promise<DialerState> {
  const store = await readSessionsStore();
  if (store.activeSessionId !== sessionId) {
    throw new Error("No active call to end.");
  }

  const session = sessionById(store, sessionId);
  if (!session || session.status !== "active") {
    throw new Error("Call is not active.");
  }

  const timestamp = nowIso();
  const next: CallSession = {
    ...session,
    status: "ended",
    endedAt: timestamp,
    updatedAt: timestamp,
  };

  upsertSession(store, next);
  store.activeSessionId = null;
  await writeSessionsStore(store);
  await appendDialerEvent("call_ended", next, {
    caseSlug: next.caseSlug ?? null,
    durationMs:
      next.startedAt != null
        ? new Date(timestamp).getTime() - new Date(next.startedAt).getTime()
        : null,
  });

  const dialerState = buildDialerState(store);

  if (next.caseSlug) {
    void persistAttachedDialerCall(next).catch((error) => {
      console.error("[call-sessions] persistAttachedDialerCall failed after hang up", error);
    });
  }

  return dialerState;
}
