import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseDsmlToolCalls, stripDsmlToolMarkup } from "../src/lib/muthur-core/parse-dsml-tool-calls";

const FW = "\uFF5C";

function wrapInvoke(name: string, params: Record<string, string>): string {
  const lines = [
    `${FW}${FW}DSML${FW}${FW}tool_calls`,
    `<${FW}${FW}DSML${FW}${FW}invoke name="${name}">`,
  ];
  for (const [key, value] of Object.entries(params)) {
    lines.push(
      `<${FW}${FW}DSML${FW}${FW}parameter name="${key}" string="true">${value}</${FW}${FW}DSML${FW}${FW}parameter>`,
    );
  }
  lines.push(`</${FW}${FW}DSML${FW}${FW}invoke>`, `</${FW}${FW}DSML${FW}${FW}tool_calls>`);
  return lines.join("\n");
}

const small = wrapInvoke("localfs", {
  action: "write",
  path: "src/lib/muthur-core/loop.ts",
  content: "/** test */\n",
});

const calls = parseDsmlToolCalls(small);
assert.equal(calls.length, 1);
assert.equal(calls[0]?.name, "localfs");
assert.equal(calls[0]?.args.action, "write");
assert.equal(stripDsmlToolMarkup(`[MUTHUR] ${small}`), "");

const loopSource = readFileSync("src/lib/muthur-core/loop.ts", "utf8");
const large = wrapInvoke("localfs", {
  action: "write",
  path: "src/lib/muthur-core/loop.ts",
  content: loopSource,
});

console.log("[probe] parsing large DSML payload…");
const t0 = Date.now();
const largeCalls = parseDsmlToolCalls(large);
console.log(`[probe] parsed in ${Date.now() - t0}ms, calls=${largeCalls.length}`);
assert.equal(largeCalls.length, 1);
assert.ok(String(largeCalls[0]?.args.content).includes("runMuthurCoreLoop"));

console.log("probe-dsml-parse: PASS");
