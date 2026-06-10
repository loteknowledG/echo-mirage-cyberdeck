import { promises as fs } from "node:fs";
import path from "node:path";
import { persistPmCall } from "../src/lib/property-manager/cases/persist-call.server";
import { pmCasesRootAbs } from "../src/lib/property-manager/cases/paths";
import type { CaseEvent, PropertyCase } from "../src/lib/property-manager/cases/types";
import type { PmCallEpisodeDigest, PmCallTurn } from "../src/lib/pm-call-center/types";

type CheckResult = {
  name: string;
  pass: boolean;
  notes: string;
};

const startedAt = Date.UTC(2026, 5, 10, 12, 58);
const endedAt = Date.UTC(2026, 5, 10, 13, 1);
const secondStartedAt = Date.UTC(2026, 5, 10, 18, 28);
const secondEndedAt = Date.UTC(2026, 5, 10, 18, 32);
const thirdStartedAt = Date.UTC(2026, 5, 10, 19, 40);
const thirdEndedAt = Date.UTC(2026, 5, 10, 19, 45);

function turn(id: string, role: PmCallTurn["role"], text: string, offsetMs: number): PmCallTurn {
  return {
    id,
    role,
    text,
    at: startedAt + offsetMs,
  };
}

const firstCallTurns: PmCallTurn[] = [
  turn(
    "resident-1",
    "resident",
    "Hi, this is Jordan in 4B at Oak Ridge Apartments. Water is pooling under my kitchen sink.",
    0,
  ),
  turn(
    "operator-1",
    "operator",
    "I can help with that. Is the leak still active, and have you tried the shutoff valve?",
    20_000,
  ),
  turn(
    "resident-2",
    "resident",
    "Yes, it is still leaking after I tried the shutoff valve under the sink.",
    45_000,
  ),
  turn(
    "operator-2",
    "operator",
    "About how much water is present, and is any electrical outlet affected?",
    70_000,
  ),
  turn(
    "resident-3",
    "resident",
    "About one towel of water is there. No outlet is affected, but I am worried about the floor warping.",
    95_000,
  ),
  turn(
    "operator-3",
    "operator",
    "I am marking this urgent for plumbing and requesting notification when a technician is assigned or en route.",
    130_000,
  ),
  turn(
    "resident-4",
    "resident",
    "Thank you. Please notify me as soon as the technician is assigned or on the way.",
    160_000,
  ),
];

const secondCallTurns: PmCallTurn[] = [
  {
    id: "resident-5",
    role: "resident",
    text: "This is Jordan in 4B again. The same under-sink leak is still active.",
    at: secondStartedAt,
  },
  {
    id: "operator-4",
    role: "operator",
    text: "I see the open urgent plumbing case for unit 4B and will attach this update.",
    at: secondStartedAt + 30_000,
  },
];

const thirdCallTurns: PmCallTurn[] = [
  {
    id: "resident-6",
    role: "resident",
    text: "Jordan in 4B calling again about a similar kitchen sink leak.",
    at: thirdStartedAt,
  },
  {
    id: "operator-5",
    role: "operator",
    text: "I will open a new review because the prior case is closed.",
    at: thirdStartedAt + 30_000,
  },
];

const digest: PmCallEpisodeDigest = {
  scenarioId: "leak-4b",
  scenarioTitle: "4B Kitchen Sink Leak",
  category: "plumbing",
  residentIntent:
    "Resident reports an active under-sink leak in unit 4B with water pooling under the kitchen sink.",
  operatorActions: [
    "Leak continued after shutoff valve attempt.",
    "No electrical hazard reported.",
    "Resident is concerned about floor warping.",
    "Resident requested notification when technician is assigned or en route.",
  ],
  routing: {
    department: "maintenance",
    urgency: "high",
  },
  goodPhrases: [],
  escalated: true,
  outcome: "Urgent plumbing case created for active kitchen sink leak.",
  lesson: "Preserve transcript as evidence and attach updates to the open case.",
};

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await fs.readFile(filePath, "utf8")) as T;
}

function includesInOrder(haystack: string, needles: string[]): boolean {
  let index = -1;
  for (const needle of needles) {
    const next = haystack.indexOf(needle, index + 1);
    if (next === -1) return false;
    index = next;
  }
  return true;
}

