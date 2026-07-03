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

await run("node", ["scripts/dev-stop.mjs"]);
await run("node", ["scripts/fix-electron.mjs"]);

console.log("[survey:local] Starting Echo Satellite on :3050…");

const satellite = spawn("pnpm satellite:dev", {
  cwd: root,
  stdio: "inherit",
  shell: true,
});

const stopAll = () => {
  satellite.kill("SIGTERM");
};

process.on("SIGINT", stopAll);
process.on("SIGTERM", stopAll);

await run("npx", ["wait-on", "http-get://127.0.0.1:3050/spy/status", "-t", "300000"]);
console.log("[survey:local] Satellite ready — starting cyberdeck (auto-port, usually :3052)…");
process.env.CYBERDECK_DEV_MIN_APP_PORT = "3052";

const { result } = concurrently(
  [
    { command: "node scripts/next-dev.mjs --webpack --auto-port", name: "next", prefixColor: "cyan" },
    { command: "node scripts/survey-local-electron.mjs", name: "electron", prefixColor: "magenta" },
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
