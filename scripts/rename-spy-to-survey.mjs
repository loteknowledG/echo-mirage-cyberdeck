import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");

const FILE_RENAMES = [
  ["src/lib/cyberdeck/espionage-mode.ts", "src/lib/cyberdeck/survey-mode.ts"],
  ["src/lib/cyberdeck/espionage-chat.ts", "src/lib/cyberdeck/survey-chat.ts"],
  ["src/lib/cyberdeck/spy-echo-discovery.client.ts", "src/lib/cyberdeck/survey-echo-discovery.client.ts"],
  ["src/lib/cyberdeck/spy-team-status.ts", "src/lib/cyberdeck/survey-team-status.ts"],
  ["src/lib/cyberdeck/use-spy-team-status.ts", "src/lib/cyberdeck/use-survey-team-status.ts"],
  ["src/lib/cyberdeck/spy-pairing-client.ts", "src/lib/cyberdeck/survey-pairing-client.ts"],
  ["src/lib/cyberdeck/spy-pair-pin.ts", "src/lib/cyberdeck/survey-pair-pin.ts"],
  ["src/lib/cyberdeck/spy-echo-link-watch.ts", "src/lib/cyberdeck/survey-echo-link-watch.ts"],
  ["src/lib/server/spy-echo-pairing.server.ts", "src/lib/server/survey-echo-pairing.server.ts"],
  ["src/lib/server/spy-echo-discovery.server.ts", "src/lib/server/survey-echo-discovery.server.ts"],
  ["src/lib/server/spy-analyze.server.ts", "src/lib/server/survey-analyze.server.ts"],
  ["src/components/cyberdeck/espionage-mirage-hub-panel.tsx", "src/components/cyberdeck/survey-mirage-hub-panel.tsx"],
  ["src/components/cyberdeck/espionage-solutions-panel.tsx", "src/components/cyberdeck/survey-solutions-panel.tsx"],
  ["src/components/cyberdeck/spy-pane-body.tsx", "src/components/cyberdeck/survey-pane-body.tsx"],
  ["src/components/cyberdeck/spy-sub-rail.tsx", "src/components/cyberdeck/survey-sub-rail.tsx"],
  ["src/components/cyberdeck/spy-rail-icon.tsx", "src/components/cyberdeck/survey-rail-icon.tsx"],
  ["src/components/cyberdeck/spy-echo-pane.tsx", "src/components/cyberdeck/survey-echo-pane.tsx"],
  ["src/components/cyberdeck/spy-mirage-pane.tsx", "src/components/cyberdeck/survey-mirage-pane.tsx"],
  ["src/components/cyberdeck/spy-powerfist-pane.tsx", "src/components/cyberdeck/survey-powerfist-pane.tsx"],
  ["src/components/cyberdeck/spy-desktop-install-panel.tsx", "src/components/cyberdeck/survey-desktop-install-panel.tsx"],
  ["src/components/cyberdeck/spy-pair-pin-form.tsx", "src/components/cyberdeck/survey-pair-pin-form.tsx"],
  ["src/components/cyberdeck/spy-pair-otp-input.tsx", "src/components/cyberdeck/survey-pair-otp-input.tsx"],
  ["src/components/cyberdeck/spy-team-status-panel.tsx", "src/components/cyberdeck/survey-team-status-panel.tsx"],
  ["src/features/cyberdeck/pane-loaders/survey.tsx", "src/features/cyberdeck/pane-loaders/survey.tsx"],
];

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

for (const [from, to] of FILE_RENAMES) {
  if (!fs.existsSync(from)) continue;
  fs.mkdirSync(path.dirname(to), { recursive: true });
  if (fs.existsSync(to)) fs.unlinkSync(to);
  fs.renameSync(from, to);
  console.log("renamed", from, "->", to);
}

const apiFrom = "src/app/api/spy";
const apiTo = "src/app/api/survey";
if (fs.existsSync(apiFrom)) {
  if (fs.existsSync(apiTo)) fs.rmSync(apiTo, { recursive: true, force: true });
  copyDir(apiFrom, apiTo);
  fs.rmSync(apiFrom, { recursive: true, force: true });
  console.log("moved api/spy -> api/survey");
}

