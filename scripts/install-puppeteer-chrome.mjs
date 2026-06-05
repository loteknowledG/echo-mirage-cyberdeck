import { spawnSync } from "node:child_process";

const result = spawnSync("pnpm", ["exec", "puppeteer", "browsers", "install", "chrome"], {
  stdio: "inherit",
  shell: true,
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log("Puppeteer Chrome installed for PDF export.");
