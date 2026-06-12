import { exec } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { applyCaseAction } from "../src/lib/property-manager/cases/apply-case-action.server";
import { buildCallId, caseFolderAbs } from "../src/lib/property-manager/cases/paths";
import { nextCaseSequence } from "../src/lib/property-manager/cases/sequence.server";
import {
  buildNewCaseRecord,
  readCaseEvents,
  readCaseRecord,
  writeCallArtifacts,
  writeCaseEvents,
  writeCaseRecord,
  writeCaseSummaryMarkdown,
  writeTimelineMarkdown,
} from "../src/lib/property-manager/cases/store.server";
import { buildCaseSummaryMarkdown } from "../src/lib/property-manager/cases/summary";
import { buildTranscriptJson, buildTranscriptMarkdown } from "../src/lib/property-manager/cases/transcript-files";
import type { CaseActionInput } from "../src/lib/property-manager/actions";
import type {
  CaseEvent,
  PropertyCase,
  PropertyCaseStage,
  PropertyCaseStatus,
} from "../src/lib/property-manager/cases/types";

type CheckName =
  | "Assign Technician"
  | "Add ETA"
  | "Mark En Route"
  | "Mark On Site"
  | "Mark Repair In Progress"
  | "Mark Resolved"
  | "Verify Resolution"
  | "Close Case"
  | "Invalid En Route blocked"
  | "Invalid On Site blocked"
  | "Invalid Close blocked"
  | "Closed case protected"
  | "Emergency escalation works"
  | "Resident update recorded"
  | "Operator note recorded"
  | "Transcript evidence protected"
  | "Existing persistence verifier still passes"
  | "Existing case viewer verifier still passes"
  | "TypeScript passes";

type CheckResult = {
  name: CheckName;
  pass: boolean;
  notes: string;
};

type Snapshot = {
  caseRaw: string;
  eventsRaw: string;
  eventsLength: number;
  timelineRaw: string;
  timelineLength: number;
  evidence: Record<string, { mtimeMs: number; raw: string }>;
};

const startedAt = Date.UTC(2026, 5, 10, 14, 0);
const endedAt = Date.UTC(2026, 5, 10, 14, 4);

function check(name: CheckName, pass: boolean, notes: string): CheckResult {
  return { name, pass, notes };
}

async function runCommand(command: string): Promise<{ ok: boolean; output: string }> {
  return new Promise((resolve) => {
    exec(command, { cwd: process.cwd(), shell: "powershell.exe", timeout: 240_000 }, (error, stdout, stderr) => {
      resolve({ ok: !error, output: `${stdout}${stderr}`.trim() });
    });
  });
}

async function readOptional(filePath: string): Promise<string> {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    return "";
  }
}

async function listEvidenceFiles(caseSlug: string): Promise<string[]> {
  const callsRoot = path.join(caseFolderAbs(caseSlug), "calls");
  const files: string[] = [];
  try {
    const callDirs = await fs.readdir(callsRoot, { withFileTypes: true });
    for (const entry of callDirs) {
      if (!entry.isDirectory()) continue;
      for (const name of ["transcript.md", "transcript.json", "summary.md"]) {
        files.push(path.join(callsRoot, entry.name, name));
      }
    }
  } catch {
    /* no calls */
  }
  return files;
}

async function snapshot(caseSlug: string): Promise<Snapshot> {
  const caseDir = caseFolderAbs(caseSlug);
  const eventsRaw = await readOptional(path.join(caseDir, "events.json"));
  const timelineRaw = await readOptional(path.join(caseDir, "timeline.md"));
  let eventsLength = 0;
  try {
    const parsed = JSON.parse(eventsRaw);
    eventsLength = Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    eventsLength = 0;
  }

  const evidence: Snapshot["evidence"] = {};
  for (const file of await listEvidenceFiles(caseSlug)) {
    const stat = await fs.stat(file);
    evidence[file] = {
      mtimeMs: stat.mtimeMs,
      raw: await fs.readFile(file, "utf8"),
    };
  }

  return {
    caseRaw: await readOptional(path.join(caseDir, "case.json")),
    eventsRaw,
    eventsLength,
    timelineRaw,
    timelineLength: timelineRaw.length,
    evidence,
  };
}

