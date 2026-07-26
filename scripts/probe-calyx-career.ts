/**
 * L-CALYX-100 — Career Intelligence probe suite.
 * Run: pnpm probe:calyx-career
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  validateCreateEmployer,
  validateCreateEngagement,
  validateCreateEvidence,
  validateCreateEvidenceLink,
  validateCreateProject,
  validateOwnerId,
} from "../src/lib/calyx/domains/career/career-validation";
import { buildCareerSummary } from "../src/lib/calyx/domains/career/career-summary";
import {
  buildCareerTimeline,
  groupCareerTimeline,
  UNDATED_TIMELINE_GROUP,
} from "../src/lib/calyx/domains/career/career-timeline";
import {
  LocalCareerRepository,
  resetLocalCareerRepositoryLocksForTests,
} from "../src/lib/calyx/domains/career/career-local-repository.server";
import {
  CalyxCareerRepository,
  CalyxCareerRepositoryUnavailableError,
  probeCalyxCareerRepositoryCapabilities,
} from "../src/lib/calyx/domains/career/career-calyx-repository.server";
import {
  getCareerRepository,
  resetCareerRepositoryForTests,
  resolveCareerStorageMode,
  setCareerRepositoryForTests,
} from "../src/lib/calyx/domains/career/career-repository-factory.server";
import {
  addCareerEvidence,
  addSkillEvidence,
  createAccomplishment,
  createClientEngagement,
  createEmployer,
  createProject,
  deleteEmployerRecord,
  getCareerPortfolio,
  linkCareerEvidence,
  updateCareerProfile,
  updateEmployerRecord,
  verifyCareerRecord,
} from "../src/lib/calyx/domains/career/career-service.server";
import { careerError, careerJson } from "../src/lib/calyx/domains/career/career-api.server";
import { mapCareerServiceError, CareerValidationError } from "../src/lib/calyx/domains/career/career-service.server";

const TEST_OWNER = "career-probe-owner";
const OTHER_OWNER = "career-probe-other";

async function withTempRepository<T>(
  fn: (repo: LocalCareerRepository, root: string) => Promise<T>,
): Promise<T> {
  const root = await mkdtemp(path.join(os.tmpdir(), "echo-career-probe-"));
  const repo = new LocalCareerRepository(root);
  setCareerRepositoryForTests(repo, root);
  try {
    return await fn(repo, root);
  } finally {
    resetCareerRepositoryForTests();
    resetLocalCareerRepositoryLocksForTests();
    await rm(root, { recursive: true, force: true });
  }
}

function testValidation() {
  assert.equal(validateOwnerId("../escape").ok, false);
  assert.equal(validateOwnerId("valid-owner").ok, true);

  const trimmed = validateCreateEmployer({ name: "  Acme  ", current: true, endDate: "2020-01-01" });
  assert.equal(trimmed.ok, false);

  const currentOk = validateCreateEmployer({ name: "Acme", current: true });
  assert.equal(currentOk.ok, true);
  if (currentOk.ok) assert.equal(currentOk.value.name, "Acme");

  const dateBad = validateCreateEmployer({
    name: "Acme",
    current: false,
    startDate: "2022-01-01",
    endDate: "2021-01-01",
  });
  assert.equal(dateBad.ok, false);

  const ownerRejected = validateCreateEmployer({ name: "Acme", ownerId: "x", current: false });
  assert.equal(ownerRejected.ok, false);

  const engagementNeedsEmployer = validateCreateEngagement({
    employerId: "",
    clientName: "Client",
    title: "Lead",
    current: false,
  });
  assert.equal(engagementNeedsEmployer.ok, false);

  const projectOk = validateCreateProject({ name: "Project Alpha" });
  assert.equal(projectOk.ok, true);

  const oversized = validateCreateEmployer({ name: "x".repeat(300), current: false });
  assert.equal(oversized.ok, false);

  const pathUri = validateCreateEvidence({
    sourceType: "USER_ENTRY",
    sourceName: "notes",
    confidence: "USER_CONFIRMED",
    sourceUri: "C:\\Users\\secret\\resume.pdf",
  });
  assert.equal(pathUri.ok, false);

  const badLink = validateCreateEvidenceLink({
    evidenceId: "",
    recordType: "ACCOMPLISHMENT",
    recordId: "missing",
  });
  assert.equal(badLink.ok, false);
}

function testSummaryAndTimeline() {
  const data = {
    profile: {
      id: "p1",
      ownerId: TEST_OWNER,
      displayName: "Probe",
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    },
    employers: [
      {
        id: "e1",
        profileId: "p1",
        name: "Consulting Company",
        current: false,
        status: "DRAFT" as const,
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      },
    ],
    engagements: [
      {
        id: "g1",
        profileId: "p1",
        employerId: "e1",
        clientName: "Example Client",
        title: "Lead",
        current: false,
        status: "DRAFT" as const,
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      },
    ],
    projects: [],
    accomplishments: [],
    skills: [],
    evidence: [],
    evidenceLinks: [],
    education: [],
    certifications: [],
  };

  const summary = buildCareerSummary(data);
  assert.equal(summary.employerCount, 1);
  assert.equal(summary.engagementCount, 1);
  assert.equal(summary.draftRecordCount, 2);

  const timeline = buildCareerTimeline(data);
  assert.ok(timeline.some((entry) => entry.type === "EMPLOYER"));
  assert.ok(timeline.some((entry) => entry.type === "ENGAGEMENT"));

  const grouped = groupCareerTimeline(data);
  assert.ok(grouped.some((group) => group.employers.length > 0));
  assert.equal(grouped.some((group) => group.groupLabel === UNDATED_TIMELINE_GROUP), true);
}

async function testLocalPersistenceAndIsolation() {
  await withTempRepository(async (repo, root) => {
    const profile = await repo.getOrCreateProfile(TEST_OWNER);
    assert.equal(profile.ownerId, TEST_OWNER);

    await assert.rejects(() => repo.getOrCreateProfile("../bad"), /ownerId must not contain/);

    const employer = await repo.createEmployer(TEST_OWNER, {
      name: "Consulting Company",
      current: false,
    });
    assert.equal(employer.status, "DRAFT");

    const engagement = await repo.createEngagement(TEST_OWNER, {
      employerId: employer.id,
      clientName: "Example Client",
      title: "Lead Engineer",
      current: false,
    });
    assert.equal(engagement.employerId, employer.id);

    await assert.rejects(
      () =>
        repo.createEngagement(TEST_OWNER, {
          employerId: "missing",
          clientName: "Bad",
          title: "Bad",
          current: false,
        }),
      /Employer not found/,
    );

    const project = await repo.createProject(TEST_OWNER, {
      name: "Nested Project",
      engagementId: engagement.id,
      employerId: employer.id,
    });
    assert.equal(project.engagementId, engagement.id);

    await assert.rejects(
      () =>
        repo.createProject(TEST_OWNER, {
          name: "Conflict",
          engagementId: engagement.id,
          employerId: "other-employer",
        }),
      /does not belong/,
    );

    const profilePath = path.join(root, TEST_OWNER, "profile.json");
    const raw = await readFile(profilePath, "utf8");
    assert.ok(raw.includes("schemaVersion"));
    assert.doesNotMatch(raw, /\\\\|\/tmp\/|\.calyx/);

    const repo2 = new LocalCareerRepository(root);
    const portfolio = await repo2.getPortfolio(TEST_OWNER);
    assert.equal(portfolio.employers[0]?.name, "Consulting Company");
    assert.equal(portfolio.engagements[0]?.clientName, "Example Client");
  });
}

async function testIntegrationFlow() {
  await withTempRepository(async (repo, root) => {
    await getCareerPortfolio(TEST_OWNER);

    const employer = await createEmployer(TEST_OWNER, {
      name: "Consulting Company",
      current: false,
    });
    const engagement = await createClientEngagement(TEST_OWNER, {
      employerId: employer.id,
      clientName: "Example Client",
      title: "Lead Engineer",
      current: false,
    });
    const project = await createProject(TEST_OWNER, {
      name: "Delivery Platform",
      engagementId: engagement.id,
      employerId: employer.id,
    });
    const accomplishment = await createAccomplishment(TEST_OWNER, {
      statement: "Delivered modular platform for Example Client.",
      category: "ARCHITECTURE",
      projectId: project.id,
    });
    const evidence = await addCareerEvidence(TEST_OWNER, {
      sourceType: "USER_ENTRY",
      sourceName: "Retrospective notes",
      confidence: "USER_CONFIRMED",
    });
    await linkCareerEvidence(TEST_OWNER, {
      evidenceId: evidence.id,
      recordType: "ACCOMPLISHMENT",
      recordId: accomplishment.id,
    });
    await addSkillEvidence(TEST_OWNER, {
      skill: "TypeScript",
      projectId: project.id,
      confidence: "USER_CONFIRMED",
      proficiency: "ADVANCED",
    });
    assert.equal(accomplishment.status, "DRAFT");
    await verifyCareerRecord(TEST_OWNER, "EMPLOYER", employer.id);
    await verifyCareerRecord(TEST_OWNER, "ENGAGEMENT", engagement.id);
    await verifyCareerRecord(TEST_OWNER, "PROJECT", project.id);
    await verifyCareerRecord(TEST_OWNER, "ACCOMPLISHMENT", accomplishment.id);

    const portfolio = await getCareerPortfolio(TEST_OWNER);
    assert.equal(portfolio.employers.length, 1);
    assert.equal(portfolio.employers[0]?.status, "VERIFIED");
    assert.equal(portfolio.engagements.length, 1);
    assert.equal(portfolio.projects.length, 1);
    assert.equal(portfolio.summary.verifiedAccomplishmentCount, 1);
    assert.equal(portfolio.evidenceLinks.length, 1);
    assert.equal(portfolio.skills.length, 1);

    const grouped = groupCareerTimeline(portfolio);
    const employerGroup = grouped.flatMap((group) => group.employers)[0];
    assert.equal(employerGroup?.employer.label, "Consulting Company");
    assert.equal(employerGroup?.engagements[0]?.label, "Example Client");

    const recreated = new LocalCareerRepository(root);
    const persisted = await recreated.getPortfolio(TEST_OWNER);
    assert.equal(persisted.employers[0]?.name, "Consulting Company");
    assert.equal(persisted.evidenceLinks.length, 1);
    assert.equal(persisted.summary.verifiedAccomplishmentCount, 1);
  });
}

async function testOwnerIsolation() {
  await withTempRepository(async (repo) => {
    await repo.createEmployer(TEST_OWNER, { name: "Owner A Corp", current: false });
    await repo.createEmployer(OTHER_OWNER, { name: "Owner B Corp", current: false });

    const portfolioA = await repo.getPortfolio(TEST_OWNER);
    const portfolioB = await repo.getPortfolio(OTHER_OWNER);
    assert.equal(portfolioA.employers.length, 1);
    assert.equal(portfolioB.employers.length, 1);
    assert.notEqual(portfolioA.employers[0]?.name, portfolioB.employers[0]?.name);

    const employerA = portfolioA.employers[0]!;
    await assert.rejects(
      () =>
        repo.createEngagement(OTHER_OWNER, {
          employerId: employerA.id,
          clientName: "Cross-owner client",
          title: "Should fail",
          current: false,
        }),
      /Employer not found/,
    );
  });
}

async function testDeletionConflicts() {
  await withTempRepository(async () => {
    const employer = await createEmployer(TEST_OWNER, {
      name: "Delete Test Co",
      current: false,
    });
    const engagement = await createClientEngagement(TEST_OWNER, {
      employerId: employer.id,
      clientName: "Blocked Client",
      title: "Lead",
      current: false,
    });

    await assert.rejects(() => deleteEmployerRecord(TEST_OWNER, employer.id), /engagements exist/);

    const project = await createProject(TEST_OWNER, {
      name: "Blocked Project",
      engagementId: engagement.id,
      employerId: employer.id,
    });
    await assert.rejects(() => deleteEmployerRecord(TEST_OWNER, employer.id), /engagements exist/);

    await createAccomplishment(TEST_OWNER, {
      statement: "Blocked delete",
      category: "DELIVERY",
      projectId: project.id,
    });
    await assert.rejects(() => deleteEmployerRecord(TEST_OWNER, employer.id), /engagements exist/);
  });
}

async function testConcurrentMutations() {
  await withTempRepository(async (repo) => {
    await repo.getOrCreateProfile(TEST_OWNER);
    const results = await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        repo.createEmployer(TEST_OWNER, {
          name: `Concurrent Employer ${index}`,
          current: false,
        }),
      ),
    );
    assert.equal(results.length, 8);
    assert.equal(new Set(results.map((record) => record.id)).size, 8);

    const portfolio = await repo.getPortfolio(TEST_OWNER);
    assert.equal(portfolio.employers.length, 8);
  });
}

async function testEvidenceLinkValidation() {
  await withTempRepository(async () => {
    await assert.rejects(
      () =>
        linkCareerEvidence(TEST_OWNER, {
          evidenceId: "missing-evidence",
          recordType: "ACCOMPLISHMENT",
          recordId: "missing-record",
        }),
      /not found/i,
    );

    const evidence = await addCareerEvidence(TEST_OWNER, {
      sourceType: "USER_ENTRY",
      sourceName: "Valid evidence",
      confidence: "USER_CONFIRMED",
    });
    await assert.rejects(
      () =>
        linkCareerEvidence(TEST_OWNER, {
          evidenceId: evidence.id,
          recordType: "ACCOMPLISHMENT",
          recordId: "missing-record",
        }),
      /not found/i,
    );
  });
}

async function testUiApiWorkflow() {
  await withTempRepository(async () => {
    await updateCareerProfile(TEST_OWNER, {
      displayName: "Operator",
      headline: "Platform engineer",
    });
    const employer = await createEmployer(TEST_OWNER, { name: "Workflow Corp", current: false });
    await updateEmployerRecord(TEST_OWNER, employer.id, { name: "Workflow Corp (updated)" });

    const portfolio = await getCareerPortfolio(TEST_OWNER);
    assert.equal(portfolio.profile.displayName, "Operator");
    assert.equal(portfolio.employers[0]?.name, "Workflow Corp (updated)");
  });
}

function testApiPathLeakPrevention() {
  const mapped = mapCareerServiceError(
    new CareerValidationError(["sourceUri must not be a filesystem path"]),
  );
  const body = JSON.stringify(mapped);
  assert.doesNotMatch(body, /\\\\|\/tmp\/|\.calyx|node_modules/);

  const internal = mapCareerServiceError(new Error("ENOENT: /secret/path/profile.json"));
  assert.equal(internal.code, "INTERNAL_ERROR");
  assert.doesNotMatch(internal.message, /\/secret\/path/);
}

function testRepositorySelection() {
  resetCareerRepositoryForTests();
  process.env.CALYX_CAREER_STORAGE = "local";
  assert.equal(resolveCareerStorageMode(), "local");
  assert.ok(getCareerRepository() instanceof LocalCareerRepository);

  process.env.CALYX_CAREER_STORAGE = "calyx";
  assert.equal(resolveCareerStorageMode(), "calyx");
  assert.ok(getCareerRepository() instanceof CalyxCareerRepository);
  process.env.CALYX_CAREER_STORAGE = "local";
}

async function testUnavailableCalyxRepository() {
  const repo = new CalyxCareerRepository("probe unavailable");
  await assert.rejects(async () => repo.getPortfolio(TEST_OWNER));
  const probe = await probeCalyxCareerRepositoryCapabilities();
  assert.equal(probe.available, false);
}

function testApiEnvelopes() {
  const ok = careerJson({ hello: "world" });
  assert.equal(ok.status, 200);
  const created = careerJson({ id: "1" });
  assert.equal(created.status, 200);
  const err = careerError("VALIDATION_ERROR", "bad", 400, ["name required"]);
  assert.equal(err.status, 400);

  const mapped = mapCareerServiceError(new CareerValidationError(["bad field"]));
  assert.equal(mapped.status, 400);
  assert.equal(mapped.code, "VALIDATION_ERROR");
}

async function main() {
  testValidation();
  testSummaryAndTimeline();
  testRepositorySelection();
  testApiEnvelopes();
  testApiPathLeakPrevention();
  await testUnavailableCalyxRepository();
  await testLocalPersistenceAndIsolation();
  await testOwnerIsolation();
  await testConcurrentMutations();
  await testDeletionConflicts();
  await testEvidenceLinkValidation();
  await testUiApiWorkflow();
  await testIntegrationFlow();
  console.log("[probe:calyx-career] PASS");
}

main().catch((error) => {
  console.error("[probe:calyx-career] FAIL", error);
  process.exitCode = 1;
});
