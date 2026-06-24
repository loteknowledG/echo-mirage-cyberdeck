import assert from "node:assert/strict";
import {
  analyzeTextForBinaryDisplay,
  resolveOperatorAssetSurface,
} from "../src/lib/operator-file-surface";

function main() {
  assert.equal(analyzeTextForBinaryDisplay("").safe, true);
  assert.equal(analyzeTextForBinaryDisplay("%PDF-1.4 binary").safe, false);
  assert.equal(analyzeTextForBinaryDisplay("hello\x00world").safe, false);
  assert.equal(analyzeTextForBinaryDisplay("# Markdown\n\nok").safe, true);

  assert.equal(
    resolveOperatorAssetSurface({
      kind: "pdf",
      name: "report.pdf",
      pdfSrc: "data:application/pdf;base64,abc",
    }),
    "pdf",
  );
  assert.equal(
    resolveOperatorAssetSurface({ kind: "file", name: "data.bin" }),
    "binary-unsafe",
  );
  assert.equal(
    resolveOperatorAssetSurface({
      kind: "markdown",
      name: "readme.md",
      text: "# Hi",
    }),
    "markdown",
  );
  assert.equal(
    resolveOperatorAssetSurface({
      kind: "text",
      name: "notes.txt",
      text: "%PDF-1.4",
    }),
    "pdf",
  );
  assert.equal(
    resolveOperatorAssetSurface({
      kind: "text",
      name: "notes.txt",
      text: "\0binary",
    }),
    "binary-unsafe",
  );

  assert.equal(
    resolveOperatorAssetSurface({
      kind: "docx",
      name: "brief.docx",
      docxSrc: "blob:docx",
    }),
    "docx",
  );
  assert.equal(
    resolveOperatorAssetSurface({ surface: "office-unsupported", kind: "file", name: "legacy.doc" }),
    "office-unsupported",
  );

  assert.equal(
    resolveOperatorAssetSurface({
      kind: "text",
      name: ".env.local",
      text: "OPENROUTER_API_KEY=sk-test\n",
    }),
    "text",
  );

  console.log("probe-operator-file-surface: ok");
}

main();
