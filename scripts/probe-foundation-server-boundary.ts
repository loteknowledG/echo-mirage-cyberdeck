/**
 * JR-L-MEM-004A / JR-L-UI-001A — foundation server/client boundary probe.
 * Run: pnpm probe:foundation-server-boundary
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "fs";
import path from "path";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "src");

const FORBIDDEN_IMPORT_SUBSTRINGS = [
  "muthur/foundations/foundation-store",
  "/foundation-store",
  "muthur-foundation-retrieval",
];

const CLIENT_SCAN_ROOTS = [
  path.join(SRC, "features"),
  path.join(SRC, "components"),
  path.join(SRC, "app"),
  path.join(SRC, "lib"),
];

const SERVER_ALLOWLIST = new Set([
  path.normalize(path.join(SRC, "lib", "server")),
  path.normalize(path.join(SRC, "app", "api")),
  path.normalize(path.join(SRC, "muthur", "foundations")),
  path.normalize(path.join(SRC, "muthur", "boot")),
]);

function isUnderAllowlistedServerDir(filePath: string): boolean {
  const normalized = path.normalize(filePath);
  for (const allowed of SERVER_ALLOWLIST) {
    if (normalized.startsWith(allowed + path.sep) || normalized === allowed) {
      return true;
    }
  }
  return false;
}

function isServerOnlySourceFile(filePath: string): boolean {
  return filePath.endsWith(".server.ts") || filePath.endsWith(".server.tsx");
}

function collectSourceFiles(dir: string, out: string[] = []): string[] {
  if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) {
    return out;
  }
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      collectSourceFiles(full, out);
      continue;
    }
    if (/\.(ts|tsx|js|jsx)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

function scanClientReachableFiles(): string[] {
  const files: string[] = [];
  for (const root of CLIENT_SCAN_ROOTS) {
    collectSourceFiles(root, files);
  }
  return files.filter(
    (file) => !isUnderAllowlistedServerDir(file) && !isServerOnlySourceFile(file),
  );
}

function extractImportSpecifiers(source: string): string[] {
  const specifiers: string[] = [];
  const importRe = /^\s*import\s+(?:type\s+)?[\s\S]*?\sfrom\s+["']([^"']+)["']/gm;
  const sideEffectRe = /^\s*import\s+["']([^"']+)["']/gm;
  let match: RegExpExecArray | null;
  while ((match = importRe.exec(source)) !== null) {
    specifiers.push(match[1]);
  }
  while ((match = sideEffectRe.exec(source)) !== null) {
    specifiers.push(match[1]);
  }
  return specifiers;
}

function isForbiddenFoundationImport(specifier: string, filePath: string): boolean {
  if (specifier.includes("muthur-foundation-retrieval.server")) {
    return !isUnderAllowlistedServerDir(filePath) && !filePath.includes(`${path.sep}api${path.sep}`);
  }
  if (specifier.includes("muthur-foundation-retrieval")) {
    return true;
  }
  if (specifier.includes("foundation-store")) {
    return true;
  }
  for (const forbidden of FORBIDDEN_IMPORT_SUBSTRINGS) {
    if (specifier.includes(forbidden)) {
      return true;
    }
  }
  return false;
}

function findForbiddenImports(filePath: string): string[] {
  const rel = path.relative(ROOT, filePath);
  const source = readFileSync(filePath, "utf8");
  const hits: string[] = [];
  for (const specifier of extractImportSpecifiers(source)) {
    if (isForbiddenFoundationImport(specifier, filePath)) {
      hits.push(`${rel} imports "${specifier}"`);
    }
  }
  return hits;
}

function main(): void {
  console.log("probe:foundation-server-boundary");

  const clientFiles = scanClientReachableFiles();
  assert.ok(clientFiles.length > 0, "no client-reachable files discovered");

  const violations: string[] = [];
  for (const file of clientFiles) {
    violations.push(...findForbiddenImports(file));
  }

  if (violations.length > 0) {
    console.error("Boundary violations:");
    for (const violation of violations) {
      console.error(`  - ${violation}`);
    }
    process.exit(1);
  }

  const cyberdeck = readFileSync(
    path.join(SRC, "features", "cyberdeck", "cyberdeck-app.tsx"),
    "utf8",
  );
  assert.match(cyberdeck, /parseFoundationQuery/);
  assert.match(cyberdeck, /\/api\/muthur\/foundation-query/);
  assert.doesNotMatch(cyberdeck, /foundation-store/);
  assert.doesNotMatch(cyberdeck, /buildFoundationResponse/);

  console.log(`  ok scanned ${clientFiles.length} client-reachable files`);
  console.log("  ok cyberdeck uses intent + foundation-query API");
  console.log("probe:foundation-server-boundary PASS");
}

main();
