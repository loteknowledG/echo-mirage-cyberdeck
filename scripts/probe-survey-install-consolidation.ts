import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  CUSTOM_TAB_CONTEXT_MENU_ACTIONS,
  normalizeCustomTabKind,
  sanitizeCustomTabs,
} from "../src/features/cyberdeck/workspace/custom-tab-model";
import {
  CYBERDECK_PANE_KINDS,
  normalizeCyberdeckPaneKind,
} from "../src/features/cyberdeck/pane-registry";

const root = process.cwd();

async function source(relativePath: string): Promise<string> {
  return readFile(path.join(root, relativePath), "utf8");
}

async function main() {
  assert.equal(normalizeCustomTabKind("install"), "survey");
  assert.equal(normalizeCustomTabKind("install-desktop"), "survey");
  assert.equal(normalizeCyberdeckPaneKind("install"), "survey");
  assert.equal(CYBERDECK_PANE_KINDS.includes("install" as never), false);
  assert.equal(
    CUSTOM_TAB_CONTEXT_MENU_ACTIONS.some((action) => action.label === "Install"),
    false,
  );

  const migrated = sanitizeCustomTabs([
    { id: "echo-install-pane", label: "INSTALL", glyph: "I", kind: "install" },
  ]);
  assert.deepEqual(migrated, [
    {
      id: "echo-install-pane",
      label: "Survey",
      glyph: "◉",
      kind: "survey",
      browserUrl: undefined,
      asset: null,
    },
  ]);

  const hydration = await source(
    "src/features/cyberdeck/workspace/use-cyberdeck-workspace-hydration.ts",
  );
  assert.doesNotMatch(hydration, /kind:\s*["']install["']/);
  assert.doesNotMatch(hydration, /echo-install-pane/);

  const surveyPane = await source("src/components/cyberdeck/survey-pane-body.tsx");
  assert.match(surveyPane, /SurveyDesktopInstallPanel/);

  const surveyInstall = await source(
    "src/components/cyberdeck/survey-desktop-install-panel.tsx",
  );
  assert.match(surveyInstall, /Install or update Echo Satellite/);
  assert.match(surveyInstall, /Install optional desktop cyberdeck/);
  assert.match(surveyInstall, /Hosted Mirage does not require the full desktop Cyberdeck/);

  console.log("[probe:survey-install-consolidation] PASS");
}

main().catch((error) => {
  console.error("[probe:survey-install-consolidation] FAIL", error);
  process.exitCode = 1;
});
