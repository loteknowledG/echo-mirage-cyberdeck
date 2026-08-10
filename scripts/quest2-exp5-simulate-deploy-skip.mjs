#!/usr/bin/env node
/**
 * Quest 2 Exp 5 — local simulation matrix for vercel-should-build.mjs
 * Run before push; exit non-zero if any case fails.
 */

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const script = path.join(root, "vercel-should-build.mjs");

/** @type {{ label: string; files: string[]; expect: "BUILD" | "SKIP" }[]} */
const CASES = [
  {
    label: "engineering doc only",
    files: ["docs/engineering/quest2-exp5-deploy-skip.md"],
    expect: "SKIP",
  },
  {
    label: "benchmark util csv only",
    files: ["docs/engineering/quest2-results/exp1-b-warm-identical-util.csv"],
    expect: "SKIP",
  },
  {
    label: "engineering doc + receipt json",
    files: ["docs/engineering/quest2-measurements.json", "docs/engineering/build-baseline.md"],
    expect: "SKIP",
  },
  {
    label: "runtime src change",
    files: ["src/components/cyberdeck/cyberdeck-runtime-badge.tsx"],
    expect: "BUILD",
  },
  {
    label: "next.config change",
    files: ["next.config.mjs"],
    expect: "BUILD",
  },
  {
    label: "vercel.json change",
    files: ["vercel.json"],
    expect: "BUILD",
  },
  {
    label: "skip script change",
    files: ["scripts/vercel-should-build.mjs"],
    expect: "BUILD",
  },
  {
    label: "non-engineering doc (ambiguous)",
    files: ["docs/verifications/JP-L-UI-001A.md"],
    expect: "BUILD",
  },
  {
    label: "engineering doc + README",
    files: ["docs/engineering/quest2-status.md", "README.md"],
    expect: "BUILD",
  },
  {
    label: "package.json only",
    files: ["package.json"],
    expect: "BUILD",
  },
  {
    label: "empty change set",
    files: [],
    expect: "BUILD",
  },
];

let failed = 0;

for (const testCase of CASES) {
  const args = [script, "--simulate", ...testCase.files];
  const result = spawnSync(process.execPath, args, { encoding: "utf8" });
  const expectedExit = testCase.expect === "SKIP" ? 0 : 1;
  const pass = result.status === expectedExit;
  const mark = pass ? "PASS" : "FAIL";
  if (!pass) failed += 1;
  console.log(
    `${mark}  ${testCase.label}  expect=${testCase.expect}  exit=${result.status}`,
  );
  if (!pass && result.stdout) {
    console.log(result.stdout.trim());
  }
}

if (failed > 0) {
  console.error(`\n${failed} simulation(s) failed.`);
  process.exit(1);
}

console.log(`\nAll ${CASES.length} simulations passed.`);
