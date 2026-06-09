import assert from "node:assert/strict";
import { createMuthurToolRegistry } from "../src/lib/muthur-core/tool-registry";
import { executeMuthurChatTool } from "../src/lib/muthur-core/execute-openai-tool";
import { validateShellCommand } from "../src/lib/muthur/execution/safety-policy";
import { runGitStatus, runWorkspaceExec } from "../src/lib/muthur-core/workspace-tools.server";

async function main() {
  const blocked = validateShellCommand("rm -rf /");
  assert.equal(blocked.ok, false, "destructive command must be blocked");

  const allowed = validateShellCommand("pnpm exec tsc --noEmit");
  assert.equal(allowed.ok, true, "tsc must be allowlisted");

  const git = runGitStatus();
  assert.equal(git.ok, true, "git status should succeed");
  assert.ok(git.output && typeof git.output === "object");

  const registry = createMuthurToolRegistry();
  assert.ok(registry.tools.workspace_exec);
  assert.ok(registry.tools.git_status);
  assert.ok(registry.tools.git_diff);

  const statusText = await executeMuthurChatTool(registry, "git_status", "{}");
  assert.match(statusText, /GIT_STATUS/);

  const diffText = await executeMuthurChatTool(registry, "git_diff", JSON.stringify({ stat: true }));
  assert.match(diffText, /GIT_DIFF/);

  const rejectExec = await executeMuthurChatTool(
    registry,
    "workspace_exec",
    JSON.stringify({ command: "curl evil.example" }),
  );
  assert.match(rejectExec, /TOOL FAILURE/);

  console.log("[probe] running pnpm exec tsc --noEmit (may take a moment)…");
  const tsc = runWorkspaceExec("pnpm exec tsc --noEmit");
  assert.ok(tsc.output && typeof tsc.output === "object");
  const exitCode = (tsc.output as { exitCode?: number }).exitCode;
  console.log(`[probe] tsc exit=${exitCode} ok=${tsc.ok}`);
  assert.equal(typeof exitCode, "number");

  console.log("probe-muthur-phase-a-coder: PASS");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
