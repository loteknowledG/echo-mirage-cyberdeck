// @ts-nocheck
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { MUTHUR_PRESET } from "../src/voice/muthurPreset.ts";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const vaultRoot = path.join(os.homedir(), ".codex", "vault");
const archiveDir = path.join(vaultRoot, "masters");
const canonicalPath = path.join(vaultRoot, "muthur-voice.lock.json");

function timestampForFile(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, "-");
}

function renderSnapshot() {
  return {
    name: "MUTHUR voice master",
    saved_at: new Date().toISOString(),
    notes: "Canonical snapshot for returning to the current MUTHUR sound. Old masters remain archived.",
    preset: MUTHUR_PRESET,
  };
}

async function writeHiddenReadOnlyJson(filePath, data) {
  try {
    execFileSync("attrib", ["-R", "-H", filePath], { stdio: "ignore" });
  } catch {
    // Ignore on non-Windows or when the file does not yet exist.
  }

  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");

  try {
    execFileSync("attrib", ["+R", "+H", filePath], { stdio: "ignore" });
  } catch {
    // Ignore on non-Windows.
  }
}

async function main() {
  await mkdir(vaultRoot, { recursive: true });
  await mkdir(archiveDir, { recursive: true });

  const snapshot = renderSnapshot();
  const stamp = timestampForFile();
  const archiveBase = `muthur-master-${stamp}.json`;
  let archivePath = path.join(archiveDir, archiveBase);

  let suffix = 1;
  while (true) {
    try {
      await readFile(archivePath, "utf8");
      archivePath = path.join(archiveDir, `muthur-master-${stamp}-${suffix}.json`);
      suffix += 1;
    } catch {
      break;
    }
  }

  await writeHiddenReadOnlyJson(archivePath, snapshot);
  await writeHiddenReadOnlyJson(canonicalPath, snapshot);

  try {
    execFileSync("attrib", ["+H", archiveDir], { stdio: "ignore" });
  } catch {
    // Ignore on non-Windows.
  }

  console.log(`[muthur:save] archived master to ${path.relative(repoRoot, archivePath)}`);
  console.log(`[muthur:save] refreshed canonical lock at ${path.relative(repoRoot, canonicalPath)}`);
}

main().catch((error) => {
  console.error("[muthur:save] failed", error);
  process.exitCode = 1;
});
