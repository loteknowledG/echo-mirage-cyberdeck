/**
 * L-FS-001 workspace folder creation probes.
 * Run: pnpm probe:workspace-create-folder
 */
import assert from "node:assert/strict";
import { rm, stat } from "node:fs/promises";
import path from "node:path";

import { createWorkspaceFolder } from "../src/lib/server/workspace-create-folder.server";
import {
  validateFolderName,
  validateWorkspaceParentPath,
} from "../src/lib/workspace-folder-validation";

const ROOT = process.cwd();
const PROBE_PARENT = "docs/cadre";
const PROBE_NAME = "__jp-l-fs-001-probe-folder__";
const PROBE_NESTED = "ADR";

async function cleanupProbePaths(): Promise<void> {
  const nested = path.join(ROOT, PROBE_PARENT, PROBE_NAME, PROBE_NESTED);
  const parent = path.join(ROOT, PROBE_PARENT, PROBE_NAME);
  await rm(nested, { recursive: true, force: true }).catch(() => undefined);
  await rm(parent, { recursive: true, force: true }).catch(() => undefined);
}

function testValidation(): void {
  assert.equal(validateFolderName("").ok, false);
  assert.equal(validateFolderName("  ").ok, false);
  assert.equal(validateFolderName("..").ok, false);
  assert.equal(validateFolderName("../escape").ok, false);
  assert.equal(validateFolderName("CON").ok, false);
  assert.equal(validateFolderName("valid-name").ok, true);

  assert.equal(validateWorkspaceParentPath("../docs").ok, false);
  assert.equal(validateWorkspaceParentPath("docs/cadre").ok, true);
  assert.equal(validateWorkspaceParentPath("C:\\Windows").ok, false);
  console.log("  ok validation");
}

async function testCreateUnderCadre(): Promise<void> {
  const result = await createWorkspaceFolder(PROBE_PARENT, PROBE_NAME);
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.path, `${PROBE_PARENT}/${PROBE_NAME}`);
  const created = path.join(ROOT, result.path);
  const createdStat = await stat(created);
  assert.ok(createdStat.isDirectory());
  console.log("  ok create under docs/cadre");
}

async function testCreateNested(): Promise<void> {
  const nestedParent = `${PROBE_PARENT}/${PROBE_NAME}`;
  const result = await createWorkspaceFolder(nestedParent, PROBE_NESTED);
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.path, `${nestedParent}/${PROBE_NESTED}`);
  const created = path.join(ROOT, result.path);
  const createdStat = await stat(created);
  assert.ok(createdStat.isDirectory());
  console.log("  ok create nested folder");
}

async function testInvalidName(): Promise<void> {
  const result = await createWorkspaceFolder(PROBE_PARENT, "../escape");
  assert.equal(result.success, false);
  if (result.success) return;
  assert.equal(result.status, 400);
  console.log("  ok invalid name rejected");
}

async function testPathTraversal(): Promise<void> {
  const result = await createWorkspaceFolder("../../tmp", "evil");
  assert.equal(result.success, false);
  if (result.success) return;
  assert.ok(result.status === 400 || result.status === 403);
  console.log("  ok path traversal blocked");
}

async function main(): Promise<void> {
  console.log("probe:workspace-create-folder");
  await cleanupProbePaths();
  try {
    testValidation();
    await testCreateUnderCadre();
    await testCreateNested();
    await testInvalidName();
    await testPathTraversal();
    console.log("probe:workspace-create-folder PASS");
  } finally {
    await cleanupProbePaths();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
