import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

await run("node", ["scripts/warm-cyberdeck.mjs"]);

const electron = spawn(isWindows ? "electron.cmd" : "electron", ["."], {
  cwd: root,
  stdio: "inherit",
  shell: isWindows,
});

electron.on("exit", (code) => process.exit(code ?? 0));
