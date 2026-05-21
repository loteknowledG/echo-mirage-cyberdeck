import {
  buildCadreFilename,
  parseCadreTitleParts,
  resolveCadreFolder,
  resolveCadreSaveTarget,
} from "../src/lib/cadre-constitutional-routing";

function assert(label: string, condition: boolean) {
  if (!condition) {
    console.error(`FAIL: ${label}`);
    process.exit(1);
  }
  console.log(`ok: ${label}`);
}

const l2 = resolveCadreSaveTarget(
  "# L-2 — Operator Markdown Viewer Automatic Save Title Directive\n",
  { kind: "markdown" },
);
assert("L-2 folder", l2.relativeDirectory === "docs/cadre/tech-lead-legislator/");
assert(
  "L-2 filename",
  l2.filename === "L-2-operator-markdown-viewer-automatic-save-title-directive.md",
);

const l3 = resolveCadreSaveTarget(
  "# L-3 — Cadre Automatic Constitutional Folder Routing Directive\n",
  { kind: "markdown" },
);
assert(
  "L-3 filename",
  l3.filename === "L-3-cadre-automatic-constitutional-folder-routing-directive.md",
);

const er = resolveCadreSaveTarget("# ER-1.1 — Preview Route Reproduction Evidence\n", {
  kind: "markdown",
});
assert("ER-1.1 folder", er.relativeDirectory === "docs/cadre/judge-tester/");
assert("ER-1.1 filename", er.filename === "ER-1.1-preview-route-reproduction-evidence.md");

const e1 = resolveCadreSaveTarget("# E-1 — Preview Route Implementation Thread\n", {
  kind: "markdown",
});
assert("E-1 folder", e1.relativeDirectory === "docs/cadre/executive-coder/");

assert("E- before ER-", resolveCadreFolder("E-1") === "docs/cadre/executive-coder/");
assert("ER- judge", resolveCadreFolder("ER-1.1") === "docs/cadre/judge-tester/");

const unknown = resolveCadreSaveTarget("# Random Note Without Prefix\n", { kind: "markdown" });
assert("unknown folder", unknown.relativeDirectory === "docs/cadre/");
assert("unknown filename", unknown.filename === "operator-doc.md");

const noH1 = resolveCadreSaveTarget("no heading here", { kind: "markdown" });
assert("no H1 fallback", noH1.filename === "operator-doc.md");

const parts = parseCadreTitleParts("L-2 — Operator Markdown Viewer Automatic Save Title Directive");
assert("parse parts", parts?.prefix === "L-2" && parts.description.includes("Operator"));

assert(
  "deterministic",
  buildCadreFilename("L-3", "Cadre Automatic Constitutional Folder Routing Directive") ===
    "L-3-cadre-automatic-constitutional-folder-routing-directive.md",
);

console.log("\nAll cadre routing probes passed.");
