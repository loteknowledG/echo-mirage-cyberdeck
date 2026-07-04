/**
 * EMP ignition — one command starts Echo Satellite + Mirage + PowerFist (all Electron).
 *
 *   pnpm survey:emp
 *
 * - Echo Satellite Electron (:3050) — Echo role
 * - Mirage desktop cyberdeck (:3052) — Survey Hub connect + Mirage sub-pane
 * - PowerFist second Electron window — same process, no browser
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import concurrently from "concurrently";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const isWindows = process.platform === "win32";

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      stdio: "inherit",
      shell: isWindows,
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited ${code}`));
    });
  });
}

console.log("[survey:emp] ═══ EMP IGNITION // Echo + Mirage + PowerFist ═══");
console.log("[survey:emp] Stopping prior dev processes…");
await run("node", ["scripts/dev-stop.mjs"]);
await run("node", ["scripts/fix-electron.mjs"]);

console.log("[survey:emp] Starting Echo Satellite on :3050…");
const satellite = spawn("pnpm satellite:dev", {
  cwd: root,
  stdio: "inherit",
  shell: true,
});

const stopAll = () => {
  satellite.kill("SIGTERM");
};

process.on("SIGINT", () => {
  stopAll();
  process.exit(130);
});
process.on("SIGTERM", () => {
  stopAll();
  process.exit(143);
});

await run("npx", ["wait-on", "http-get://127.0.0.1:3050/spy/status", "-t", "300000"]);
console.log("[survey:emp] Satellite ready — starting cyberdeck on :3052…");
process.env.CYBERDECK_DEV_MIN_APP_PORT = "3052";

const { result } = concurrently(
  [
    {
      command: "node scripts/next-dev.mjs --webpack --auto-port",
      name: "next",
      prefixColor: "cyan",
    },
    {
      command: "node scripts/survey-emp-mirage-electron.mjs",
      name: "squad",
      prefixColor: "magenta",
    },
  ],
  {
    cwd: root,
    killOthersOn: { success: false, failure: true },
  },
);

try {
  await result;
} finally {
  stopAll();
}
