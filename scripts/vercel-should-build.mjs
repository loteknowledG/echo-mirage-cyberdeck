#!/usr/bin/env node
/**
 * Vercel ignoreCommand decision (Quest 2 Exp 5).
 *
 * Exit 0 → skip deployment (no Cyberdeck runtime impact).
 * Exit 1 → run full build (default for ambiguous or runtime changes).
 *
 * @see docs/engineering/quest2-exp5-deploy-skip.md
 */

import { execSync } from "node:child_process";

/** Paths that never affect the deployed Cyberdeck Next.js runtime (Exp 5 initial). */
const SKIP_ONLY_PREFIXES = ["docs/engineering/"];

/** Changing these always forces a build (including the skip machinery itself). */
const FORCE_BUILD_PREFIXES = [
  "src/",
  "public/",
  "assets/",
  "scripts/",
  "apps/",
  "vercel.json",
  "next.config.mjs",
  "package.json",
  "pnpm-lock.yaml",
  "tsconfig.json",
  "tsconfig.*.json",
  "tailwind.config.",
  "postcss.config.",
  "middleware.ts",
  "instrumentation.ts",
  "eslint.config.",
  "playwright.config.",
];

const FORCE_BUILD_EXACT = new Set([
  "vercel.json",
  "next.config.mjs",
  "package.json",
  "pnpm-lock.yaml",
  "middleware.ts",
  "instrumentation.ts",
]);

function normalizePath(filePath) {
  return filePath.replace(/\\/g, "/").replace(/^\.\//, "");
}

function matchesPrefix(normalized, prefix) {
  if (prefix.endsWith(".")) {
    return normalized.startsWith(prefix) || normalized.includes(`/${prefix}`);
  }
  return normalized === prefix || normalized.startsWith(prefix);
}

function isForceBuildPath(normalized) {
  if (FORCE_BUILD_EXACT.has(normalized)) return true;
  return FORCE_BUILD_PREFIXES.some((prefix) => matchesPrefix(normalized, prefix));
}

function isSkipOnlyPath(normalized) {
  return SKIP_ONLY_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

/**
 * @param {string[]} changedFiles
 * @returns {{ build: boolean; reason: string; changedFiles: string[] }}
 */
export function decideBuild(changedFiles) {
  const files = [...new Set(changedFiles.map(normalizePath).filter(Boolean))];

  if (files.length === 0) {
    return { build: true, reason: "no changed files detected — default build", changedFiles: files };
  }

  for (const file of files) {
    if (isForceBuildPath(file)) {
      return { build: true, reason: `runtime or build path changed: ${file}`, changedFiles: files };
    }
  }

  const nonSkip = files.filter((file) => !isSkipOnlyPath(file));
  if (nonSkip.length === 0) {
    return {
      build: false,
      reason: "engineering docs / benchmark receipts only",
      changedFiles: files,
    };
  }

  return {
    build: true,
    reason: `ambiguous or non-engineering path changed: ${nonSkip[0]}`,
    changedFiles: files,
  };
}

function gitChangedFiles() {
  const previous = process.env.VERCEL_GIT_PREVIOUS_SHA?.trim();
  const current = process.env.VERCEL_GIT_COMMIT_SHA?.trim();

  if (!previous || !current) {
    return { files: null, meta: "missing VERCEL_GIT_PREVIOUS_SHA or VERCEL_GIT_COMMIT_SHA" };
  }

  if (previous === current) {
    return { files: [], meta: "previous SHA equals current SHA" };
  }

  const out = execSync(`git diff --name-only ${previous} ${current}`, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return {
    files: out
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean),
    meta: `git diff ${previous.slice(0, 7)}..${current.slice(0, 7)}`,
  };
}

function parseSimulateArgs(argv) {
  const simulateIdx = argv.indexOf("--simulate");
  if (simulateIdx === -1) return null;
  const rest = argv.slice(simulateIdx + 1).filter((arg) => !arg.startsWith("-"));
  if (rest.length === 0) return [];
  if (rest[0].includes(",")) {
    return rest[0].split(",").map((part) => part.trim()).filter(Boolean);
  }
  return rest;
}

function main() {
  const simulated = parseSimulateArgs(process.argv);
  let changedFiles;
  let meta = "simulate";

  if (simulated !== null) {
    changedFiles = simulated;
  } else {
    const git = gitChangedFiles();
    meta = git.meta;
    if (git.files === null) {
      console.log("[vercel-should-build] BUILD —", meta);
      process.exit(1);
    }
    changedFiles = git.files;
  }

  const decision = decideBuild(changedFiles);
  const action = decision.build ? "BUILD" : "SKIP";

  console.log(`[vercel-should-build] ${action} — ${decision.reason}`);
  if (decision.changedFiles.length > 0) {
    console.log(`[vercel-should-build] files (${decision.changedFiles.length}):`);
    for (const file of decision.changedFiles) {
      console.log(`  - ${file}`);
    }
  }
  if (simulated !== null) {
    console.log(`[vercel-should-build] mode=simulate meta=${meta}`);
  } else {
    console.log(`[vercel-should-build] mode=vercel meta=${meta}`);
  }

  process.exit(decision.build ? 1 : 0);
}

const isMain =
  process.argv[1] &&
  (process.argv[1].endsWith("vercel-should-build.mjs") ||
    process.argv[1].endsWith("vercel-should-build"));

if (isMain) {
  main();
}
