import { promises as fs } from "node:fs";
import path from "node:path";
import {
  buildCaseId,
  buildCaseSlug,
  callFolderAbs,
  caseFolderAbs,
  pmCasesRootAbs,
} from "@/lib/property-manager/cases/paths";
import type { CaseEvent, PropertyCase } from "@/lib/property-manager/cases/types";

export async function ensureCaseTree(caseSlug: string, callId?: string): Promise<void> {
  const root = caseFolderAbs(caseSlug);
  await fs.mkdir(path.join(root, "calls"), { recursive: true });
  await fs.mkdir(path.join(root, "work-orders"), { recursive: true });
  await fs.mkdir(path.join(root, "attachments"), { recursive: true });
  if (callId) {
    await fs.mkdir(callFolderAbs(caseSlug, callId), { recursive: true });
  }
}

export async function readCaseRecord(slug: string): Promise<PropertyCase | null> {
  try {
    const raw = await fs.readFile(path.join(caseFolderAbs(slug), "case.json"), "utf8");
    return JSON.parse(raw) as PropertyCase;
  } catch {
    return null;
  }
}

export async function writeCaseRecord(caseRecord: PropertyCase): Promise<void> {
  await ensureCaseTree(caseRecord.slug);
  const filePath = path.join(caseFolderAbs(caseRecord.slug), "case.json");
  await fs.writeFile(filePath, `${JSON.stringify(caseRecord, null, 2)}\n`, "utf8");
}

export async function listCaseSlugs(): Promise<string[]> {
  try {
    const entries = await fs.readdir(pmCasesRootAbs(), { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory() && entry.name.startsWith("CASE-"))
      .map((entry) => entry.name);
  } catch {
    return [];
  }
}

export async function listCaseRecords(): Promise<PropertyCase[]> {
  const slugs = await listCaseSlugs();
  const records = await Promise.all(slugs.map((slug) => readCaseRecord(slug)));
  return records.filter((record): record is PropertyCase => record !== null);
}

export async function readCaseEvents(slug: string): Promise<CaseEvent[]> {
  try {
    const raw = await fs.readFile(path.join(caseFolderAbs(slug), "events.json"), "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CaseEvent[]) : [];
  } catch {
    return [];
  }
}

export async function writeCaseEvents(slug: string, events: CaseEvent[]): Promise<void> {
  await ensureCaseTree(slug);
  const filePath = path.join(caseFolderAbs(slug), "events.json");
  await fs.writeFile(filePath, `${JSON.stringify(events, null, 2)}\n`, "utf8");
}

export async function appendCaseEvent(slug: string, event: CaseEvent): Promise<void> {
  const events = await readCaseEvents(slug);
  events.push(event);
  await writeCaseEvents(slug, events);
}

export async function readTimelineMarkdown(slug: string): Promise<string> {
  try {
    return await fs.readFile(path.join(caseFolderAbs(slug), "timeline.md"), "utf8");
  } catch {
    return "# Timeline\n\n";
  }
}

export async function writeTimelineMarkdown(slug: string, content: string): Promise<void> {
  await ensureCaseTree(slug);
  const filePath = path.join(caseFolderAbs(slug), "timeline.md");
  await fs.writeFile(filePath, content, "utf8");
}

export async function writeCaseSummaryMarkdown(slug: string, content: string): Promise<void> {
  await ensureCaseTree(slug);
  const filePath = path.join(caseFolderAbs(slug), "summary.md");
  await fs.writeFile(filePath, content, "utf8");
}

export async function writeCallArtifacts(params: {
  caseSlug: string;
  callId: string;
  transcriptMd: string;
  transcriptJson: unknown;
  summaryMd: string;
}): Promise<void> {
  await ensureCaseTree(params.caseSlug, params.callId);
  const callDir = callFolderAbs(params.caseSlug, params.callId);
  await fs.writeFile(path.join(callDir, "transcript.md"), params.transcriptMd, "utf8");
  await fs.writeFile(
    path.join(callDir, "transcript.json"),
    `${JSON.stringify(params.transcriptJson, null, 2)}\n`,
    "utf8",
  );
  await fs.writeFile(path.join(callDir, "summary.md"), params.summaryMd, "utf8");
}

export function buildNewCaseRecord(params: {
  year: number;
  sequence: number;
  ctx: {
    propertyId: string;
    propertyName: string;
    unitId: string;
    residentName?: string;
    residentPhone?: string;
    category: string;
    issue: string;
    title: string;
  };
  severity: PropertyCase["severity"];
  lookup: PropertyCase["lookup"];
  nowIso: string;
}): PropertyCase {
  const id = buildCaseId(params.year, params.sequence);
  const slug = buildCaseSlug({
    year: params.year,
    sequence: params.sequence,
    propertyId: params.ctx.propertyId,
    unitId: params.ctx.unitId,
    category: params.ctx.category,
    issue: params.ctx.issue,
  });

  return {
    id,
    title: params.ctx.title,
    slug,
    propertyId: params.ctx.propertyId,
    propertyName: params.ctx.propertyName,
    unitId: params.ctx.unitId,
    residentName: params.ctx.residentName,
    residentPhone: params.ctx.residentPhone,
    category: params.ctx.category,
    issue: params.ctx.issue,
    severity: params.severity,
    stage: "intake",
    status: "open",
    callIds: [],
    activeWorkOrderIds: [],
    lookup: params.lookup,
    createdAt: params.nowIso,
    updatedAt: params.nowIso,
  };
}
