import assert from "node:assert/strict";
import { executeMuthurChatTool } from "../src/lib/muthur-core/execute-openai-tool";
import { getMuthurOpenAiToolsForPosture } from "../src/lib/muthur-core/openai-tool-definitions";
import { createMuthurToolRegistry } from "../src/lib/muthur-core/tool-registry";
import { createMuthurToolExecutionContext } from "../src/lib/muthur-core/types";
import {
  allowsOperatorPaneEdits,
  buildMuthurPostureSystemPrompt,
  getMuthurPostureCommitPolicy,
  isLocalFsWriteAllowedForPosture,
  isToolAllowedForPosture,
  normalizeMuthurPosture,
  shouldAutoCommitOperatorEdits,
  shouldEnableToolsForPosture,
  type MuthurPosture,
} from "../src/lib/muthur/muthur-posture";

const POSTURES: MuthurPosture[] = ["plan", "agent", "commander"];

async function main() {
  assert.equal(normalizeMuthurPosture("agent"), "agent");
  assert.equal(normalizeMuthurPosture("commander"), "commander");
  assert.equal(normalizeMuthurPosture("unknown"), "plan");
  assert.equal(normalizeMuthurPosture("ask"), "plan");
  assert.equal(normalizeMuthurPosture("debug"), "agent");

  assert.equal(getMuthurPostureCommitPolicy("agent"), "immediate");
  assert.equal(getMuthurPostureCommitPolicy("plan"), "never");
  assert.equal(getMuthurPostureCommitPolicy("commander"), "immediate");

  assert.equal(allowsOperatorPaneEdits("agent"), true);
  assert.equal(allowsOperatorPaneEdits("commander"), true);
  assert.equal(allowsOperatorPaneEdits("plan"), false);

  assert.equal(shouldAutoCommitOperatorEdits("agent"), true);
  assert.equal(shouldAutoCommitOperatorEdits("commander"), true);
  assert.equal(shouldAutoCommitOperatorEdits("plan"), false);

  assert.equal(isLocalFsWriteAllowedForPosture("agent", "write"), true);
  assert.equal(isLocalFsWriteAllowedForPosture("commander", "write"), true);
  assert.equal(isLocalFsWriteAllowedForPosture("plan", "write"), false);
  assert.equal(isLocalFsWriteAllowedForPosture("agent", "cat"), true);

  for (const posture of POSTURES) {
    assert.match(buildMuthurPostureSystemPrompt(posture), /MUTHUR POSTURE/i);
  }

  assert.equal(shouldEnableToolsForPosture("agent", "hi"), true);
  assert.equal(shouldEnableToolsForPosture("plan", "hi"), true);
  assert.equal(shouldEnableToolsForPosture("commander", "hi"), false);
  assert.equal(shouldEnableToolsForPosture("commander", "hi", { missionActive: true }), true);

  const planTools = getMuthurOpenAiToolsForPosture("plan");
  const agentTools = getMuthurOpenAiToolsForPosture("agent");
  const commanderToolsBlocked = getMuthurOpenAiToolsForPosture("commander");
  const commanderToolsActive = getMuthurOpenAiToolsForPosture("commander", { missionActive: true });

  assert.ok(planTools.length > 0);
  assert.ok(planTools.some((tool) => tool.function.name === "observe_operator_pane"));
  assert.equal(commanderToolsBlocked.length, 0);
  assert.deepEqual(
    commanderToolsActive.map((tool) => tool.function.name).sort(),
    agentTools.map((tool) => tool.function.name).sort(),
  );
  assert.ok(agentTools.length > planTools.length);

  for (const tool of agentTools) {
    assert.ok(isToolAllowedForPosture("agent", tool.function.name));
  }
  assert.ok(agentTools.some((tool) => tool.function.name === "localfs"));
  assert.ok(agentTools.some((tool) => tool.function.name === "suggest_operator_edit"));
  assert.ok(!isToolAllowedForPosture("commander", "git_status"));
  assert.ok(isToolAllowedForPosture("commander", "git_status", { missionActive: true }));

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
  console.log("probe-muthur-posture: PASS");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
