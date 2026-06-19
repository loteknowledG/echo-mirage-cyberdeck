import assert from "node:assert/strict";
import { executeMuthurChatTool } from "../src/lib/muthur-core/execute-openai-tool";
import { getMuthurOpenAiToolsForMode } from "../src/lib/muthur-core/openai-tool-definitions";
import { createMuthurToolRegistry } from "../src/lib/muthur-core/tool-registry";
import { createMuthurToolExecutionContext } from "../src/lib/muthur-core/types";
import {
  allowsOperatorPaneEdits,
  buildUplinkModeSystemPrompt,
  getMuthurUplinkCommitPolicy,
  isLocalFsWriteAllowedForUplinkMode,
  isToolAllowedForUplinkMode,
  normalizeMuthurUplinkMode,
  shouldAutoCommitOperatorEdits,
  shouldEnableToolsForUplinkMode,
  type MuthurUplinkMode,
} from "../src/lib/muthur-uplink-mode";

const MODES: MuthurUplinkMode[] = ["ask", "plan", "agent", "commander", "debug"];

async function main() {
  assert.equal(normalizeMuthurUplinkMode("agent"), "agent");
  assert.equal(normalizeMuthurUplinkMode("commander"), "commander");
  assert.equal(normalizeMuthurUplinkMode("unknown"), "plan");

  assert.equal(getMuthurUplinkCommitPolicy("agent"), "immediate");
  assert.equal(getMuthurUplinkCommitPolicy("debug"), "manual");
  assert.equal(getMuthurUplinkCommitPolicy("plan"), "never");
  assert.equal(getMuthurUplinkCommitPolicy("ask"), "never");

  assert.equal(allowsOperatorPaneEdits("agent"), true);
  assert.equal(allowsOperatorPaneEdits("debug"), true);
  assert.equal(allowsOperatorPaneEdits("commander"), true);
  assert.equal(allowsOperatorPaneEdits("plan"), false);
  assert.equal(allowsOperatorPaneEdits("ask"), false);

  assert.equal(shouldAutoCommitOperatorEdits("agent"), true);
  assert.equal(shouldAutoCommitOperatorEdits("commander"), true);
  assert.equal(shouldAutoCommitOperatorEdits("debug"), false);
  assert.equal(shouldAutoCommitOperatorEdits("plan"), false);

  assert.equal(isLocalFsWriteAllowedForUplinkMode("agent", "write"), true);
  assert.equal(isLocalFsWriteAllowedForUplinkMode("commander", "write"), true);
  assert.equal(isLocalFsWriteAllowedForUplinkMode("debug", "write"), false);
  assert.equal(isLocalFsWriteAllowedForUplinkMode("agent", "cat"), true);

  for (const mode of MODES) {
    assert.match(buildUplinkModeSystemPrompt(mode), /UPLINK MODE/i);
  }

  assert.equal(shouldEnableToolsForUplinkMode("agent", "hi"), true);
  assert.equal(shouldEnableToolsForUplinkMode("debug", "hey"), true);
  assert.equal(shouldEnableToolsForUplinkMode("plan", "hi"), false);
  assert.equal(shouldEnableToolsForUplinkMode("ask", "hi"), false);
  assert.equal(shouldEnableToolsForUplinkMode("commander", "hi"), false);
  assert.equal(shouldEnableToolsForUplinkMode("commander", "hi", { missionActive: true }), true);

  const askTools = getMuthurOpenAiToolsForMode("ask");
  const planTools = getMuthurOpenAiToolsForMode("plan");
  const debugTools = getMuthurOpenAiToolsForMode("debug");
  const agentTools = getMuthurOpenAiToolsForMode("agent");
  const commanderToolsBlocked = getMuthurOpenAiToolsForMode("commander");
  const commanderToolsActive = getMuthurOpenAiToolsForMode("commander", { missionActive: true });

  assert.equal(askTools.length, 0);
  assert.equal(planTools.length, 0);
  assert.equal(commanderToolsBlocked.length, 0);
  assert.deepEqual(commanderToolsActive.map((tool) => tool.function.name).sort(), agentTools.map((tool) => tool.function.name).sort());
  assert.ok(agentTools.length > askTools.length);
  assert.ok(debugTools.length > askTools.length);
  assert.ok(agentTools.length > debugTools.length);

  for (const tool of agentTools) {
    assert.ok(isToolAllowedForUplinkMode("agent", tool.function.name));
  }
  assert.ok(agentTools.some((tool) => tool.function.name === "localfs"));
  assert.ok(debugTools.some((tool) => tool.function.name === "suggest_operator_edit"));
  assert.ok(debugTools.some((tool) => tool.function.name === "localfs"));
  assert.ok(!isToolAllowedForUplinkMode("commander", "git_status"));
  assert.ok(isToolAllowedForUplinkMode("commander", "git_status", { missionActive: true }));

  const registry = createMuthurToolRegistry();
  const planCtx = createMuthurToolExecutionContext("plan");
  const askCtx = createMuthurToolExecutionContext("ask");
  const debugCtx = createMuthurToolExecutionContext("debug");
  const agentCtx = createMuthurToolExecutionContext("agent");
  const commanderCtx = createMuthurToolExecutionContext("commander");

  const planExec = await executeMuthurChatTool(
    registry,
    "workspace_exec",
    JSON.stringify({ command: "pnpm exec tsc --noEmit" }),
    planCtx,
  );
  assert.match(planExec, /\[TOOL BLOCKED\] workspace_exec/);

  const planEdit = await executeMuthurChatTool(
    registry,
    "suggest_operator_edit",
    JSON.stringify({ kind: "replace_content", text: "probe" }),
    planCtx,
  );
  assert.match(planEdit, /\[TOOL BLOCKED\] suggest_operator_edit/);

  const askGit = await executeMuthurChatTool(registry, "git_status", "{}", askCtx);
  assert.match(askGit, /\[TOOL BLOCKED\] git_status/);

  const askEdit = await executeMuthurChatTool(
    registry,
    "suggest_operator_edit",
    JSON.stringify({ kind: "replace_content", text: "probe" }),
    askCtx,
  );
  assert.match(askEdit, /\[TOOL BLOCKED\] suggest_operator_edit/);

  const debugExec = await executeMuthurChatTool(
    registry,
    "workspace_exec",
    JSON.stringify({ command: "git status --short" }),
    debugCtx,
  );
  assert.doesNotMatch(debugExec, /\[TOOL BLOCKED\]/);

  const debugLocalfs = await executeMuthurChatTool(
    registry,
    "localfs",
    JSON.stringify({ action: "write", path: ".tmp/phase-c-probe.txt", content: "x" }),
    debugCtx,
  );
  assert.match(debugLocalfs, /localfs write requires Agent uplink mode/i);

  const agentGit = await executeMuthurChatTool(registry, "git_status", "{}", agentCtx);
  assert.match(agentGit, /GIT_STATUS/);

  const agentRead = await executeMuthurChatTool(
    registry,
    "localfs",
    JSON.stringify({ action: "cat", path: "package.json" }),
    agentCtx,
  );
  assert.match(agentRead, /LOCALFS|package\.json/i);

  const commanderGitBlocked = await executeMuthurChatTool(registry, "git_status", "{}", commanderCtx);
  assert.match(commanderGitBlocked, /\[TOOL BLOCKED\] git_status/);

  console.log(
    `[probe] tool counts ask/plan/debug/agent/commander(active) = ${askTools.length}/${planTools.length}/${debugTools.length}/${agentTools.length}/${commanderToolsActive.length}`,
  );
  console.log("probe-muthur-phase-c-uplink-mode: PASS");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
