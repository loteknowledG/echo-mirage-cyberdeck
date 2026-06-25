import assert from "node:assert/strict";
import { parseInlineToolCalls, stripInlineToolMarkup } from "../src/lib/muthur-core/parse-inline-tool-calls";
import { extractOpenAiMessageText } from "../src/lib/muthur-core/extract-openai-message-text";

const proseSample = `\`\`\`tool_code
localfs.mkdir({
  "path": "F:\\\\dev\\\\plasma",
  "ensure_parent_dirs": true
})
localfs.write({
  "path": "F:\\\\dev\\\\plasma\\\\index.html",
  "content": "<!DOCTYPE html><html><body><h1>Plasma</h1></body></html>"
})
\`\`\``;

const calls = parseInlineToolCalls(proseSample);
assert.equal(calls.length, 2);
assert.equal(calls[0]?.name, "localfs");
assert.equal(calls[0]?.args.action, "mkdir");
assert.equal(calls[0]?.args.path, "F:\\dev\\plasma");
assert.equal(calls[1]?.args.action, "write");
assert.equal(stripInlineToolMarkup(proseSample), "");

const arrayContent = extractOpenAiMessageText({
  content: [{ type: "text", text: "Creating plasma workspace." }],
});
assert.equal(arrayContent, "Creating plasma workspace.");

const reasoningOnly = extractOpenAiMessageText({
  content: null,
  reasoning_content: "Plan: mkdir plasma folder.",
});
assert.equal(reasoningOnly, "Plan: mkdir plasma folder.");

console.log("probe-prose-tool-calls: PASS");
