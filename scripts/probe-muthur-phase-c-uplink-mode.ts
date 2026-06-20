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

const MODES: MuthurUplinkMode[] = ["plan", "agent", "commander"];

async function main() {
  assert.equal(normalizeMuthurUplinkMode("agent"), "agent");
  assert.equal(normalizeMuthurUplinkMode("commander"), "commander");
  assert.equal(normalizeMuthurUplinkMode("unknown"), "plan");
  assert.equal(normalizeMuthurUplinkMode("ask"), "plan");
  assert.equal(normalizeMuthurUplinkMode("debug"), "agent");

  assert.equal(getMuthurUplinkCommitPolicy("agent"), "immediate");
  assert.equal(getMuthurUplinkCommitPolicy("plan"), "never");
  assert.equal(getMuthurUplinkCommitPolicy("commander"), "immediate");

  assert.equal(allowsOperatorPaneEdits("agent"), true);
  assert.equal(allowsOperatorPaneEdits("commander"), true);
  assert.equal(allowsOperatorPaneEdits("plan"), false);

  assert.equal(shouldAutoCommitOperatorEdits("agent"), true);
  assert.equal(shouldAutoCommitOperatorEdits("commander"), true);
  assert.equal(shouldAutoCommitOperatorEdits("plan"), false);

  assert.equal(isLocalFsWriteAllowedForUplinkMode("agent", "write"), true);
  assert.equal(isLocalFsWriteAllowedForUplinkMode("commander", "write"), true);
  assert.equal(isLocalFsWriteAllowedForUplinkMode("plan", "write"), false);
  assert.equal(isLocalFsWriteAllowedForUplinkMode("agent", "cat"), true);

  for (const mode of MODES) {
    assert.match(buildUplinkModeSystemPrompt(mode), /UPLINK MODE/i);
  }

  assert.equal(shouldEnableToolsForUplinkMode("agent", "hi"), true);
  assert.equal(shouldEnableToolsForUplinkMode("plan", "hi"), true);
  assert.equal(shouldEnableToolsForUplinkMode("commander", "hi"), false);
  assert.equal(shouldEnableToolsForUplinkMode("commander", "hi", { missionActive: true }), true);

  const planTools = getMuthurOpenAiToolsForMode("plan");
  const agentTools = getMuthurOpenAiToolsForMode("agent");
  const commanderToolsBlocked = getMuthurOpenAiToolsForMode("commander");
  const commanderToolsActive = getMuthurOpenAiToolsForMode("commander", { missionActive: true });

  assert.ok(planTools.length > 0);
  assert.ok(planTools.some((tool) => tool.function.name === "observe_operator_pane"));
  assert.equal(commanderToolsBlocked.length, 0);
  assert.deepEqual(
    commanderToolsActive.map((tool) => tool.function.name).sort(),
    agentTools.map((tool) => tool.function.name).sort(),
  );
  assert.ok(agentTools.length > planTools.length);

  for (const tool of agentTools) {
    assert.ok(isToolAllowedForUplinkMode("agent", tool.function.name));
  }
  assert.ok(agentTools.some((tool) => tool.function.name === "localfs"));
  assert.ok(agentTools.some((tool) => tool.function.name === "suggest_operator_edit"));
  assert.ok(!isToolAllowedForUplinkMode("commander", "git_status"));
  assert.ok(isToolAllowedForUplinkMode("commander", "git_status", { missionActive: true }));

  const registry = createMuthurToolRegistry();
  const planCtx = createMuthurToolExecutionContext("plan");
  const agentCtx = createMuthurToolExecutionContext("agent");
  const commanderCtx = createMuthurToolExecutionContext("commander");

  const planGit = await executeMuthurChatTool(registry, "git_status", "{}", planCtx);
  assert.match(planGit, /GIT_STATUS/);

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
    `[probe] tool counts plan/agent/commander(active) = ${planTools.length}/${agentTools.length}/${commanderToolsActive.length}`,
  );
  console.log("probe-muthur-phase-c-uplink-mode: PASS");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
