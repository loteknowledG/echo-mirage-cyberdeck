import { promises as fs } from "node:fs";
import path from "node:path";
import { callFolderAbs, caseFolderAbs } from "@/lib/property-manager/cases/paths";
import {
  listCaseSlugs,
  readCaseEvents,
  readCaseRecord,
  readTimelineMarkdown,
} from "@/lib/property-manager/cases/store.server";
import type { TranscriptJson } from "@/lib/property-manager/cases/transcript-files";
import type { CaseEvent, PropertyCase } from "@/lib/property-manager/cases/types";
import type {
  CaseBoardFilter,
  CaseCallDetailPayload,
  CaseCallListItem,
  CaseDetailPayload,
  CaseListItem,
} from "@/lib/property-manager/cases/viewer-types";

export type {
  CaseBoardFilter,
  CaseCallDetailPayload,
  CaseCallListItem,
  CaseDetailPayload,
  CaseListItem,
};

async function readOptionalText(filePath: string): Promise<string | null> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return raw.trim() ? raw : null;
  } catch {
    return null;
  }
}

async function listCallFolderIds(caseSlug: string): Promise<string[]> {
  try {
    const callsDir = path.join(caseFolderAbs(caseSlug), "calls");
    const entries = await fs.readdir(callsDir, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  } catch {
    return [];
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function lastContactFromEvents(events: CaseEvent[]): string | null {
  const ended = events
    .filter((event) => event.type === "call_ended" && event.timestamp)
    .map((event) => event.timestamp)
    .sort();
  return ended.at(-1) ?? null;
}

function displayTags(caseRecord: PropertyCase): string[] {
  const raw = caseRecord.lookup?.tags ?? [];
  const formatted = raw.map((tag) => {
    const colon = tag.indexOf(":");
    return colon >= 0 ? tag.slice(colon + 1) : tag;
  });
  return [...new Set(formatted)].filter(Boolean);
}

async function resolveLastContactAt(caseSlug: string, events: CaseEvent[]): Promise<string | null> {
  const fromEvents = lastContactFromEvents(events);
  if (fromEvents) return fromEvents;

  const callIds = await listCallFolderIds(caseSlug);
  let latest: string | null = null;
  for (const callId of callIds) {
    const jsonPath = path.join(callFolderAbs(caseSlug, callId), "transcript.json");
    const raw = await readOptionalText(jsonPath);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw) as Partial<TranscriptJson>;
      const endedAt = typeof parsed.endedAt === "string" ? parsed.endedAt : null;
      if (endedAt && (!latest || endedAt > latest)) {
        latest = endedAt;
      }
    } catch {
      /* ignore malformed transcript */
    }
  }
  return latest;
}

async function loadCallListItem(caseSlug: string, callId: string): Promise<CaseCallListItem> {
  const callDir = callFolderAbs(caseSlug, callId);
  const summaryMd = await readOptionalText(path.join(callDir, "summary.md"));
  const transcriptJsonRaw = await readOptionalText(path.join(callDir, "transcript.json"));

  let startedAt: string | null = null;
  let endedAt: string | null = null;
  if (transcriptJsonRaw) {
    try {
      const parsed = JSON.parse(transcriptJsonRaw) as Partial<TranscriptJson>;
      startedAt = typeof parsed.startedAt === "string" ? parsed.startedAt : null;
      endedAt = typeof parsed.endedAt === "string" ? parsed.endedAt : null;
    } catch {
      /* ignore */
    }
  }

  return {
    callId,
    startedAt,
    endedAt,
    summaryMd,
    hasTranscriptMd: await fileExists(path.join(callDir, "transcript.md")),
    hasTranscriptJson: Boolean(transcriptJsonRaw),
  };
}

export async function loadCaseListItem(slug: string): Promise<CaseListItem | null> {
  const caseRecord = await readCaseRecord(slug);
  if (!caseRecord) return null;

  const events = await readCaseEvents(slug);
  const callIds = await listCallFolderIds(slug);
  const lastContactAt = (await resolveLastContactAt(slug, events)) ?? caseRecord.updatedAt;

  return {
    slug: caseRecord.slug,
    id: caseRecord.id,
    title: caseRecord.title,
    propertyName: caseRecord.propertyName,
    unitId: caseRecord.unitId,
    stage: caseRecord.stage,
    status: caseRecord.status,
    severity: caseRecord.severity,
    lastContactAt,
    callCount: Math.max(callIds.length, caseRecord.callIds.length),
    tags: displayTags(caseRecord),
    updatedAt: caseRecord.updatedAt,
  };
}

export async function listCaseBoardItems(): Promise<CaseListItem[]> {
  const slugs = await listCaseSlugs();
  const items = await Promise.all(slugs.map((slug) => loadCaseListItem(slug)));
  return items
    .filter((item): item is CaseListItem => item !== null)
    .sort((a, b) => {
      const aTime = a.lastContactAt ?? a.updatedAt;
      const bTime = b.lastContactAt ?? b.updatedAt;
      return bTime.localeCompare(aTime);
    });
}

export function filterCaseBoardItems(
  items: CaseListItem[],
  filter: CaseBoardFilter,
): CaseListItem[] {
  switch (filter) {
    case "all":
      return items;
    case "closed":
      return items.filter((item) => item.status === "closed" || item.status === "resolved");
    case "open":
      return items.filter(
        (item) => item.status !== "closed" && item.status !== "resolved",
      );
    case "urgent":
      return items.filter((item) => item.severity === "urgent");
    case "emergency":
      return items.filter((item) => item.severity === "emergency");
    case "waiting":
      return items.filter((item) => item.status === "waiting");
    case "needs-eta":
      return items.filter((item) =>
        item.tags.some((tag) => tag === "needs-eta" || tag === "needs_eta" || tag.includes("needs-eta")),
      );
    default:
      return items;
  }
}

export async function loadCaseDetail(slug: string): Promise<CaseDetailPayload | null> {
  const caseRecord = await readCaseRecord(slug);
  if (!caseRecord) return null;

  const summaryMd = await readOptionalText(path.join(caseFolderAbs(slug), "summary.md"));
  const timelineRaw = await readTimelineMarkdown(slug);
  const timelineMd = timelineRaw.trim() && timelineRaw.trim() !== "# Timeline" ? timelineRaw : null;
  const events = await readCaseEvents(slug);

  const callIds = await listCallFolderIds(slug);
  const uniqueCallIds = [...new Set([...caseRecord.callIds, ...callIds])];
  const calls = await Promise.all(uniqueCallIds.map((callId) => loadCallListItem(slug, callId)));
  calls.sort((a, b) => (b.endedAt ?? b.startedAt ?? "").localeCompare(a.endedAt ?? a.startedAt ?? ""));

  return {
    case: caseRecord,
    summaryMd,
    timelineMd,
    events,
    calls,
  };
}

export async function loadCaseCallDetail(
  caseSlug: string,
  callId: string,
): Promise<CaseCallDetailPayload | null> {
  const caseRecord = await readCaseRecord(caseSlug);
  if (!caseRecord) return null;

  const callDir = callFolderAbs(caseSlug, callId);
  if (!(await fileExists(callDir))) return null;

  const summaryMd = await readOptionalText(path.join(callDir, "summary.md"));
  const transcriptMd = await readOptionalText(path.join(callDir, "transcript.md"));
  const transcriptJsonRaw = await readOptionalText(path.join(callDir, "transcript.json"));

  let transcriptJson: TranscriptJson | null = null;
  if (transcriptJsonRaw) {
    try {
      transcriptJson = JSON.parse(transcriptJsonRaw) as TranscriptJson;
    } catch {
      transcriptJson = null;
    }
  }

  return {
    callId,
    summaryMd,
    transcriptMd,
    transcriptJson,
  };
}
