import {
  deriveMarkdownSaveFilename,
  deriveOperatorSaveFilename,
  inferOperatorDocumentFromText,
  isMarkdownH1Document,
} from "../src/lib/operator-markdown-title";

function assert(label: string, condition: boolean) {
  if (!condition) {
    console.error(`FAIL: ${label}`);
    process.exit(1);
  }
  console.log(`ok: ${label}`);
}

const sample = "# L-2 — Operator Markdown Viewer Automatic Save Title Directive\n\nBody.";

assert("H1 detect", isMarkdownH1Document(sample));

const inferred = inferOperatorDocumentFromText(sample);
assert("kind markdown", inferred.kind === "markdown");
assert("mime markdown", inferred.mimeType === "text/markdown");
assert(
  "filename",
  inferred.suggestedFilename ===
    "L-2-operator-markdown-viewer-automatic-save-title-directive.md",
);

assert(
  "save filename",
  deriveOperatorSaveFilename({ kind: "markdown", text: sample }) ===
    "L-2-operator-markdown-viewer-automatic-save-title-directive.md",
);

const plain = "hello world";
const plainInferred = inferOperatorDocumentFromText(plain);
assert("plain kind", plainInferred.kind === "text");
assert("plain mime", plainInferred.mimeType === "text/plain");

assert(
  "fallback save",
  deriveOperatorSaveFilename({ kind: "markdown", text: "no heading" }) === "operator-doc.md",
);

assert(
  "header overrides H1",
  deriveOperatorSaveFilename({
    kind: "markdown",
    text: sample,
    headerName: "E-7-muthur-conversion-housekeeping-directive.md",
  }) === "E-7-muthur-conversion-housekeeping-directive.md",
);

assert(
  "current name overrides H1",
  deriveOperatorSaveFilename({
    kind: "markdown",
    text: sample,
    currentName: "E-7-muthur-conversion-housekeeping-directive.md",
  }) === "E-7-muthur-conversion-housekeeping-directive.md",
);

assert(
  "current beats header",
  deriveOperatorSaveFilename({
    kind: "markdown",
    text: sample,
    currentName: "loaded-name.md",
    headerName: "draft-name.md",
  }) === "loaded-name.md",
);

assert(
  "header beats generic operator-doc",
  deriveOperatorSaveFilename({
    kind: "markdown",
    text: sample,
    currentName: "operator-doc.md",
    headerName: "E-7-muthur-conversion-housekeeping-directive.md",
  }) === "E-7-muthur-conversion-housekeeping-directive.md",
);

assert(
  "derive H1",
  deriveMarkdownSaveFilename(sample) ===
    "L-2-operator-markdown-viewer-automatic-save-title-directive.md",
);

console.log("\nAll operator markdown title probes passed.");
