// SERVER ONLY: resolves workspace documents from disk. Do not import from client components.

import fs from "node:fs";
import path from "node:path";

import { documentTargetToBasename } from "@/lib/muthur-document-open-intent";
import { resolveConvertDocumentPath } from "@/lib/resolve-convert-document-path";

const SKIP_SEARCH_DIRS = new Set([
  ".git",
  ".next",
  "dist",
  "node_modules",
  "out",
  "coverage",
  ".muthur",
]);

export type DocumentResolutionStatus = "resolved" | "not_found" | "ambiguous";

export type DocumentResolution = {
  status: DocumentResolutionStatus;
  query: string;
  basename: string;
  /** Repo-relative path when resolved */
  relativePath?: string;
  /** Absolute path when resolved */
  absolutePath?: string;
  candidates?: string[];
};

function basenameMatches(fileName: string, targetBasename: string): boolean {
  if (process.platform === "win32") {
    return fileName.toLowerCase() === targetBasename.toLowerCase();
  }
  return fileName === targetBasename;
}

function findAllByBasename(rootDir: string, targetBasename: string, maxDepth = 12): string[] {
  if (!targetBasename || !fs.existsSync(rootDir)) return [];

  const found: string[] = [];

  const walk = (dir: string, depth: number): void => {
    if (depth > maxDepth) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.isFile() && basenameMatches(entry.name, targetBasename)) {
        found.push(path.join(dir, entry.name));
      }
    }

    for (const entry of entries) {
      if (!entry.isDirectory() || SKIP_SEARCH_DIRS.has(entry.name)) continue;
      walk(path.join(dir, entry.name), depth + 1);
    }
  };

  walk(rootDir, 0);
  return found;
}

function toRelative(projectRoot: string, absolutePath: string): string {
  const rel = path.relative(projectRoot, absolutePath);
  return rel.split(path.sep).join("/");
}

export function resolveDocumentReference(
  rawTarget: string,
  workspaceRoot = process.cwd(),
): DocumentResolution {
  const projectRoot = path.resolve(workspaceRoot);
  const basename = documentTargetToBasename(rawTarget);
  const query = rawTarget.trim();

  try {
    const absolutePath = resolveConvertDocumentPath(query, { projectRoot });
    return {
      status: "resolved",
      query,
      basename,
      absolutePath,
      relativePath: toRelative(projectRoot, absolutePath),
    };
  } catch {
    // fall through to multi-match search
  }

  const candidates = findAllByBasename(projectRoot, basename);
  if (candidates.length === 0) {
    const foundationPath = path.join(projectRoot, ".muthur", "foundations", basename);
    if (fs.existsSync(foundationPath) && fs.statSync(foundationPath).isFile()) {
      return {
        status: "resolved",
        query,
        basename,
        absolutePath: foundationPath,
        relativePath: toRelative(projectRoot, foundationPath),
      };
    }
    return { status: "not_found", query, basename };
  }

  if (candidates.length === 1) {
    const absolutePath = candidates[0]!;
    return {
      status: "resolved",
      query,
      basename,
      absolutePath,
      relativePath: toRelative(projectRoot, absolutePath),
    };
  }

  const relativeCandidates = candidates.map((candidate) => toRelative(projectRoot, candidate));
  const preferred =
    relativeCandidates.find((candidate) => candidate === basename) ??
    relativeCandidates.find((candidate) => !candidate.includes("/")) ??
    relativeCandidates[0];

  if (preferred) {
    const absolutePath = path.resolve(projectRoot, preferred);
    return {
      status: "resolved",
      query,
      basename,
      absolutePath,
      relativePath: preferred,
      candidates: relativeCandidates,
    };
  }

  return {
    status: "ambiguous",
    query,
    basename,
    candidates: relativeCandidates,
  };
}

export function readResolvedDocumentText(absolutePath: string, maxChars = 120_000): string {
  const raw = fs.readFileSync(absolutePath, "utf8");
  return raw.length > maxChars ? `${raw.slice(0, maxChars)}\n… (truncated for response)` : raw;
}

