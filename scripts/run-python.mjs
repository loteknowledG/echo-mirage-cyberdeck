#!/usr/bin/env node
/** Run a Python script with python3 (Linux/Vercel) or python (Windows). */
import { spawnSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const scriptArg = process.argv[2];
if (!scriptArg) {
  console.error("usage: node scripts/run-python.mjs <script.py> [args...]");
  process.exit(1);
}

const scriptPath = path.resolve(scriptArg);
const python = process.platform === "win32" ? "python" : "python3";
const result = spawnSync(python, [scriptPath, ...process.argv.slice(3)], {
  stdio: "inherit",
  cwd: path.dirname(fileURLToPath(import.meta.url)) + "/..",
});

if (result.error) {
  console.error(`[run-python] failed to start ${python}:`, result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
