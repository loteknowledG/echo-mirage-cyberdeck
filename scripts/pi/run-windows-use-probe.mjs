#!/usr/bin/env node
/** Run Pi windows-use probe via .venv-pi (L-PI-001A). */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const venvPython =
  process.platform === "win32"
    ? path.join(root, ".venv-pi", "Scripts", "python.exe")
    : path.join(root, ".venv-pi", "bin", "python");
const probeScript = path.join(root, "scripts", "pi", "windows-use-probe.py");

if (!fs.existsSync(venvPython)) {
  console.error("probe:pi-windows-use: FAIL — .venv-pi not found");
  console.error("Remediation: python -m venv .venv-pi && .venv-pi\\Scripts\\pip install -r requirements-pi.txt");
  process.exit(1);
}

if (!fs.existsSync(probeScript)) {
  console.error("probe:pi-windows-use: FAIL — probe script missing");
  process.exit(1);
}

const result = spawnSync(venvPython, [probeScript], {
  cwd: root,
  encoding: "utf8",
  maxBuffer: 10 * 1024 * 1024,
});

if (result.stdout) {
  process.stdout.write(result.stdout);
}
if (result.stderr) {
  process.stderr.write(result.stderr);
}

let receipt;
try {
  receipt = JSON.parse(result.stdout.trim());
} catch {
  console.error("probe:pi-windows-use: FAIL — invalid probe JSON");
  process.exit(result.status ?? 1);
}

if (process.platform !== "win32") {
  console.log("probe:pi-windows-use: PASS (non-Windows skip)");
  process.exit(0);
}

if (receipt.status === "success" && receipt.probe?.windowsUseImportOk && receipt.probe?.screenshotOk) {
  console.log("probe:pi-windows-use: PASS");
  process.exit(0);
}

console.error("probe:pi-windows-use: FAIL");
process.exit(result.status ?? 1);
