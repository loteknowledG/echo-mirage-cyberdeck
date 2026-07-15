import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

function probeExtensionPanelWiring(): void {
  const mirage = read("src/components/cyberdeck/survey-mirage-pane.tsx");
  assert.ok(
    mirage.includes("SurveyMirageExtCapturePanel"),
    "Mirage pane must mount extension capture panel",
  );

  const panel = read("src/components/cyberdeck/survey-mirage-ext-capture-panel.tsx");
  assert.ok(panel.includes('data-testid="survey-mirage-ext-capture-panel"'));
  assert.ok(panel.includes("Capture active tab"));
  assert.ok(panel.includes("Refresh tabs"));
  assert.ok(!panel.toLowerCase().includes("hackerrank"), "panel copy must not mention HackerRank");
  assert.ok(!panel.toLowerCase().includes("surveillance"), "panel copy must not mention surveillance");

  const manifest = read("apps/echo-mirage-survey-extension/manifest.json");
  assert.ok(manifest.includes('"version": "0.2.3"'));
  assert.ok(!manifest.toLowerCase().includes("hackerrank"), "extension manifest must not mention HackerRank");

  const releaseNotes = read("scripts/desktop-release-notes.mjs");
  assert.ok(!releaseNotes.includes("Spy /"), "desktop release notes must not use Spy wording");
}

probeExtensionPanelWiring();
console.log("probe-survey-extension-panel: all checks passed");
