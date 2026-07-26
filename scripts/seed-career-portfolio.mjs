#!/usr/bin/env node
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const tsx = require("tsx/cjs/api");

tsx.register();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

process.chdir(repoRoot);

const {
  createEmployer,
  createClientEngagement,
  createProject,
  createAccomplishment,
  addSkillEvidence,
  addCareerEvidence,
  linkCareerEvidence,
  updateCareerProfile,
  getCareerPortfolio,
} = await import("../src/lib/calyx/domains/career/career-service.server.ts");
const { resolveCareerOwnerId } = await import(
  "../src/lib/calyx/domains/career/career-owner.server.ts"
);
const { setCareerRepositoryForTests, resetCareerRepositoryForTests } = await import(
  "../src/lib/calyx/domains/career/career-repository-factory.server.ts"
);
const { LocalCareerRepository } = await import(
  "../src/lib/calyx/domains/career/career-local-repository.server.ts"
);

function parseArgs(argv) {
  const args = { file: "", dryRun: false, tempDir: "" };
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--dry-run") args.dryRun = true;
    else if (token === "--file") args.file = argv[++i] ?? "";
    else if (token === "--temp-dir") args.tempDir = argv[++i] ?? "";
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv);
  const inputPath = path.resolve(args.file || "data/examples/career-portfolio.example.json");
  const raw = await fs.readFile(inputPath, "utf8");
  const seed = JSON.parse(raw);

  const tempRoot =
    args.tempDir ||
    path.join(repoRoot, ".tmp", `career-seed-${Date.now()}`);
  await fs.mkdir(tempRoot, { recursive: true });

  const ownerId = resolveCareerOwnerId();
  setCareerRepositoryForTests(new LocalCareerRepository(tempRoot), tempRoot);

  const created = [];
  const rejected = [];

  try {
    if (seed.profile) {
      if (args.dryRun) created.push("profile");
      else await updateCareerProfile(ownerId, seed.profile);
    }

    const employerByName = new Map();
    for (const item of seed.employers ?? []) {
      try {
        if (args.dryRun) {
          created.push(`employer:${item.name}`);
          employerByName.set(item.name, `dry-${item.name}`);
          continue;
        }
        const employer = await createEmployer(ownerId, { ...item, current: item.current ?? false });
        employerByName.set(item.name, employer.id);
        created.push(`employer:${employer.name}`);
      } catch (error) {
        rejected.push(`employer:${item.name} -> ${error instanceof Error ? error.message : error}`);
      }
    }

    const engagementByClient = new Map();
    for (const item of seed.engagements ?? []) {
      try {
        const employerId = employerByName.get(item.employerName);
        if (!employerId) throw new Error("employer not found");
        if (args.dryRun) {
          created.push(`engagement:${item.clientName}`);
          engagementByClient.set(item.clientName, `dry-${item.clientName}`);
          continue;
        }
        const engagement = await createClientEngagement(ownerId, {
          employerId,
          clientName: item.clientName,
          title: item.title,
          projectName: item.projectName,
          startDate: item.startDate,
          endDate: item.endDate,
          current: item.current ?? false,
          location: item.location,
          summary: item.summary,
        });
        engagementByClient.set(item.clientName, engagement.id);
        created.push(`engagement:${engagement.clientName}`);
      } catch (error) {
        rejected.push(
          `engagement:${item.clientName} -> ${error instanceof Error ? error.message : error}`,
        );
      }
    }

    const projectByName = new Map();
    for (const item of seed.projects ?? []) {
      try {
        const engagementId = item.engagementClientName
          ? engagementByClient.get(item.engagementClientName)
          : undefined;
        if (args.dryRun) {
          created.push(`project:${item.name}`);
          projectByName.set(item.name, `dry-${item.name}`);
          continue;
        }
        const project = await createProject(ownerId, {
          name: item.name,
          engagementId,
          employerId: item.employerName ? employerByName.get(item.employerName) : undefined,
          businessChallenge: item.businessChallenge,
          solution: item.solution,
          architecture: item.architecture,
          impact: item.impact,
          startDate: item.startDate,
          endDate: item.endDate,
        });
        projectByName.set(item.name, project.id);
        created.push(`project:${project.name}`);
      } catch (error) {
        rejected.push(`project:${item.name} -> ${error instanceof Error ? error.message : error}`);
      }
    }

    for (const item of seed.accomplishments ?? []) {
      try {
        if (args.dryRun) {
          created.push(`accomplishment:${item.statement.slice(0, 24)}`);
          continue;
        }
        const accomplishment = await createAccomplishment(ownerId, {
          statement: item.statement,
          category: item.category,
          metric: item.metric,
          projectId: item.projectName ? projectByName.get(item.projectName) : undefined,
          employerId: item.employerName ? employerByName.get(item.employerName) : undefined,
          engagementId: item.engagementClientName
            ? engagementByClient.get(item.engagementClientName)
            : undefined,
        });
        created.push(`accomplishment:${accomplishment.id}`);
      } catch (error) {
        rejected.push(
          `accomplishment -> ${error instanceof Error ? error.message : error}`,
        );
      }
    }

    for (const item of seed.skills ?? []) {
      try {
        if (args.dryRun) {
          created.push(`skill:${item.skill}`);
          continue;
        }
        const skill = await addSkillEvidence(ownerId, item);
        created.push(`skill:${skill.skill}`);
      } catch (error) {
        rejected.push(`skill:${item.skill} -> ${error instanceof Error ? error.message : error}`);
      }
    }

    const evidenceByName = new Map();
    for (const item of seed.evidence ?? []) {
      try {
        if (args.dryRun) {
          created.push(`evidence:${item.sourceName}`);
          evidenceByName.set(item.sourceName, `dry-${item.sourceName}`);
          continue;
        }
        const evidence = await addCareerEvidence(ownerId, item);
        evidenceByName.set(item.sourceName, evidence.id);
        created.push(`evidence:${evidence.sourceName}`);
      } catch (error) {
        rejected.push(
          `evidence:${item.sourceName} -> ${error instanceof Error ? error.message : error}`,
        );
      }
    }

    for (const item of seed.evidenceLinks ?? []) {
      try {
        if (args.dryRun) {
          created.push(`evidence-link:${item.recordType}`);
          continue;
        }
        await linkCareerEvidence(ownerId, {
          evidenceId: evidenceByName.get(item.evidenceSourceName),
          recordType: item.recordType,
          recordId: item.recordId,
        });
        created.push(`evidence-link:${item.recordType}`);
      } catch (error) {
        rejected.push(
          `evidence-link -> ${error instanceof Error ? error.message : error}`,
        );
      }
    }

    if (!args.dryRun) {
      const portfolio = await getCareerPortfolio(ownerId);
      console.log(
        JSON.stringify(
          {
            ownerId,
            tempRoot,
            summary: portfolio.summary,
            employerCount: portfolio.employers.length,
            engagementCount: portfolio.engagements.length,
          },
          null,
          2,
        ),
      );
    }

    console.log(`[seed-career-portfolio] created=${created.length} rejected=${rejected.length}`);
    if (created.length) console.log("created", created);
    if (rejected.length) console.log("rejected", rejected);
  } finally {
    resetCareerRepositoryForTests();
  }
}

main().catch((error) => {
  console.error("[seed-career-portfolio] FAIL", error);
  process.exitCode = 1;
});
