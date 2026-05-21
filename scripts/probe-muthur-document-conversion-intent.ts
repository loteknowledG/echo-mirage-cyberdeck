import { parseConvertDocumentIntent } from "../src/lib/muthur-document-conversion-intent";

function assert(label: string, condition: boolean) {
  if (!condition) {
    console.error(`FAIL: ${label}`);
    process.exit(1);
  }
  console.log(`ok: ${label}`);
}

const md = parseConvertDocumentIntent("muthur md C:\\docs\\resume.pdf");
assert("muthur md", md?.filePath === "C:\\docs\\resume.pdf");

const convert = parseConvertDocumentIntent("muthur convert report.docx to markdown");
assert("convert to markdown", convert?.filePath === "report.docx");

const slash = parseConvertDocumentIntent("/muthur md ./brief.pdf");
assert("slash md", slash?.filePath === "./brief.pdf");

assert("no match", parseConvertDocumentIntent("hello world") === null);

console.log("\nAll muthur document conversion intent probes passed.");
