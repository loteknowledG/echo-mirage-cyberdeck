import {
  classifyWindowTitle,
  formatSurfaceResponse,
  getSurfaceEmoji,
  getAllSurfaceTypes,
  type SurfaceType,
} from "../src/lib/computer-use/surface-classifier";
import {
  setLastSurfaceClassification,
  getLastSurfaceClassification,
  clearSurfaceInspection,
  hasRecentInspection,
  getInspectionSummary,
  getLastCaptureTimestamp,
} from "../src/lib/computer-use/inspect-layer";

function assert(name: string, condition: boolean, detail?: unknown) {
  if (!condition) {
    console.error(`FAIL ${name}`, detail ?? "");
    process.exitCode = 1;
    return;
  }
  console.log(`PASS ${name}`);
}

function main() {
  clearSurfaceInspection();

  assert("classify ChatGPT window title", classifyWindowTitle("ChatGPT - new chat").surface === "chatgpt");
  assert("classify ChatGPT chat.openai.com", classifyWindowTitle("chat.openai.com/c/abc").surface === "chatgpt");
  assert("classify OpenCode window", classifyWindowTitle("OpenCode - F:\\dev\\my-project").surface === "opencode");
  assert("classify OpenCode URL", classifyWindowTitle("opencode.ai").surface === "opencode");
  assert("classify VS Code window", classifyWindowTitle("app.js - my-project - Visual Studio Code").surface === "vscode");
  assert("classify VS Code insiders", classifyWindowTitle("index.ts - vscode-insiders").surface === "vscode");
  assert("classify Terminal PowerShell", classifyWindowTitle("Windows PowerShell").surface === "terminal");
  assert("classify Terminal cmd", classifyWindowTitle("C:\\Windows\\System32\\cmd.exe").surface === "terminal");
  assert("classify Terminal bash", classifyWindowTitle("bash - ~/projects").surface === "terminal");
  assert("classify browser Chrome", classifyWindowTitle("Google Chrome").surface === "browser");
  assert("classify browser Firefox", classifyWindowTitle("Mozilla Firefox").surface === "browser");
  assert("classify Codex Cursor", classifyWindowTitle("Cursor - my-project").surface === "codex");
assert("classify Codex GitHub Copilot", classifyWindowTitle("GitHub Copilot").surface === "codex");
  assert("classify Codex Cursor", classifyWindowTitle("Cursor - my-project").surface === "codex");
  assert("classify Codex Replit", classifyWindowTitle("Replit").surface === "codex");
  const mediumConf = classifyWindowTitle("Chat - new chat window");
  assert("new chat keyword medium confidence", mediumConf.confidence === "medium");

  const response = formatSurfaceResponse(classifyWindowTitle("ChatGPT - new chat"));
  assert("formatSurfaceResponse mentions ChatGPT", response.includes("ChatGPT"));

  const unknownResp = formatSurfaceResponse(classifyWindowTitle("something random"));
  assert("formatSurfaceResponse unknown gives fallback", unknownResp.includes("don't recognize"));

  assert("getSurfaceEmoji terminal", getSurfaceEmoji("terminal") === "Terminal");
  assert("getSurfaceEmoji vscode", getSurfaceEmoji("vscode") === "VS Code");
  assert("getSurfaceEmoji unknown", getSurfaceEmoji("unknown") === "Unknown");

  const allTypes = getAllSurfaceTypes();
  assert("getAllSurfaceTypes returns 7 types", allTypes.length === 7);
  assert("getAllSurfaceTypes includes opencode", allTypes.includes("opencode"));
  assert("getAllSurfaceTypes includes codex", allTypes.includes("codex"));

  setLastSurfaceClassification(classifyWindowTitle("ChatGPT - new chat"));
  const stored = getLastSurfaceClassification();
  assert("getLastSurfaceClassification returns classification", stored !== null && stored.surface === "chatgpt");
  assert("hasRecentInspection true right after", hasRecentInspection());
  assert("hasRecentInspection false after long timeout", !hasRecentInspection(0));

  const summary = getInspectionSummary();
  assert("getInspectionSummary returns classified=true", summary.classified === true);
  assert("getInspectionSummary surface is chatgpt", summary.surface === "chatgpt");
  assert("getInspectionSummary has timestamp", summary.timestamp !== null);
  assert("getInspectionSummary has source", summary.source === null);

  clearSurfaceInspection();
  const afterClear = getLastSurfaceClassification();
  assert("clearSurfaceInspection clears classification", afterClear === null);
  assert("getInspectionSummary after clear is unclassified", !getInspectionSummary().classified);

  const files = [
    "src/lib/computer-use/surface-classifier.ts",
    "src/lib/computer-use/inspect-layer.ts",
  ];
  const { readFileSync } = require("node:fs");
  const { join } = require("node:path");
  const source = files.map((f) => readFileSync(join(process.cwd(), f), "utf8")).join("\n");
  assert("surface awareness: no synthetic input dispatch", !/\bdispatchEvent\b|\bnew\s+MouseEvent\b|\bnew\s+KeyboardEvent\b/.test(source));
  assert("surface awareness: no clipboard write", !/\bclipboardData\.setData\b|\bcopyToClipboard\b/.test(source));
  assert("surface awareness: no window focus", !/\.focus\(\)/.test(source));
  assert("surface awareness: no click injection", !/\.click\(\)/.test(source));
}

void main();