async function evidenceUnchanged(before: Snapshot): Promise<boolean> {
  for (const [file, prior] of Object.entries(before.evidence)) {
    const stat = await fs.stat(file);
    const raw = await fs.readFile(file, "utf8");
    if (stat.mtimeMs !== prior.mtimeMs || raw !== prior.raw) return false;
  }
  return true;
}

async function createActionTestCase(): Promise<PropertyCase> {
  const { year, sequence } = await nextCaseSequence();
  const nowIso = new Date(endedAt).toISOString();
  const base = buildNewCaseRecord({
    year,
    sequence,
    ctx: {
      propertyId: "oakridge",
      propertyName: "Oak Ridge Apartments",
      unitId: "4b",
      residentName: "Jordan",
      residentPhone: "+1-555-0104",
      category: "plumbing",
      issue: "leak",
      title: "4B Kitchen Sink Leak",
    },
    severity: "urgent",
    lookup: {
      key: "oakridge|4b|plumbing|leak",
      aliases: ["Jordan 4B leak", "4B kitchen sink leak", "active leak under sink"],
      tags: [
        "property:oakridge",
        "unit:4b",
        "resident:jordan",
        "category:plumbing",
        "issue:leak",
        "severity:urgent",
        "stage:dispatched",
        "needs-eta",
      ],
    },
    nowIso,
  });
  const caseRecord: PropertyCase = {
    ...base,
    stage: "dispatched",
    status: "open",
  };
  await writeCaseRecord(caseRecord);
  await writeCaseSummaryMarkdown(caseRecord.slug, buildCaseSummaryMarkdown(caseRecord));
  await writeTimelineMarkdown(
    caseRecord.slug,
    "# Timeline\n\n09:00 Call started\n09:01 Resident reported active leak\n09:02 Case classified urgent\n09:04 Call ended\n",
  );
  await writeCaseEvents(caseRecord.slug, [
    {
      id: `EVT-SEED-${sequence}`,
      type: "case_created",
      timestamp: nowIso,
      actor: "system",
      caseId: caseRecord.id,
      payload: { seed: "case-actions-verifier" },
    },
  ]);

  const callId = buildCallId(endedAt);
  const turns = [
    {
      id: "actions-resident-1",
      role: "resident" as const,
      text: "This is Jordan in 4B. The kitchen sink leak is still active.",
      at: startedAt,
    },
    {
      id: "actions-operator-1",
      role: "operator" as const,
      text: "I am dispatching plumbing and preserving this call as evidence.",
      at: startedAt + 60_000,
    },
  ];
  await writeCallArtifacts({
    caseSlug: caseRecord.slug,
    callId,
    transcriptMd: buildTranscriptMarkdown({ callId, caseId: caseRecord.id, turns }),
    transcriptJson: buildTranscriptJson({
      callId,
      caseId: caseRecord.id,
      startedAt,
      endedAt,
      turns,
    }),
    summaryMd: "# Call Summary\n\nActive under-sink leak. Dispatch needed.\n",
  });
  return caseRecord;
}

async function resetOperationalState(
  slug: string,
  stage: PropertyCaseStage,
  status: PropertyCaseStatus,
  extra: Partial<PropertyCase> = {},
) {
  const current = await readCaseRecord(slug);
  if (!current) throw new Error(`Missing case ${slug}`);
  const next: PropertyCase = {
    ...current,
    ...extra,
    stage,
    status,
    updatedAt: new Date().toISOString(),
  };
  await writeCaseRecord(next);
  await writeCaseSummaryMarkdown(slug, buildCaseSummaryMarkdown(next));
}

async function expectValidAction(params: {
  slug: string;
  name: CheckName;
  body: CaseActionInput;
  expectedEvent: CaseEvent["type"];
  timelineIncludes: string;
  assertCase: (caseRecord: PropertyCase) => boolean;
}): Promise<CheckResult> {
  const before = await snapshot(params.slug);
  try {
    await applyCaseAction(params.slug, params.body);
    const after = await snapshot(params.slug);
    const caseRecord = await readCaseRecord(params.slug);
    const events = await readCaseEvents(params.slug);
    const newEvent = events.at(-1);
    const appendedTimeline = after.timelineRaw.slice(before.timelineRaw.length);
    const pass =
      Boolean(caseRecord) &&
      params.assertCase(caseRecord!) &&
      after.caseRaw !== before.caseRaw &&
      after.eventsLength === before.eventsLength + 1 &&
      newEvent?.type === params.expectedEvent &&
      after.timelineLength > before.timelineLength &&
      appendedTimeline.includes(params.timelineIncludes) &&
      await evidenceUnchanged(before);
    return check(params.name, pass, `${params.body.action} -> ${params.expectedEvent}`);
  } catch (error) {
    return check(params.name, false, error instanceof Error ? error.message : "action failed");
  }
}

