#!/usr/bin/env node
/**
 * Parse `vercel inspect <url> --logs` output into Quest 2 phase timings.
 * Usage: vercel inspect <deployment-url> --logs 2>&1 | node scripts/quest2-vercel-phase-parse.mjs
 *    or: node scripts/quest2-vercel-phase-parse.mjs --file path/to.log
 */

import { readFileSync } from "node:fs";

function parseIso(line) {
  const m = line.match(/^(\d{4}-\d{2}-\d{2}T[\d:.]+Z)/);
  return m ? Date.parse(m[1]) : null;
}

function secondsBetween(a, b) {
  if (a == null || b == null) return null;
  return Math.round((b - a) / 1000);
}

function parseLog(text) {
  const lines = text.split(/\r?\n/);
  const marks = {};

  for (const line of lines) {
    const t = parseIso(line);
    if (t == null) continue;
    if (line.includes("Running build in")) marks.buildStart = t;
    if (line.includes("Cloning github.com")) marks.cloneStart = t;
    if (line.includes("Cloning completed:")) marks.cloneEnd = t;
    if (line.includes('Running "install" command')) marks.installStart = t;
    if (line.includes("Done in") && line.includes("pnpm")) marks.installEnd = t;
    if (line.includes("Running \"pnpm run build\"") || line.includes("Running \"pnpm run build\""))
      marks.nextBuildStart = t;
    if (line.includes("Creating an optimized production build")) marks.webpackStart = t;
    if (line.includes("Compiled with warnings") || line.includes("✓ Compiled"))
      marks.webpackEnd = t;
    if (line.includes("Build Completed in /vercel/output")) marks.buildOutputComplete = t;
    if (line.includes("Deploying outputs...")) marks.uploadStart = t;
    if (line.includes("Deployment completed")) marks.uploadEnd = t;
    if (line.includes("Build Completed") && marks.buildOutputComplete == null) marks.buildOutputComplete = t;
    if (line.includes("Deployment completed") && marks.deployEnd == null) marks.deployEnd = t;
  }

  const phases = {
    queue_and_clone_s: secondsBetween(marks.buildStart, marks.cloneEnd),
    install_s: secondsBetween(marks.installStart, marks.installEnd),
    preprocessing_s: secondsBetween(marks.installEnd, marks.webpackStart),
    next_build_webpack_s: secondsBetween(marks.webpackStart, marks.webpackEnd),
    post_compile_and_traces_s: secondsBetween(
      marks.webpackEnd,
      marks.buildOutputComplete ?? marks.uploadStart,
    ),
    upload_and_finalize_s: secondsBetween(marks.uploadStart, marks.uploadEnd),
    total_wall_s: secondsBetween(marks.buildStart, marks.uploadEnd ?? marks.deployEnd),
  };

  return { marks, phases };
}

function main() {
  const fileIdx = process.argv.indexOf("--file");
  const text =
    fileIdx >= 0
      ? readFileSync(process.argv[fileIdx + 1], "utf8")
      : readFileSync(0, "utf8");

  const { marks, phases } = parseLog(text);
  const out = {
    deployment: process.env.QUEST2_DEPLOYMENT_ID ?? null,
    commit: process.env.QUEST2_COMMIT ?? null,
    phases,
    marks: Object.fromEntries(
      Object.entries(marks).map(([k, v]) => [k, new Date(v).toISOString()]),
    ),
  };
  console.log(JSON.stringify(out, null, 2));
}

main();
