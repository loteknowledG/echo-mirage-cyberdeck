import assert from "node:assert/strict";
import { parseInlineToolCalls, stripInlineToolMarkup } from "../src/lib/muthur-core/parse-inline-tool-calls";
import { parseXmlToolCalls, stripXmlToolMarkup } from "../src/lib/muthur-core/parse-xml-tool-calls";

const nemotronSample = `<tool_call>
<function=localfs>
<parameter=action>
ls
</parameter>
<parameter=path>
/workspace/src
</parameter>
</function>
</tool_call>`;

const calls = parseXmlToolCalls(nemotronSample);
assert.equal(calls.length, 1);
assert.equal(calls[0]?.name, "localfs");
assert.equal(calls[0]?.args.action, "ls");
assert.equal(calls[0]?.args.path, "/workspace/src");
assert.equal(stripXmlToolMarkup(`[MUTHUR] ${nemotronSample}`), "");

const inline = parseInlineToolCalls(nemotronSample);
assert.equal(inline.length, 1);
assert.equal(stripInlineToolMarkup(`[MUTHUR] ${nemotronSample}`), "");

console.log("probe-xml-tool-calls: PASS");
