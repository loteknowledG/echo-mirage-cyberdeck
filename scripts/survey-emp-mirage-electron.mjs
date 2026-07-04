import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cyberdeckRouteUrl, resolveDevOrigin } from "./resolve-dev-origin.mjs";

const require = createRequire(import.meta.url);
const electronBinary = require("electron");

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const empLaunchPath = path.join(root, ".tmp", "emp-electron-launch.json");
const MIRAGE_PATH = "/cyberdeck?surveyEmp=mirage&surveyEmpConnect=1";
const POWERFIST_PATH = "/cyberdeck?surveyEmp=powerfist";

function runNodeScript(relativePath) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(root, relativePath)], {
      cwd: root,
      stdio: "inherit",
      env: process.env,
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${relativePath} exited ${code}`));
    });
  });
}

/** @param {string} origin */
async function verifyCyberdeckReachable(origin, attempts = 20) {
  const route = cyberdeckRouteUrl(origin);
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const res = await fetch(route, { redirect: "follow" });
      if (res.ok) {
        process.stdout.write(`[survey:emp] verified ${route} (attempt ${attempt})\n`);
        return origin;
      }
      process.stdout.write(`[survey:emp] ${route} HTTP ${res.status} — retrying\n`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      process.stdout.write(`[survey:emp] ${route} unreachable (${message}) — retrying\n`);
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error(`Cyberdeck route not reachable at ${route}`);
}

console.log("[survey:emp] Waiting for fresh cyberdeck dev session…");
await runNodeScript("scripts/wait-dev-server.mjs");

/** wait-dev-server already compiled /cyberdeck — skip warm-cyberdeck (second pass OOMs on Windows). */
const SETTLE_MS = 3_000;
process.stdout.write(`[survey:emp] route ready — settling ${SETTLE_MS / 1000}s before Electron…\n`);
await new Promise((resolve) => setTimeout(resolve, SETTLE_MS));

const origin = await verifyCyberdeckReachable(await resolveDevOrigin());

await fs.mkdir(path.dirname(empLaunchPath), { recursive: true });
await fs.writeFile(
  empLaunchPath,
  JSON.stringify(
    {
      origin,
      miragePath: MIRAGE_PATH,
      powerfistPath: POWERFIST_PATH,
      writtenAt: new Date().toISOString(),
    },
    null,
    2,
  ),
  "utf8",
);

console.log(`[survey:emp] Launching Electron squad @ ${origin} (Mirage + PowerFist windows)…`);

const electron = spawn(electronBinary, ["."], {
  cwd: root,
  stdio: "inherit",
  env: {
    ...process.env,
    ECHO_MIRAGE_DEV_ORIGIN: origin,
    ECHO_MIRAGE_LAUNCH_PATH: MIRAGE_PATH,
    ECHO_MIRAGE_POWERFIST_PATH: POWERFIST_PATH,
    ECHO_MIRAGE_EMP_SQUAD: "1",
  },
});

electron.on("exit", (code) => process.exit(code ?? 0));
