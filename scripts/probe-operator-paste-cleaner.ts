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

assert("detect md fence", isOperatorPasteWrapperFenceLine('```md id="4z1kpd"'));
assert("detect text fence", isOperatorPasteWrapperFenceLine('````text id="uz63fy"'));
assert("detect close fence", isOperatorPasteWrapperFenceLine("```"));

const wrapped = `\
\`\`\`\`text id="uz63fy"
\`\`\`md id="4z1kpd"
# L-5 — MUTHUR Document Conversion Tool Directive

Body line.
\`\`\`
\`\`\`\``;

const cleaned = cleanOperatorPasteText(wrapped);
assert("starts at H1", cleaned.startsWith("# L-5 — MUTHUR Document Conversion Tool Directive"));
assert("keeps body", cleaned.includes("Body line."));
assert("no opening md fence", !cleaned.includes("```md"));
assert("no trailing fence", !cleaned.endsWith("```"));

const plain = "# Title\n\nContent";
assert("plain unchanged", cleanOperatorPasteText(plain) === plain);

console.log("\nAll operator paste cleaner probes passed.");
