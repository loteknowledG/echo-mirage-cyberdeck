import assert from "node:assert/strict";
import path from "node:path";
import { createMuthurToolRegistry } from "../src/lib/muthur-core/tool-registry";
import { executeMuthurChatTool } from "../src/lib/muthur-core/execute-openai-tool";
import { extractOperatorOpenRef } from "../src/lib/muthur-core/operator-open-file-ref";
import {
  appendMuthurStreamFooters,
  splitMuthurStreamPayload,
} from "../src/lib/muthur-core/muthur-stream-payload";
import { createMuthurToolExecutionContext } from "../src/lib/muthur-core/types";

async function main() {
  const registry = createMuthurToolRegistry();
  assert.ok(registry.tools.open_operator_file);

  const blocked = await executeMuthurChatTool(
    registry,
    "open_operator_file",
    JSON.stringify({ filePath: "/etc/passwd" }),
  );
  assert.match(blocked, /TOOL FAILURE/);

  const target = path.join("src", "lib", "muthur-core", "loop.ts");
  const ctx = createMuthurToolExecutionContext();
  const opened = await executeMuthurChatTool(
    registry,
    "open_operator_file",
    JSON.stringify({ filePath: target, mode: "edit" }),
    ctx,
  );
  assert.match(opened, /OPEN_OPERATOR_FILE/);
  assert.ok(ctx.operatorOpenFile?.filePath);
  assert.equal(extractOperatorOpenRef(ctx.operatorOpenFile)?.fileName, "loop.ts");

  const editQueued = await executeMuthurChatTool(
    registry,
    "suggest_operator_edit",
    JSON.stringify({ kind: "append_section", text: "<!-- probe -->\n" }),
    ctx,
  );
  assert.match(editQueued, /suggest_operator_edit/);
  assert.equal(ctx.operatorEdits.length, 1);

  const footered = appendMuthurStreamFooters(
    "Opened loop.ts.",
    ["open_operator_file", "suggest_operator_edit"],
    ctx.operatorEdits,
    null,
    ctx.operatorOpenFile,
    null,
  );
  const split = splitMuthurStreamPayload(footered);
  assert.equal(split.displayText, "Opened loop.ts.");
  assert.equal(split.operatorOpenFile?.fileName, "loop.ts");
  assert.equal(split.operatorEdits.length, 1);

  console.log("probe-muthur-open-operator: PASS");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
