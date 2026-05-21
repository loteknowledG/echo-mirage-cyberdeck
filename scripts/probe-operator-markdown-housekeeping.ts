import { applyOperatorMarkdownHousekeeping } from "../src/lib/operator-markdown-housekeeping";

function assert(label: string, condition: boolean) {
  if (!condition) {
    console.error(`FAIL: ${label}`);
    process.exit(1);
  }
  console.log(`ok: ${label}`);
}

const wrapped = `\
\`\`\`\`\`text id="z9y2ua"
\`\`\`\`md

# L-7 — MUTHUR Conversion Housekeeping Directive

## Objective

Body.

\`\`\`bash
echo keep
\`\`\`

Tail.
\`\`\`\`
\`\`\`\`\``;

const cleaned = applyOperatorMarkdownHousekeeping(wrapped);
assert("starts at H1", cleaned.startsWith("# L-7 — MUTHUR Conversion Housekeeping Directive"));
assert("no leading backticks", !cleaned.startsWith("`"));
assert("keeps bash fence", cleaned.includes("```bash"));
assert("keeps fence body", cleaned.includes("echo keep"));
assert("ends with Tail", cleaned.endsWith("Tail."));

const messy = "# Title\r\n\r\n\r\n\r\n\r\nPara.\r\n\r\n```js\r\ncode\r\n```";
const normalized = applyOperatorMarkdownHousekeeping(messy);
assert("crlf normalized", !normalized.includes("\r"));
assert("blank lines collapsed", !normalized.includes("\n\n\n"));
assert("internal fence preserved", normalized.endsWith("```"));
assert("internal opener preserved", normalized.includes("```js"));

const heading = applyOperatorMarkdownHousekeeping("##  Objective\n\nText.");
assert("heading spacing", heading.startsWith("## Objective"));

console.log("\nAll operator markdown housekeeping probes passed.");