function extractDocumentTitle(content: string, fallback: string): string {
  const heading = content.match(/^#\s+(.+)$/m)?.[1]?.trim();
  return heading || fallback;
}

function extractPurposeExcerpt(content: string, maxLines = 24): string {
  const lines = content.split(/\r?\n/);
  const excerpt: string[] = [];
  for (const line of lines) {
    if (excerpt.length >= maxLines) break;
    if (!excerpt.length && !line.trim()) continue;
    excerpt.push(line);
  }
  return excerpt.join("\n").trim();
}

export type DocumentOpenReceipt = {
  intent: "DOCUMENT_OPEN";
  verb: string;
  query: string;
  resolved_file: string | null;
  retrieval_source: "workspace_resolve" | "foundation_store";
  tool_chain: string[];
  resolution_status: DocumentResolutionStatus;
};

export type DocumentOpenResult = {
  response: string;
  receipt: DocumentOpenReceipt;
  operatorOpen: {
    filePath: string;
    fileName: string;
    mode: "view" | "edit";
  } | null;
};

export function buildDocumentOpenResult(args: {
  verb: string;
  target: string;
  resolution: DocumentResolution;
  workspaceRoot?: string;
}): DocumentOpenResult {
  const { verb, target, resolution } = args;
  const toolChain = ["intent:DOCUMENT_OPEN", "resolve_document"];

  if (resolution.status === "not_found") {
    return {
      response: `[MUTHUR // DOCUMENT OPEN // NOT FOUND]

Could not resolve \`${target}\` in the workspace.

Resolution: not_found
Try a full filename (e.g. L-ARCH-001.md) or an exact repo-relative path.`,
      receipt: {
        intent: "DOCUMENT_OPEN",
        verb,
        query: target,
        resolved_file: null,
        retrieval_source: "workspace_resolve",
        tool_chain: [...toolChain, "load_document:skipped"],
        resolution_status: "not_found",
      },
      operatorOpen: null,
    };
  }

  if (resolution.status === "ambiguous") {
    const list = (resolution.candidates ?? []).slice(0, 8).join("\n- ");
    return {
      response: `[MUTHUR // DOCUMENT OPEN // AMBIGUOUS]

Multiple files match \`${resolution.basename}\`:

- ${list}

Specify the full path to open one document.`,
      receipt: {
        intent: "DOCUMENT_OPEN",
        verb,
        query: target,
        resolved_file: null,
        retrieval_source: "workspace_resolve",
        tool_chain: [...toolChain, "load_document:skipped"],
        resolution_status: "ambiguous",
      },
      operatorOpen: null,
    };
  }

  const absolutePath = resolution.absolutePath!;
  const relativePath = resolution.relativePath ?? resolution.basename;
  const content = readResolvedDocumentText(absolutePath);
  toolChain.push("load_document", "retrieve_content");

  const retrievalSource = relativePath.includes(".muthur/foundations/")
    ? "foundation_store"
    : "workspace_resolve";

  const title = extractDocumentTitle(content, resolution.basename);
  const excerpt = extractPurposeExcerpt(content);
  const wordCount = content.split(/\s+/).filter(Boolean).length;

  const response = `[MUTHUR // DOCUMENT OPEN // ${verb.toUpperCase()}]

Resolved: \`${relativePath}\`
Title: ${title}
Words: ${wordCount}
Opened in operator pane.

[PURPOSE EXCERPT]
${excerpt}

[RECEIPT]
intent=DOCUMENT_OPEN · resolved=${relativePath} · source=${retrievalSource} · tools=${toolChain.join(" → ")}`;

  return {
    response,
    receipt: {
      intent: "DOCUMENT_OPEN",
      verb,
      query: target,
      resolved_file: relativePath,
      retrieval_source: retrievalSource,
      tool_chain: toolChain,
      resolution_status: "resolved",
    },
    operatorOpen: {
      filePath: relativePath,
      fileName: resolution.basename,
      mode: verb === "open" ? "edit" : "view",
    },
  };
}