const REPLACEMENTS = [
  ["@/lib/cyberdeck/survey-chat", "@/lib/cyberdeck/survey-chat"],
  ["@/lib/cyberdeck/survey-mode", "@/lib/cyberdeck/survey-mode"],
  ["@/lib/server/survey-echo-discovery.server", "@/lib/server/survey-echo-discovery.server"],
  ["@/lib/server/survey-echo-pairing.server", "@/lib/server/survey-echo-pairing.server"],
  ["@/lib/server/survey-analyze.server", "@/lib/server/survey-analyze.server"],
  ["@/lib/cyberdeck/survey-echo-discovery.client", "@/lib/cyberdeck/survey-echo-discovery.client"],
  ["@/lib/cyberdeck/survey-team-status", "@/lib/cyberdeck/survey-team-status"],
  ["@/lib/cyberdeck/use-survey-team-status", "@/lib/cyberdeck/use-survey-team-status"],
  ["@/lib/cyberdeck/survey-pairing-client", "@/lib/cyberdeck/survey-pairing-client"],
  ["@/lib/cyberdeck/survey-echo-link-watch", "@/lib/cyberdeck/survey-echo-link-watch"],
  ["@/lib/cyberdeck/survey-pair-pin", "@/lib/cyberdeck/survey-pair-pin"],
  ["@/components/cyberdeck/survey-solutions-panel", "@/components/cyberdeck/survey-solutions-panel"],
  ["@/components/cyberdeck/survey-mirage-hub-panel", "@/components/cyberdeck/survey-mirage-hub-panel"],
  ["@/components/cyberdeck/survey-team-status-panel", "@/components/cyberdeck/survey-team-status-panel"],
  ["@/components/cyberdeck/survey-pane-body", "@/components/cyberdeck/survey-pane-body"],
  ["@/components/cyberdeck/survey-sub-rail", "@/components/cyberdeck/survey-sub-rail"],
  ["@/components/cyberdeck/survey-rail-icon", "@/components/cyberdeck/survey-rail-icon"],
  ["@/components/cyberdeck/survey-echo-pane", "@/components/cyberdeck/survey-echo-pane"],
  ["@/components/cyberdeck/survey-mirage-pane", "@/components/cyberdeck/survey-mirage-pane"],
  ["@/components/cyberdeck/survey-powerfist-pane", "@/components/cyberdeck/survey-powerfist-pane"],
  ["@/components/cyberdeck/survey-desktop-install-panel", "@/components/cyberdeck/survey-desktop-install-panel"],
  ["@/components/cyberdeck/survey-pair-pin-form", "@/components/cyberdeck/survey-pair-pin-form"],
  ["@/components/cyberdeck/survey-pair-otp-input", "@/components/cyberdeck/survey-pair-otp-input"],
  ["pane-loaders/survey", "pane-loaders/survey"],
  ["/api/survey/", "/api/survey/"],
  ["SurveySolutionsPanel", "SurveySolutionsPanel"],
  ["SurveyMirageHubPanel", "SurveyMirageHubPanel"],
  ["SurveyChat", "SurveyChat"],
  ["SURVEY_MISSION_SOLVE_EVENT", "SURVEY_MISSION_SOLVE_EVENT"],
  ["SURVEY_SILENT_CAPTURE_PROMPT", "SURVEY_SILENT_CAPTURE_PROMPT"],
  ["SurveyMissionSolveDetail", "SurveyMissionSolveDetail"],
  ["SurveyMissionEnvelope", "SurveyMissionEnvelope"],
  ["SurveyMissionKind", "SurveyMissionKind"],
  ["ECHO_SURVEY_TERMINATED_MESSAGE", "ECHO_SURVEY_TERMINATED_MESSAGE"],
  ["SURVEY_ECHO_LINK_CHANNEL", "SURVEY_ECHO_LINK_CHANNEL"],
  ["SURVEY_MIRAGE_PAIR_STORAGE_KEY", "SURVEY_MIRAGE_PAIR_STORAGE_KEY"],
  ["SURVEY_POWERFIST_PAIR_STORAGE_KEY", "SURVEY_POWERFIST_PAIR_STORAGE_KEY"],
  ["SURVEY_PAIR_PIN_LENGTH", "SURVEY_PAIR_PIN_LENGTH"],
  ["SURVEY_MODE_STORAGE_KEY", "SURVEY_MODE_STORAGE_KEY"],
  ["SURVEY_NODE_ID_STORAGE_KEY", "SURVEY_NODE_ID_STORAGE_KEY"],
  ["SURVEY_POWERFIST_HINT", "SURVEY_POWERFIST_HINT"],
  ["SURVEY_POWERFIST_DISPLAY", "SURVEY_POWERFIST_DISPLAY"],
  ["SURVEY_POWERFIST_LABEL", "SURVEY_POWERFIST_LABEL"],
  ["SURVEY_MIRAGE_NODE_LABEL", "SURVEY_MIRAGE_NODE_LABEL"],
  ["SURVEY_ECHO_NODE_LABEL", "SURVEY_ECHO_NODE_LABEL"],
  ["SURVEY_MIRAGE_TAGLINE", "SURVEY_MIRAGE_TAGLINE"],
  ["SURVEY_POWERFIST_TAGLINE", "SURVEY_POWERFIST_TAGLINE"],
  ["SURVEY_ECHO_TAGLINE", "SURVEY_ECHO_TAGLINE"],
  ["SURVEY_MIRAGE_DISPLAY", "SURVEY_MIRAGE_DISPLAY"],
  ["SURVEY_ECHO_DISPLAY", "SURVEY_ECHO_DISPLAY"],
  ["SURVEY_MODE_TITLE", "SURVEY_MODE_TITLE"],
  ["SURVEY_MODE_SHORT", "SURVEY_MODE_SHORT"],
  ["SURVEY_ROLE_MIRAGE", "SURVEY_ROLE_MIRAGE"],
  ["SURVEY_ROLE_ECHO", "SURVEY_ROLE_ECHO"],
  ["SurveyNodeRole", "SurveyNodeRole"],
  ["SurveySubPane", "SurveySubPane"],
  ["SurveyTeamStatusPanel", "SurveyTeamStatusPanel"],
  ["SurveyTeamStatus", "SurveyTeamStatus"],
  ["useSurveyTeamStatus", "useSurveyTeamStatus"],
  ["SurveyPairedMirage", "SurveyPairedMirage"],
  ["EchoSurveyStatusSource", "EchoSurveyStatusSource"],
  ["EchoSurveyStatus", "EchoSurveyStatus"],
  ["readEchoSurveyPayload", "readEchoSurveyPayload"],
  ["fetchEchoSurveyStatus", "fetchEchoSurveyStatus"],
  ["fetchEchoRemoteSurveyStatusClient", "fetchEchoRemoteSurveyStatusClient"],
  ["surveyLinksReachable", "surveyLinksReachable"],
  ["SurveyPairPinForm", "SurveyPairPinForm"],
  ["SurveyPairOtpInput", "SurveyPairOtpInput"],
  ["SurveyDesktopInstallPanel", "SurveyDesktopInstallPanel"],
  ["SurveyPowerfistPane", "SurveyPowerfistPane"],
  ["SurveyMiragePane", "SurveyMiragePane"],
  ["SurveyEchoPane", "SurveyEchoPane"],
  ["SurveyRailIcon", "SurveyRailIcon"],
  ["SurveySubRail", "SurveySubRail"],
  ["CyberdeckSurveyPaneBody", "CyberdeckSurveyPaneBody"],
  ["terminateEchoSurveySession", "terminateEchoSurveySession"],
  ["fetchEchoSurveyLinkStatus", "fetchEchoSurveyLinkStatus"],
  ["regenerateEchoSurveyCodes", "regenerateEchoSurveyCodes"],
  ["fetchEchoSurveyCodes", "fetchEchoSurveyCodes"],
  ["enterSurveyPairPin", "enterSurveyPairPin"],
  ["enterSurveyPairCode", "enterSurveyPairCode"],
  ["saveSurveyMiragePairCredentials", "saveSurveyMiragePairCredentials"],
  ["saveSurveyPowerfistPairCredentials", "saveSurveyPowerfistPairCredentials"],
  ["readSurveyMiragePairCredentials", "readSurveyMiragePairCredentials"],
  ["readSurveyPowerfistPairCredentials", "readSurveyPowerfistPairCredentials"],
  ["clearSurveyMiragePairCredentials", "clearSurveyMiragePairCredentials"],
  ["clearSurveyPowerfistPairCredentials", "clearSurveyPowerfistPairCredentials"],
  ["broadcastSurveyEchoTerminated", "broadcastSurveyEchoTerminated"],
  ["normalizeSurveyPairPin", "normalizeSurveyPairPin"],
  ["isValidSurveyPairPin", "isValidSurveyPairPin"],
  ["useSurveyEchoLinkWatch", "useSurveyEchoLinkWatch"],
  ["getEchoSurveyPairingStatus", "getEchoSurveyPairingStatus"],
  ["refreshEchoSurveyPairCodes", "refreshEchoSurveyPairCodes"],
  ["checkEchoSurveyLinkStatus", "checkEchoSurveyLinkStatus"],
  ["completeSurveyPairEnter", "completeSurveyPairEnter"],
  ["parseSurveyPairCode", "parseSurveyPairCode"],
  ["formatSurveyPairCode", "formatSurveyPairCode"],
  ["activateEchoSurveySession", "activateEchoSurveySession"],
  ["analyzeSurveyCapture", "analyzeSurveyCapture"],
  ["DEFAULT_SURVEY_PROMPT", "DEFAULT_SURVEY_PROMPT"],
  ["getOrCreateSurveyNodeId", "getOrCreateSurveyNodeId"],
  ["readSurveyNodeRole", "readSurveyNodeRole"],
  ["writeSurveyNodeRole", "writeSurveyNodeRole"],
  ["surveyTeamSummary", "surveyTeamSummary"],
  ["surveyRoleLabel", "surveyRoleLabel"],
  ["handleSurveyMissionSolve", "handleSurveyMissionSolve"],
  ["sendSurveyCaptureMission", "sendSurveyCaptureMission"],
  ["echoSurveyActive", "echoSurveyActive"],
  ["EchoSurveyPairingState", "EchoSurveyPairingState"],
  ["SurveyPairRole", "SurveyPairRole"],
  ["isSurveyTab", "isSurveyTab"],
  ["hasSurveyTab", "hasSurveyTab"],
  ['kind: "survey"', 'kind: "survey"'],
  ['"survey"', '"survey"'],
  ["SURVEY MODE", "SURVEY MODE"],
  ["Survey Mode", "Survey Mode"],
  ["Survey off", "Survey off"],
  ["Survey pairing", "Survey pairing"],
  ["Survey Capture", "Survey Capture"],
  ["Survey sub-panes", "Survey sub-panes"],
  ["Survey rail tab", "Survey rail tab"],
  ["Survey tab", "Survey tab"],
  ["Open Survey", "Open Survey"],
  ["survey mission", "survey mission"],
  ["echo-mirage:survey-mission-solve", "echo-mirage:survey-mission-solve"],
  ["echo-mirage-survey-mirage-pair", "echo-mirage-survey-mirage-pair"],
  ["echo-mirage-survey-powerfist-pair", "echo-mirage-survey-powerfist-pair"],
  ["echo-mirage-survey-role", "echo-mirage-survey-role"],
  ["echo-mirage-survey-node-id", "echo-mirage-survey-node-id"],
  ["echo-survey-terminated", "echo-survey-terminated"],
  ["echo-mirage-survey-echo-link", "echo-mirage-survey-echo-link"],
  ["settings-survey-mode", "settings-survey-mode"],
  ["SURVEY_VISION_MODEL", "SURVEY_VISION_MODEL"],
  [".survey-sub-rail", ".survey-sub-rail"],
  [".cyberdeck-survey-pane", ".cyberdeck-survey-pane"],
  ["Could not load Echo Survey", "Could not load Echo Survey"],
  ["Echo Survey session", "Echo Survey session"],
  ["Survey capture", "Survey capture"],
  ["Survey vision", "Survey vision"],
  ["OS capture", "OS capture"],
  ["capture", "capture"],
  ["Answer desk", "Answer desk"],
  ["MUTHUR solves from", "MUTHUR solves from"],
];

const SKIP_DIRS = new Set(["node_modules", ".next", ".next-dev", "dist-electron", ".git"]);

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (/\.(tsx?|jsx?|mjs|css|md|json)$/.test(entry.name)) files.push(full);
  }
  return files;
}

let changed = 0;
for (const file of walk(ROOT)) {
  let text = fs.readFileSync(file, "utf8");
  const original = text;
  for (const [from, to] of REPLACEMENTS) text = text.split(from).join(to);
  if (text !== original) {
    fs.writeFileSync(file, text, "utf8");
    changed++;
  }
}
console.log("content updated in", changed, "files");
