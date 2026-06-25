import path from "node:path";
import { isPathInsideWorkspace, WORKSPACE_ROOT } from "@/lib/muthur/execution/safety-policy";

export type LocalFsWriteMode = "open" | "dev-tree" | "workspace";

/** How far localfs mkdir/write may reach on the machine running the dev server. */
export function resolveLocalFsWriteMode(): LocalFsWriteMode {
  const raw = process.env.MUTHUR_LOCALFS_WRITE_MODE?.trim().toLowerCase();
  if (raw === "open" || raw === "workspace" || raw === "dev-tree") {
    return raw;
  }
  if (process.env.VERCEL === "1") {
    return "workspace";
  }
  return "open";
}

/** @deprecated use resolveLocalFsWriteMode — kept for env MUTHUR_OPERATOR_DEV_ROOT */
export function resolveOperatorDevWriteRoot(): string | null {
  const raw = process.env.MUTHUR_OPERATOR_DEV_ROOT?.trim();
  if (raw === "0" || raw === "false") return null;
  if (raw) return path.resolve(raw);
  if (process.env.VERCEL === "1") return null;

  const parent = path.resolve(path.dirname(WORKSPACE_ROOT));
  const parentNorm = parent.replace(/\\/g, "/").toLowerCase();
  if (parentNorm.endsWith("/dev") || parentNorm === "f:/dev") {
    return parent;
  }
  return null;
}

const DENIED_WRITE_PREFIXES: string[] =
  process.platform === "win32"
    ? ["c:\\windows", "c:\\program files", "c:\\program files (x86)"]
    : ["/etc", "/usr", "/bin", "/sbin", "/sys", "/proc"];

function normalizePathForCompare(absPath: string): string {
  return absPath.replace(/\\/g, "/").toLowerCase();
}

export function isDeniedSystemWritePath(absPath: string): boolean {
  const norm = normalizePathForCompare(absPath);
  return DENIED_WRITE_PREFIXES.some((prefix) => {
    const p = normalizePathForCompare(prefix);
    return norm === p || norm.startsWith(`${p}/`);
  });
}

export function isLocalFsWritePathAllowed(targetPath: string): boolean {
  const abs = path.resolve(targetPath);
  if (isDeniedSystemWritePath(abs)) {
    return false;
  }

  const mode = resolveLocalFsWriteMode();
  if (mode === "open") {
    return true;
  }

  if (isPathInsideWorkspace(abs)) {
    return true;
  }

  if (mode === "dev-tree") {
    const devRoot = resolveOperatorDevWriteRoot();
    if (!devRoot) return false;
    if (abs === devRoot) return true;
    const prefix = devRoot.endsWith(path.sep) ? devRoot : `${devRoot}${path.sep}`;
    return abs.startsWith(prefix);
  }

  return false;
}

export function localFsWriteScopeError(targetPath: string): string {
  const abs = path.resolve(targetPath);
  if (isDeniedSystemWritePath(abs)) {
    return `localfs write/mkdir blocked for system path: ${abs}`;
  }

  const mode = resolveLocalFsWriteMode();
  if (mode === "open") {
    return `localfs write/mkdir failed for ${abs}`;
  }
  if (mode === "dev-tree") {
    const devRoot = resolveOperatorDevWriteRoot();
    return (
      `localfs write/mkdir is limited to the Echo Mirage repo or sibling projects under ${devRoot ?? "(dev root unavailable)"} ` +
      `(got ${abs}). Set MUTHUR_LOCALFS_WRITE_MODE=open for Cursor-style paths.`
    );
  }
  return (
    "localfs write/mkdir is limited to the Echo Mirage workspace on this deployment (/workspace/...). " +
    "Run pnpm dev locally for operator-disk writes (F:\\dev\\..., etc.)."
  );
}

export function buildLocalFsWriteScopeDescription(): string {
  const mode = resolveLocalFsWriteMode();
  switch (mode) {
    case "open":
      return (
        "mkdir and write persist on REAL operator disk (Cursor/Codex-style). " +
        "Use absolute paths (e.g. F:\\dev\\plasma\\index.html) or repo paths (/workspace/...). " +
        "System directories are blocked."
      );
    case "dev-tree": {
      const devRoot = resolveOperatorDevWriteRoot();
      return `mkdir and write persist on REAL disk — Echo Mirage repo or sibling folders under ${devRoot ?? "operator dev root"}.`;
    }
    case "workspace":
      return "mkdir and write persist on REAL disk — Echo Mirage workspace (/workspace/...) only on this host.";
    default: {
      const _exhaustive: never = mode;
      return _exhaustive;
    }
  }
}

export function buildLocalFsPathParamDescription(): string {
  const mode = resolveLocalFsWriteMode();
  if (mode === "open") {
    return "Absolute path (F:\\dev\\plasma\\index.html) or repo-relative (/workspace/src/...).";
  }
  if (mode === "dev-tree") {
    return "Absolute path under operator dev tree or /workspace/... for repo files.";
  }
  return "Path under the Echo Mirage workspace (/workspace/... on serverless).";
}

export function buildLocalFsActionParamDescription(): string {
  return (
    "ls = list directory, cat = read text file, stat = metadata. " +
    `mkdir = create directory. write = create/overwrite or append (${buildLocalFsWriteScopeDescription()})`
  );
}

export function buildOperatorDevWriteScopePrompt(): string {
  const mode = resolveLocalFsWriteMode();
  if (mode === "open") {
    return (
      "\n\nLOCALFS (operator disk): This deck runs on the operator machine with OPEN write scope — like Cursor or Codex. " +
      "Use localfs mkdir + write with absolute paths when asked (e.g. F:\\dev\\plasma\\index.html). " +
      "/workspace/... maps to the Echo Mirage repo. Do NOT refuse valid operator paths or invent workspace-only workarounds."
    );
  }
  if (mode === "dev-tree") {
    const devRoot = resolveOperatorDevWriteRoot();
    if (!devRoot) return "";
    return (
      `\n\nOPERATOR DEV TREE: localfs mkdir/write may create sibling projects under ${devRoot} ` +
      `(e.g. ${path.join(devRoot, "plasma")}) in Agent posture — not only inside the Echo Mirage repo.`
    );
  }
  return (
    "\n\nLOCALFS: This host only allows writes inside the Echo Mirage workspace (/workspace/...). " +
    "For F:\\dev\\... projects run the deck locally with pnpm dev."
  );
}
