import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  canSaveOperatorDocumentInPlace,
  isOperatorAbsoluteDiskPath,
  resolveOperatorDiskSavePath,
} from "../src/lib/operator-save";
import { validateWriteFilePath } from "../src/lib/muthur/execution/safety-policy";

const DEV_STATE_PATH = path.join(process.cwd(), ".tmp", "dev-server.json");

async function resolveProbeBaseUrl(): Promise<string | null> {
  if (process.env.MUTHUR_VERIFY_BASE_URL?.trim()) {
    return process.env.MUTHUR_VERIFY_BASE_URL.trim().replace(/\/$/, "");
  }
  try {
    const state = JSON.parse(await fs.readFile(DEV_STATE_PATH, "utf8")) as {
      origin?: string;
      appPort?: number;
    };
    if (state.origin) return String(state.origin).replace(/\/$/, "");
    if (state.appPort) return `http://127.0.0.1:${state.appPort}`;
  } catch {
    /* optional */
  }
  try {
    const res = await fetch("http://127.0.0.1:3050/api/muthur/health", { cache: "no-store" });
    if (res.ok) return "http://127.0.0.1:3050";
  } catch {
    /* down */
  }
  return null;
}

async function main() {
  assert.equal(isOperatorAbsoluteDiskPath("F:\\dev\\echo-mirage\\src\\foo.ts"), true);
  assert.equal(isOperatorAbsoluteDiskPath("/home/user/foo.ts"), true);
  assert.equal(isOperatorAbsoluteDiskPath("repo/src/foo.ts"), false);

  const workspaceAbs = path.join(process.cwd(), "src", "lib", "muthur-core", "loop.ts");
  const target = resolveOperatorDiskSavePath(workspaceAbs, workspaceAbs, []);
  assert.ok(target, "expected workspace save target for absolute path");
  assert.equal(target?.kind, "workspace");
  assert.equal(target?.path, workspaceAbs);

  assert.equal(
    canSaveOperatorDocumentInPlace(workspaceAbs, workspaceAbs, []),
    true,
    "workspace-opened file should be writable without folder pane",
  );

  const folderLogical = "my-repo/src/foo.ts";
  assert.equal(
    resolveOperatorDiskSavePath(folderLogical, null, []),
    null,
    "folder logical path without roots should not resolve to workspace",
  );

  const probeDir = path.join(process.cwd(), ".tmp");
  await fs.mkdir(probeDir, { recursive: true });
  const probeFile = path.join(probeDir, `probe-operator-disk-save-${Date.now()}.txt`);
  const marker = `probe-operator-disk-save ${Date.now()}\n`;

  const validated = validateWriteFilePath(probeFile);
  assert.equal(validated.ok, true);
  if (!validated.ok) throw new Error("validateWriteFilePath failed");

  await fs.writeFile(validated.abs, marker, "utf8");
  const onDisk = await fs.readFile(probeFile, "utf8");
  assert.equal(onDisk, marker);
  await fs.unlink(probeFile);

  const outside = path.resolve(process.cwd(), "..", "outside-probe.txt");
  const blocked = validateWriteFilePath(outside);
  assert.equal(blocked.ok, false);

  const baseUrl = await resolveProbeBaseUrl();
  if (baseUrl) {
    const apiProbeFile = path.join(probeDir, `probe-write-api-${Date.now()}.txt`);
    const res = await fetch(`${baseUrl}/api/write-file`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: apiProbeFile, content: marker }),
    });
    const payload = (await res.json()) as { ok?: boolean; path?: string; error?: string };
    assert.equal(res.ok, true, payload.error ?? JSON.stringify(payload));
    assert.equal(payload.ok, true);
    assert.equal(await fs.readFile(apiProbeFile, "utf8"), marker);
    await fs.unlink(apiProbeFile);
    console.log("probe-muthur-operator-disk-save: PASS (helpers + API)", baseUrl);
  } else {
    console.log("probe-muthur-operator-disk-save: PASS (helpers; API skipped — dev server down)");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