async function expectInvalidAction(params: {
  slug: string;
  name: CheckName;
  body: CaseActionInput;
}): Promise<CheckResult> {
  const before = await snapshot(params.slug);
  try {
    await applyCaseAction(params.slug, params.body);
    return check(params.name, false, `${params.body.action} unexpectedly succeeded`);
  } catch {
    const after = await snapshot(params.slug);
    const pass =
      after.caseRaw === before.caseRaw &&
      after.eventsRaw === before.eventsRaw &&
      after.timelineRaw === before.timelineRaw &&
      await evidenceUnchanged(before);
    return check(params.name, pass, `${params.body.action} rejected without mutation`);
  }
}

async function main() {
  const checks: CheckResult[] = [];
  const testCase = await createActionTestCase();
  const slug = testCase.slug;
  const initialEvidence = await snapshot(slug);

  checks.push(await expectValidAction({
    slug,
    name: "Assign Technician",
    body: {
      action: "assign_technician",
      input: { technicianName: "Mike Johnson", vendor: "Preferred Plumber #1" },
    },
    expectedEvent: "technician_assigned",
    timelineIncludes: "Technician Mike Johnson assigned",
    assertCase: (item) =>
      item.stage === "assigned" &&
      (item.status === "open" || item.status === "waiting") &&
      item.assignment?.technicianName === "Mike Johnson" &&
      item.assignment.vendor === "Preferred Plumber #1",
  }));

  checks.push(await expectValidAction({
    slug,
    name: "Add ETA",
    body: { action: "add_eta", input: { eta: "45 minutes" } },
    expectedEvent: "eta_added",
    timelineIncludes: "ETA added: 45 minutes",
    assertCase: (item) =>
      item.eta?.value === "45 minutes" &&
      item.lookup.tags.includes("needs-eta") === false,
  }));

  checks.push(await expectValidAction({
    slug,
    name: "Mark En Route",
    body: { action: "mark_en_route" },
    expectedEvent: "technician_en_route",
    timelineIncludes: "Technician Mike Johnson en route",
    assertCase: (item) => item.stage === "en_route",
  }));

  checks.push(await expectValidAction({
    slug,
    name: "Mark On Site",
    body: { action: "mark_on_site" },
    expectedEvent: "technician_on_site",
    timelineIncludes: "Technician Mike Johnson on site",
    assertCase: (item) => item.stage === "on_site",
  }));

  checks.push(await expectValidAction({
    slug,
    name: "Mark Repair In Progress",
    body: { action: "mark_repair_in_progress" },
    expectedEvent: "repair_in_progress",
    timelineIncludes: "Repair in progress",
    assertCase: (item) => item.stage === "repair_in_progress",
  }));

  checks.push(await expectValidAction({
    slug,
    name: "Mark Resolved",
    body: { action: "mark_resolved" },
    expectedEvent: "case_resolved",
    timelineIncludes: "Case marked resolved",
    assertCase: (item) => item.stage === "resolved" && item.status === "resolved",
  }));

  checks.push(await expectValidAction({
    slug,
    name: "Verify Resolution",
    body: { action: "verify_resolution" },
    expectedEvent: "resolution_verified",
    timelineIncludes: "Resident resolution verified",
    assertCase: (item) => item.stage === "verified",
  }));

  checks.push(await expectValidAction({
    slug,
    name: "Close Case",
    body: { action: "close_case" },
    expectedEvent: "case_closed",
    timelineIncludes: "Case closed",
    assertCase: (item) => item.stage === "closed" && item.status === "closed",
  }));

  await resetOperationalState(slug, "dispatched", "open", { assignment: undefined });
  checks.push(await expectInvalidAction({
    slug,
    name: "Invalid En Route blocked",
    body: { action: "mark_en_route" },
  }));

  await resetOperationalState(slug, "assigned", "open", {
    assignment: {
      technicianName: "Mike Johnson",
      vendor: "Preferred Plumber #1",
      assignedAt: new Date().toISOString(),
    },
  });
  checks.push(await expectInvalidAction({
    slug,
    name: "Invalid On Site blocked",
    body: { action: "mark_on_site" },
  }));

  await resetOperationalState(slug, "assigned", "open", {
    assignment: {
      technicianName: "Mike Johnson",
      vendor: "Preferred Plumber #1",
      assignedAt: new Date().toISOString(),
    },
  });
  checks.push(await expectInvalidAction({
    slug,
    name: "Invalid Close blocked",
    body: { action: "close_case" },
  }));

  await resetOperationalState(slug, "closed", "closed", {
    assignment: {
      technicianName: "Mike Johnson",
      vendor: "Preferred Plumber #1",
      assignedAt: new Date().toISOString(),
    },
  });
  const closedAttempts: CaseActionInput[] = [
    { action: "add_eta", input: { eta: "45 minutes" } },
    { action: "assign_technician", input: { technicianName: "Mike Johnson", vendor: "Preferred Plumber #1" } },
    { action: "mark_en_route" },
    { action: "add_operator_note", input: { note: "Resident is concerned about floor warping." } },
  ];
  const closedResults = [];
  for (const body of closedAttempts) {
    closedResults.push(await expectInvalidAction({ slug, name: "Closed case protected", body }));
  }
  checks.push(check(
    "Closed case protected",
    closedResults.every((item) => item.pass),
    closedResults.map((item) => item.notes).join("; "),
  ));

  await resetOperationalState(slug, "dispatched", "open", {
    severity: "urgent",
    assignment: undefined,
  });
  checks.push(await expectValidAction({
    slug,
    name: "Emergency escalation works",
    body: { action: "escalate_emergency" },
    expectedEvent: "case_escalated",
    timelineIncludes: "Case escalated to emergency",
    assertCase: (item) => item.severity === "emergency",
  }));

  checks.push(await expectValidAction({
    slug,
    name: "Resident update recorded",
    body: {
      action: "send_resident_update",
      input: { message: "Technician has been assigned and is expected in 45 minutes." },
    },
    expectedEvent: "resident_update_sent",
    timelineIncludes: "Resident update sent",
    assertCase: (item) =>
      Boolean(item.residentUpdates?.some((update) =>
        update.message === "Technician has been assigned and is expected in 45 minutes.",
      )),
  }));

  checks.push(await expectValidAction({
    slug,
    name: "Operator note recorded",
    body: {
      action: "add_operator_note",
      input: { note: "Resident is concerned about floor warping." },
    },
    expectedEvent: "operator_note_added",
    timelineIncludes: "Operator note",
    assertCase: (item) => item.slug === slug,
  }));

  checks.push(check(
    "Transcript evidence protected",
    await evidenceUnchanged(initialEvidence),
    path.relative(process.cwd(), path.join(caseFolderAbs(slug), "calls")),
  ));

  const persistence = await runCommand("pnpm probe:property-manager-call-persistence");
  checks.push(check(
    "Existing persistence verifier still passes",
    persistence.ok,
    persistence.ok ? "pnpm probe:property-manager-call-persistence" : persistence.output.slice(-500),
  ));

  const viewer = await runCommand("pnpm probe:property-manager-case-viewer");
  checks.push(check(
    "Existing case viewer verifier still passes",
    viewer.ok,
    viewer.ok ? "pnpm probe:property-manager-case-viewer" : viewer.output.slice(-500),
  ));

  const tsc = await runCommand("pnpm exec tsc --noEmit");
  checks.push(check(
    "TypeScript passes",
    tsc.ok,
    tsc.ok ? "pnpm exec tsc --noEmit" : tsc.output.slice(-500),
  ));

  const failed = checks.filter((item) => !item.pass);
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
    ...checks.map((item) => `| ${item.name} | ${item.pass ? "PASS" : "FAIL"} | ${item.notes.replace(/\|/g, "\\|")} |`),
    "",
    "## Required Fixes",
    "",
    failed.length === 0
      ? "None."
      : failed.map((item) =>
        `- ${item.name}\n  - action attempted: see notes\n  - expected result: verifier contract satisfied\n  - actual result: ${item.notes}\n  - affected file path: ${path.relative(process.cwd(), caseFolderAbs(slug))}`,
      ).join("\n"),
    "",
  ];
  console.log(lines.join("\n"));
  if (failed.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
