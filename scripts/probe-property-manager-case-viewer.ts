import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { chromium, type Browser, type Page } from "@playwright/test";
import { listCaseBoardItems, loadCaseDetail } from "../src/lib/property-manager/cases/reader.server";
import { buildCallId, pmCasesRootAbs } from "../src/lib/property-manager/cases/paths";
import { persistPmCall } from "../src/lib/property-manager/cases/persist-call.server";
import type { CaseListItem } from "../src/lib/property-manager/cases/viewer-types";
import type { PmCallEpisodeDigest, PmCallTurn } from "../src/lib/pm-call-center/types";

type CheckResult = {
  name: string;
  pass: boolean;
  notes: string;
};

type MtimeSnapshot = Record<string, number>;

const probePort = 3062;

function push(checks: CheckResult[], name: string, pass: boolean, notes: string) {
  checks.push({ name, pass, notes });
}

function turn(id: string, role: PmCallTurn["role"], text: string, at: number): PmCallTurn {
  return { id, role, text, at };
}

async function ensureProbeCase(): Promise<{ boardItem: CaseListItem; seedCallId: string }> {
  const existing = (await listCaseBoardItems()).find(
    (item) =>
      item.title === "4B Kitchen Sink Leak" &&
      item.propertyName === "Oak Ridge Apartments" &&
      item.unitId === "4b" &&
      item.status !== "closed" &&
      item.status !== "resolved",
  );

  const usedCallIds = new Set<string>();
  if (existing) {
    const detail = await loadCaseDetail(existing.slug);
    for (const call of detail?.calls ?? []) usedCallIds.add(call.callId);
  }

  let endedAt = Date.now() - 1_000;
  while (usedCallIds.has(buildCallId(endedAt))) {
    endedAt += 60_000;
  }
  const startedAt = endedAt - 180_000;
  const turns: PmCallTurn[] = [
    turn("viewer-resident-1", "resident", "Hi, this is Jordan in 4B at Oak Ridge Apartments. Water is pooling under my kitchen sink.", startedAt),
    turn("viewer-operator-1", "operator", "I can help. Is this an active leak, and did you try the shutoff valve?", startedAt + 20_000),
    turn("viewer-resident-2", "resident", "It is an active leak and it continued after I tried the shutoff valve.", startedAt + 45_000),
    turn("viewer-operator-2", "operator", "Is there any electrical hazard, and how much water is present?", startedAt + 70_000),
    turn("viewer-resident-3", "resident", "No electrical outlet is affected. There is about one towel of water and I am worried about floor warping.", startedAt + 95_000),
    turn("viewer-operator-3", "operator", "I am classifying this urgent and requesting a technician ETA notification.", startedAt + 130_000),
  ];
  const digest: PmCallEpisodeDigest = {
    scenarioId: "leak-4b",
    scenarioTitle: "4B Kitchen Sink Leak",
    category: "plumbing",
    residentIntent: "Resident reported active leak under kitchen sink.",
    operatorActions: [
      "Resident reported active leak.",
      "Leak continued after shutoff attempt.",
      "No electrical hazard reported.",
      "Resident is concerned about floor warping.",
      "Resident requested notification when technician is assigned or en route.",
    ],
    routing: { department: "maintenance", urgency: "high" },
    goodPhrases: [],
    escalated: true,
    outcome: "Urgent plumbing case created for active kitchen sink leak.",
    lesson: "Transcript is evidence.",
  };

  const persisted = await persistPmCall({ scenarioId: "leak-4b", turns, digest, startedAt, endedAt });
  const created = (await listCaseBoardItems()).find(
    (item) =>
      item.title === "4B Kitchen Sink Leak" &&
      item.propertyName === "Oak Ridge Apartments" &&
      item.unitId === "4b" &&
      item.status !== "closed" &&
      item.status !== "resolved",
  );
  assert.ok(created, "expected probe case to exist after persistence setup");
  return { boardItem: created, seedCallId: persisted.callId };
}

