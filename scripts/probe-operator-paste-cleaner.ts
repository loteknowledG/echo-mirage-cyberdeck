import {
  cleanOperatorPasteText,
  isOperatorPasteWrapperFenceLine,
} from "../src/lib/operator-paste-cleaner";

function assert(label: string, condition: boolean) {
  if (!condition) {
    console.error(`FAIL: ${label}`);
    process.exit(1);
  }
  console.log(`ok: ${label}`);
}

assert("detect 3-backtick md", isOperatorPasteWrapperFenceLine('```md id="4z1kpd"'));
assert("detect 4-backtick text", isOperatorPasteWrapperFenceLine('````text id="uz63fy"'));
assert("detect 5-backtick md", isOperatorPasteWrapperFenceLine('`````md'));
assert("detect 6-backtick text", isOperatorPasteWrapperFenceLine('``````text id="z9y2ua"'));
assert("detect close 3", isOperatorPasteWrapperFenceLine("```"));
assert("detect close 6", isOperatorPasteWrapperFenceLine("``````"));
assert("detect escaped md", isOperatorPasteWrapperFenceLine("\\`\\`\\`md"));
assert("not H1", !isOperatorPasteWrapperFenceLine("# L-7 — Title"));

const wrappedLegacy = `\
\`\`\`\`text id="uz63fy"
\`\`\`md id="4z1kpd"
# L-5 — MUTHUR Document Conversion Tool Directive

Body line.
\`\`\`
\`\`\`\``;

const cleanedLegacy = cleanOperatorPasteText(wrappedLegacy);
assert("legacy starts at H1", cleanedLegacy.startsWith("# L-5"));
assert("legacy keeps body", cleanedLegacy.includes("Body line."));

const wrappedSixFive = `\
\`\`\`\`\`text id="z9y2ua"
\`\`\`\`md

# L-7 — MUTHUR Conversion Housekeeping Directive

After intro.

\`\`\`bash
echo keep_internal_fence
\`\`\`

Tail.
\`\`\`\`
\`\`\`\`\``;

const cleanedSixFive = cleanOperatorPasteText(wrappedSixFive);
assert("6/5 starts at H1", cleanedSixFive.startsWith("# L-7 — MUTHUR Conversion Housekeeping Directive"));
assert("6/5 no leading transport", !cleanedSixFive.startsWith("`"));
assert("6/5 keeps internal bash fence", cleanedSixFive.includes("```bash"));
assert("6/5 keeps internal body", cleanedSixFive.includes("echo keep_internal_fence"));
assert("6/5 ends with content", cleanedSixFive.endsWith("Tail."));

const plain = "# Title\n\n```js\ncode\n```";
assert("plain with internal fences", cleanOperatorPasteText(plain) === plain);

console.log("\nAll operator paste cleaner probes passed.");
