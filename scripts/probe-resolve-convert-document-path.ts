import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { resolveConvertDocumentPath } from "../src/lib/resolve-convert-document-path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "echo-convert-resolve-"));
const projectRoot = path.join(tmp, "echo-mirage-cyberdeck");
const docsRoot = path.join(projectRoot, "docs");
const conductorDir = path.join(docsRoot, "conductor");
fs.mkdirSync(conductorDir, { recursive: true });
const pdfName = "Echo Mirage Handoff.pdf";
const pdfPath = path.join(conductorDir, pdfName);
fs.writeFileSync(pdfPath, "%PDF-1.4 probe");

const folderRoots = [
  { id: "docs", name: "docs", diskPath: docsRoot },
];

const resolved = resolveConvertDocumentPath(
  "echo-mirage-cyberdeck/docs/Echo Mirage Handoff.pdf",
  { projectRoot, folderRoots },
);
assert.equal(
  path.normalize(resolved),
  path.normalize(pdfPath),
  "repo-prefixed shallow docs path should find nested conductor file",
);

const fromActive = resolveConvertDocumentPath("docs/Echo Mirage Handoff.pdf", {
  projectRoot,
  folderRoots,
  activeFilePath: `docs/conductor/${pdfName}`,
});
assert.equal(path.normalize(fromActive), path.normalize(pdfPath));

let threw = false;
try {
  resolveConvertDocumentPath("missing.pdf", { projectRoot, folderRoots });
} catch (error) {
  threw = error instanceof Error && error.message.includes("File not found");
}
assert.ok(threw, "missing file should throw");

fs.rmSync(tmp, { recursive: true, force: true });
console.log("probe-resolve-convert-document-path: ok");