function row(check: CheckResult): string {
  return `| ${check.name} | ${check.pass ? "PASS" : "FAIL"} | ${check.notes.replace(/\|/g, "\\|")} |`;
}

async function main() {
  const checks: CheckResult[] = [];
  const first = await persistPmCall({
    scenarioId: "leak-4b",
    turns: firstCallTurns,
    digest,
    startedAt,
    endedAt,
  });
  const caseDir = path.join(pmCasesRootAbs(), first.caseSlug);
  const firstCallDir = path.join(caseDir, "calls", first.callId);

  const caseFolderExists = await fs.stat(caseDir).then((stat) => stat.isDirectory()).catch(() => false);
  checks.push({
    name: "Case folder created",
    pass: caseFolderExists && first.caseSlug.includes("CASE-2026") && first.caseSlug.includes("oakridge-4b-plumbing-leak"),
    notes: path.relative(process.cwd(), caseDir),
  });

  const transcriptMdPath = path.join(firstCallDir, "transcript.md");
  const transcriptMd = await fs.readFile(transcriptMdPath, "utf8").catch(() => "");
  checks.push({
    name: "Raw transcript saved",
    pass:
      transcriptMd.length > 0 &&
      includesInOrder(transcriptMd, firstCallTurns.map((item) => item.text)) &&
      transcriptMd.includes("RESIDENT:") &&
      transcriptMd.includes("OPERATOR:"),
    notes: path.relative(process.cwd(), transcriptMdPath),
  });

  const transcriptJsonPath = path.join(firstCallDir, "transcript.json");
  const transcriptJson = await readJson<{
    callId?: string;
    startedAt?: string;
    endedAt?: string;
    messages?: Array<{ speaker?: string; timestamp?: string; text?: string }>;
  }>(transcriptJsonPath).catch(() => null);
  checks.push({
    name: "JSON transcript saved",
    pass:
      transcriptJson?.callId === first.callId &&
      typeof transcriptJson.startedAt === "string" &&
      typeof transcriptJson.endedAt === "string" &&
      Array.isArray(transcriptJson.messages) &&
      transcriptJson.messages.length === firstCallTurns.length &&
      transcriptJson.messages.every((message, index) =>
        message.speaker === firstCallTurns[index]?.role &&
        typeof message.timestamp === "string" &&
        message.text === firstCallTurns[index]?.text,
      ),
    notes: path.relative(process.cwd(), transcriptJsonPath),
  });

  const callSummaryPath = path.join(firstCallDir, "summary.md");
  const callSummary = await fs.readFile(callSummaryPath, "utf8").catch(() => "");
  checks.push({
    name: "Call summary saved",
    pass:
      /under-sink leak/i.test(callSummary) &&
      /shutoff/i.test(callSummary) &&
      /No electrical hazard/i.test(callSummary) &&
      /floor warping/i.test(callSummary) &&
      /Severity: Urgent/.test(callSummary),
    notes: path.relative(process.cwd(), callSummaryPath),
  });

  const caseJsonPath = path.join(caseDir, "case.json");
  const caseJson = await readJson<PropertyCase>(caseJsonPath);
  checks.push({
    name: "case.json saved",
    pass:
      Boolean(caseJson.id) &&
      caseJson.title === "4B Kitchen Sink Leak" &&
      caseJson.slug === first.caseSlug &&
      caseJson.propertyId === "oakridge" &&
      caseJson.propertyName === "Oak Ridge Apartments" &&
      caseJson.unitId === "4b" &&
      caseJson.residentName === "Jordan" &&
      caseJson.category === "plumbing" &&
      caseJson.issue === "leak" &&
      caseJson.severity === "urgent" &&
      (caseJson.stage === "triage" || caseJson.stage === "dispatched" || caseJson.stage === "intake") &&
      caseJson.status === "open" &&
      caseJson.callIds.includes(first.callId) &&
      Boolean(caseJson.createdAt) &&
      Boolean(caseJson.updatedAt) &&
      Boolean(caseJson.lookup),
    notes: path.relative(process.cwd(), caseJsonPath),
  });

  const lookupTags = new Set(caseJson.lookup.tags);
  checks.push({
    name: "Lookup metadata present",
    pass:
      caseJson.lookup.key === "oakridge|4b|plumbing|leak" &&
      caseJson.lookup.aliases.some((alias) => /Jordan/i.test(alias) && /4B/i.test(alias)) &&
      lookupTags.has("property:oakridge") &&
      lookupTags.has("unit:4b") &&
      lookupTags.has("resident:jordan") &&
      lookupTags.has("category:plumbing") &&
      lookupTags.has("issue:leak") &&
      lookupTags.has("severity:urgent"),
    notes: "lookup supports property, unit, resident, category, issue, and tags",
  });

  const timelinePath = path.join(caseDir, "timeline.md");
  const timelineBeforeRepeat = await fs.readFile(timelinePath, "utf8");
  checks.push({
    name: "Timeline append-only",
    pass:
      timelineBeforeRepeat.includes("Call started") &&
      timelineBeforeRepeat.includes("Water is pooling under my kitchen sink") &&
      timelineBeforeRepeat.includes("still leaking after I tried the shutoff valve") &&
      timelineBeforeRepeat.includes("Call classified urgent") &&
      timelineBeforeRepeat.includes("Call ended"),
    notes: path.relative(process.cwd(), timelinePath),
  });

  const eventsPath = path.join(caseDir, "events.json");
  const eventsBeforeRepeat = await readJson<CaseEvent[]>(eventsPath);
  checks.push({
    name: "events.json updated",
    pass: eventsBeforeRepeat.some((event) =>
      event.type === "call_ended" && event.callId === first.callId && event.caseId === first.caseId,
    ),
    notes: path.relative(process.cwd(), eventsPath),
  });

  const second = await persistPmCall({
    scenarioId: "leak-4b",
    turns: secondCallTurns,
    digest,
    startedAt: secondStartedAt,
    endedAt: secondEndedAt,
  });
  const caseJsonAfterRepeat = await readJson<PropertyCase>(caseJsonPath);
  const timelineAfterRepeat = await fs.readFile(timelinePath, "utf8");
  const eventsAfterRepeat = await readJson<CaseEvent[]>(eventsPath);
  checks.push({
    name: "Repeat call grouped",
    pass:
      second.caseSlug === first.caseSlug &&
      second.matchedExistingCase &&
      caseJsonAfterRepeat.callIds.includes(first.callId) &&
      caseJsonAfterRepeat.callIds.includes(second.callId) &&
      timelineAfterRepeat.startsWith(timelineBeforeRepeat.trimEnd()) &&
      eventsAfterRepeat.length > eventsBeforeRepeat.length &&
      eventsAfterRepeat.some((event) => event.type === "call_ended" && event.callId === second.callId),
    notes: `${path.relative(process.cwd(), path.join(caseDir, "calls", first.callId))}; ${path.relative(process.cwd(), path.join(caseDir, "calls", second.callId))}`,
  });

  const closedCase: PropertyCase = {
    ...caseJsonAfterRepeat,
    status: "closed",
    stage: "closed",
    updatedAt: new Date(secondEndedAt + 60_000).toISOString(),
  };
  await fs.writeFile(caseJsonPath, `${JSON.stringify(closedCase, null, 2)}\n`, "utf8");

  const third = await persistPmCall({
    scenarioId: "leak-4b",
    turns: thirdCallTurns,
    digest,
    startedAt: thirdStartedAt,
    endedAt: thirdEndedAt,
  });
  checks.push({
    name: "Closed case protected",
    pass: third.caseSlug !== first.caseSlug && third.createdCase,
    notes: `closed=${first.caseSlug}; new=${third.caseSlug}`,
  });

  const failed = checks.filter((check) => !check.pass);
  const lines = [
    "# Verification Result",
    "",
    "## Overall",
    failed.length === 0 ? "PASS" : "FAIL",
    "",
    "## Checks",
    "",
    "| Check | Result | Notes |",
    "|---|---|---|",
    ...checks.map(row),
    "",
    "## Required Fixes",
    "",
    failed.length === 0
      ? "None."
      : failed.map((check) => `- ${check.name}: ${check.notes}`).join("\n"),
    "",
  ];

  console.log(lines.join("\n"));
  if (failed.length > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