async function serverUp(baseUrl: string): Promise<boolean> {
  try {
    const response = await fetch(`${baseUrl}/api/property-manager/cases`, { cache: "no-store" });
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForServer(baseUrl: string): Promise<void> {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (await serverUp(baseUrl)) return;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error(`Dev server did not become ready: ${baseUrl}`);
}

async function startServer(): Promise<{ baseUrl: string; proc: ChildProcess | null }> {
  const candidates = [
    process.env.PROPERTY_MANAGER_VERIFY_BASE_URL?.replace(/\/$/, ""),
    "http://127.0.0.1:3050",
    "http://127.0.0.1:3051",
  ].filter((value): value is string => Boolean(value));

  for (const baseUrl of candidates) {
    if (await serverUp(baseUrl)) {
      return { baseUrl, proc: null };
    }
  }

  const baseUrl = `http://127.0.0.1:${probePort}`;
  const proc = spawn("pnpm", ["exec", "next", "dev", "--webpack", "-p", String(probePort)], {
    cwd: process.cwd(),
    shell: true,
    stdio: "ignore",
    windowsHide: true,
  });
  await waitForServer(baseUrl);
  return { baseUrl, proc };
}

async function snapshotFiles(caseSlug: string, callId: string): Promise<MtimeSnapshot> {
  const caseDir = path.join(pmCasesRootAbs(), caseSlug);
  const callDir = path.join(caseDir, "calls", callId);
  const files = [
    path.join(caseDir, "case.json"),
    path.join(caseDir, "summary.md"),
    path.join(caseDir, "timeline.md"),
    path.join(caseDir, "events.json"),
    path.join(callDir, "transcript.md"),
    path.join(callDir, "transcript.json"),
  ];

  const snapshot: MtimeSnapshot = {};
  for (const file of files) {
    const stat = await fs.stat(file);
    snapshot[file] = stat.mtimeMs;
  }
  return snapshot;
}

async function sameSnapshot(before: MtimeSnapshot): Promise<boolean> {
  for (const [file, mtimeMs] of Object.entries(before)) {
    const stat = await fs.stat(file);
    if (stat.mtimeMs !== mtimeMs) return false;
  }
  return true;
}

async function apiJson<T>(baseUrl: string, route: string): Promise<T> {
  const response = await fetch(`${baseUrl}${route}`, { cache: "no-store" });
  const payload = await response.json();
  assert.equal(response.ok, true, `${route} returned ${response.status}`);
  return payload as T;
}

async function clickFilter(page: Page, label: string) {
  await page.getByRole("button", { name: label, exact: true }).click();
  await page.waitForTimeout(300);
}

async function main() {
  const checks: CheckResult[] = [];
  const { boardItem: probeCase, seedCallId } = await ensureProbeCase();
  const server = await startServer();
  let browser: Browser | null = null;

  try {
    const listData = await apiJson<{ cases: CaseListItem[] }>(server.baseUrl, "/api/property-manager/cases");
    const apiCase = listData.cases.find((item) => item.slug === probeCase.slug);
    push(
      checks,
      "Case API loads persisted cases",
      Boolean(
        apiCase?.id &&
          apiCase.title &&
          apiCase.propertyName &&
          apiCase.unitId &&
          apiCase.stage &&
          apiCase.status &&
          apiCase.severity &&
          apiCase.lastContactAt &&
          typeof apiCase.callCount === "number" &&
          Array.isArray(apiCase.tags),
      ),
      `/api/property-manager/cases filter=open case=${probeCase.slug}`,
    );

    const detailData = await apiJson<{
      summaryMd: string | null;
      timelineMd: string | null;
      events: unknown[];
      calls: Array<{ callId: string; startedAt: string | null; endedAt: string | null; summaryMd: string | null }>;
    }>(server.baseUrl, `/api/property-manager/cases/${encodeURIComponent(probeCase.slug)}`);
    const firstCall = detailData.calls.find((call) => call.callId === seedCallId) ?? detailData.calls[0];
    assert.ok(firstCall, "expected seeded probe call");

    browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(`${server.baseUrl}/property-manager`, { waitUntil: "networkidle" });

    const card = page.getByRole("button", { name: /4B Kitchen Sink Leak/i }).first();
    await card.waitFor({ timeout: 30_000 });
    const boardText = await page.locator("body").innerText();
    push(
      checks,
      "Case list UI renders",
      /4B Kitchen Sink Leak/.test(boardText) &&
        /Oak Ridge Apartments/.test(boardText) &&
        /Unit 4B/.test(boardText) &&
        /Stage/.test(boardText) &&
        /Status/.test(boardText) &&
        /Severity/.test(boardText) &&
        /Last Contact/.test(boardText) &&
        /Calls/.test(boardText) &&
        /oakridge/.test(boardText),
      "/property-manager case card",
    );

    const openData = await apiJson<{ cases: CaseListItem[] }>(server.baseUrl, "/api/property-manager/cases?filter=open");
    push(
      checks,
      "Open cases default filter",
      openData.cases.some((item) => item.slug === probeCase.slug) &&
        openData.cases.every((item) => item.status !== "closed" && item.status !== "resolved"),
      "/api/property-manager/cases default/open",
    );

    await card.click();
    await page.getByRole("heading", { name: "CASE SUMMARY" }).waitFor({ timeout: 10_000 });
    const detailText = await page.locator("body").innerText();
    push(
      checks,
      "Case detail opens",
      /CASE SUMMARY/.test(detailText) &&
        /TIMELINE/.test(detailText) &&
        /EVENTS/.test(detailText) &&
        /CALLS/.test(detailText) &&
        /CASE\.JSON/.test(detailText),
      "click case card",
    );
    push(
      checks,
      "Summary renders",
      /# Case Summary/.test(detailText) && /4B Kitchen Sink Leak/.test(detailText),
      `${probeCase.slug}/summary.md`,
    );
    push(
      checks,
      "Timeline renders",
      /Call started/.test(detailText) &&
        /active leak|Water is pooling|Resident reported/i.test(detailText) &&
        /Call classified urgent/.test(detailText) &&
        /Call ended/.test(detailText),
      `${probeCase.slug}/timeline.md`,
    );
    push(
      checks,
      "Calls list renders",
      new RegExp(firstCall.callId).test(detailText) &&
        /Call summary/i.test(detailText) &&
        /Open transcript option/.test(detailText) &&
        /Open JSON transcript option/.test(detailText) &&
        /Open evidence/.test(detailText),
      `${probeCase.slug}/calls`,
    );

    const callEvidence = page.locator("article").filter({ hasText: firstCall.callId });
    await callEvidence.getByRole("button", { name: "Open evidence" }).click();
    await callEvidence.getByRole("button", { name: "TRANSCRIPT" }).click();
    const transcriptPre = callEvidence.locator("pre").filter({ hasText: "# Call Transcript" });
    await transcriptPre.waitFor({ timeout: 15_000 });
    const transcriptText = await transcriptPre.innerText();
    push(
      checks,
      "Transcript opens",
      /RESIDENT:/.test(transcriptText) &&
        /OPERATOR:/.test(transcriptText) &&
        /Water is pooling under my kitchen sink|active leak/i.test(transcriptText),
      `${probeCase.slug}/calls/${firstCall.callId}/transcript.md`,
    );

    await callEvidence.getByRole("button", { name: "JSON" }).click();
    const jsonPre = callEvidence.locator("pre").filter({ hasText: '"messages"' });
    await jsonPre.waitFor({ timeout: 15_000 });
    const jsonText = await jsonPre.innerText();
    push(
      checks,
      "JSON transcript opens",
      /"callId"/.test(jsonText) &&
        /"startedAt"/.test(jsonText) &&
        /"endedAt"/.test(jsonText) &&
        /"messages"/.test(jsonText) &&
        /"speaker"/.test(jsonText) &&
        /"timestamp"/.test(jsonText) &&
        /"text"/.test(jsonText),
      `${probeCase.slug}/calls/${firstCall.callId}/transcript.json`,
    );

    const filterExpectations: Array<[string, (items: CaseListItem[]) => boolean]> = [
      ["Open", (items) => items.every((item) => item.status !== "closed" && item.status !== "resolved")],
      ["Urgent", (items) => items.every((item) => item.severity === "urgent")],
      ["Emergency", (items) => items.every((item) => item.severity === "emergency")],
      ["Waiting", (items) => items.every((item) => item.status === "waiting")],
      ["Needs ETA", (items) => items.every((item) => item.tags.some((tag) => tag.includes("needs-eta") || tag.includes("needs_eta")))],
      ["Closed", (items) => items.every((item) => item.status === "closed" || item.status === "resolved")],
    ];
    let filtersPass = true;
    for (const [label, predicate] of filterExpectations) {
      await clickFilter(page, label);
      const id = label.toLowerCase().replace(/\s+/g, "-");
      const data = await apiJson<{ cases: CaseListItem[] }>(server.baseUrl, `/api/property-manager/cases?filter=${id}`);
      filtersPass = filtersPass && predicate(data.cases);
    }
    push(checks, "Filters work", filtersPass, "Open, Urgent, Emergency, Waiting, Needs ETA, Closed");

    const summaryPath = path.join(pmCasesRootAbs(), probeCase.slug, "summary.md");
    const backupPath = `${summaryPath}.probe-bak`;
    await fs.rename(summaryPath, backupPath);
    try {
      await page.reload({ waitUntil: "networkidle" });
      await page.getByRole("button", { name: "Open", exact: true }).click();
      await page.getByRole("button", { name: /4B Kitchen Sink Leak/i }).first().click();
      await page.getByText("No summary.md on disk.").waitFor({ timeout: 10_000 });
      push(checks, "Missing file graceful state", true, `${probeCase.slug}/summary.md`);
    } catch (error) {
      push(checks, "Missing file graceful state", false, error instanceof Error ? error.message : "summary missing state failed");
    } finally {
      await fs.rename(backupPath, summaryPath);
    }

    const beforeBrowse = await snapshotFiles(probeCase.slug, firstCall.callId);
    await page.goto(`${server.baseUrl}/property-manager`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /4B Kitchen Sink Leak/i }).first().click();
    await page.getByRole("button", { name: "Open evidence" }).first().click();
    await page.getByRole("button", { name: "TRANSCRIPT" }).click();
    await page.getByRole("button", { name: "JSON" }).click();
    push(
      checks,
      "Viewer is read-only",
      await sameSnapshot(beforeBrowse),
      "case.json, summary.md, timeline.md, events.json, transcript.md, transcript.json mtimes unchanged",
    );

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
      ...checks.map((check) => `| ${check.name} | ${check.pass ? "PASS" : "FAIL"} | ${check.notes.replace(/\|/g, "\\|")} |`),
      "",
      "## Required Fixes",
      "",
      failed.length === 0 ? "None." : failed.map((check) => `- ${check.name}: ${check.notes}`).join("\n"),
      "",
    ];
    console.log(lines.join("\n"));
    if (failed.length > 0) process.exit(1);
  } finally {
    await browser?.close();
    if (server.proc) {
      server.proc.kill();
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
