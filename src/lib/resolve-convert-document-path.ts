import fs from "node:fs";
import path from "node:path";
import { resolveOperatorDiskAbsolutePath, type OperatorDocFolderRoot } from "@/lib/operator-folder-nav";

export type ResolveConvertDocumentPathHints = {
  /** Operator folder logical path, e.g. `docs/conductor/Echo Mirage Handoff.pdf`. */
  activeFilePath?: string | null;
  /** Absolute disk path from desktop folder read. */
  localFilePath?: string | null;
  folderRoots?: OperatorDocFolderRoot[];
  /** Repo root for relative path normalization (defaults to cwd). */
  projectRoot?: string;
};

const REPO_PREFIX = /^echo-mirage-cyberdeck[/\\]/i;
const SKIP_SEARCH_DIRS = new Set([
  ".git",
  ".next",
  "dist",
  "node_modules",
  "out",
  "coverage",
]);

function pathExists(candidate: string): boolean {
  try {
    return fs.existsSync(candidate) && fs.statSync(candidate).isFile();
  } catch {
    return false;
  }
}

function stripRepoPrefix(relative: string): string {
  return relative.replace(REPO_PREFIX, "").replace(/^[/\\]+/, "");
}

function basenameMatches(fileName: string, targetBasename: string): boolean {
  if (process.platform === "win32") {
    return fileName.toLowerCase() === targetBasename.toLowerCase();
  }
  return fileName === targetBasename;
}

function findFileByBasename(
  rootDir: string,
  targetBasename: string,
  maxDepth = 12,
): string | null {
  if (!targetBasename || !fs.existsSync(rootDir)) return null;

  const walk = (dir: string, depth: number): string | null => {
    if (depth > maxDepth) return null;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return null;
    }

    for (const entry of entries) {
      if (entry.isFile() && basenameMatches(entry.name, targetBasename)) {
        return path.join(dir, entry.name);
      }
    }

    for (const entry of entries) {
      if (!entry.isDirectory() || SKIP_SEARCH_DIRS.has(entry.name)) continue;
      const found = walk(path.join(dir, entry.name), depth + 1);
      if (found) return found;
    }

    return null;
  };

  return walk(rootDir, 0);
}

function resolveViaFolderRoots(
  logicalPath: string,
  folderRoots: OperatorDocFolderRoot[],
): string | null {
  const trimmed = logicalPath.trim().replace(/^[/\\]+/, "");
  if (!trimmed) return null;

  const rootName = trimmed.split("/")[0];
  const root = folderRoots.find((entry) => entry.name === rootName);
  if (!root) return null;

  const absolute = resolveOperatorDiskAbsolutePath(root, trimmed);
  if (absolute && pathExists(absolute)) return absolute;
  return null;
}

function collectRelativeCandidates(trimmed: string, projectRoot: string): string[] {
  const out: string[] = [];
  const add = (value: string) => {
    const normalized = value.replace(/^[/\\]+/, "");
    if (normalized && !out.includes(normalized)) out.push(normalized);
  };

  if (path.isAbsolute(trimmed)) {
    return out;
  }

  add(trimmed);
  const stripped = stripRepoPrefix(trimmed);
  if (stripped !== trimmed) add(stripped);

  return out;
}

/**
 * Resolve chat/operator paths to a real file for MarkItDown conversion.
 * Handles duplicated repo prefixes, operator folder logical paths, and nested docs.
 */
export function resolveConvertDocumentPath(
  rawPath: string,
  hints?: ResolveConvertDocumentPathHints,
): string {
  const trimmed = rawPath.trim().replace(/^["']|["']$/g, "");
  if (!trimmed) {
    throw new Error("filePath is required");
  }

  const projectRoot = path.resolve(hints?.projectRoot ?? process.cwd());
  const folderRoots = hints?.folderRoots ?? [];
  const basename = path.basename(trimmed);

  if (hints?.localFilePath) {
    const local = path.resolve(hints.localFilePath);
    if (pathExists(local)) return local;
  }

  if (path.isAbsolute(trimmed) && pathExists(trimmed)) {
    return path.normalize(trimmed);
  }

  const activeLogical = hints?.activeFilePath?.trim();
  if (activeLogical && folderRoots.length > 0) {
    const fromActive = resolveViaFolderRoots(activeLogical, folderRoots);
    if (fromActive) return fromActive;
  }

  for (const relative of collectRelativeCandidates(trimmed, projectRoot)) {
    const candidate = path.resolve(projectRoot, relative);
    if (pathExists(candidate)) return candidate;

    if (folderRoots.length > 0) {
      const fromLogical = resolveViaFolderRoots(relative, folderRoots);
      if (fromLogical) return fromLogical;
    }
  }

  if (basename && folderRoots.length > 0) {
    for (const root of folderRoots) {
      const shallow = resolveOperatorDiskAbsolutePath(root, `${root.name}/${basename}`);
      if (shallow && pathExists(shallow)) return shallow;

      if (root.diskPath) {
        const deep = findFileByBasename(root.diskPath, basename);
        if (deep && pathExists(deep)) return deep;
      }
    }
  }

  if (basename) {
    const docsDir = path.join(projectRoot, "docs");
    const inDocs = findFileByBasename(docsDir, basename);
    if (inDocs && pathExists(inDocs)) return inDocs;

    const inProject = findFileByBasename(projectRoot, basename);
    if (inProject && pathExists(inProject)) return inProject;
  }

  const fallback = path.isAbsolute(trimmed)
    ? path.normalize(trimmed)
    : path.resolve(projectRoot, stripRepoPrefix(trimmed) || trimmed);

  throw new Error(`File not found: ${fallback}`);
}
