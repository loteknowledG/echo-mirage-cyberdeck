import path from "node:path";
import { isPathInsideWorkspace, WORKSPACE_ROOT } from "@/lib/muthur/execution/safety-policy";

/**
 * Sibling-project write root for local MUTHUR (e.g. f:\dev\plasma next to echo-mirage-cyberdeck).
 * Disabled on Vercel — set MUTHUR_OPERATOR_DEV_ROOT=0 to force repo-only writes locally.
 */
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

export function isLocalFsWritePathAllowed(targetPath: string): boolean {
  const abs = path.resolve(targetPath);
  if (isPathInsideWorkspace(abs)) return true;
  const devRoot = resolveOperatorDevWriteRoot();
  if (!devRoot) return false;
  if (abs === devRoot) return true;
  const prefix = devRoot.endsWith(path.sep) ? devRoot : `${devRoot}${path.sep}`;
  return abs.startsWith(prefix);
}

export function localFsWriteScopeError(targetPath: string): string {
  const devRoot = resolveOperatorDevWriteRoot();
  if (devRoot) {
    return (
      `localfs write/mkdir is limited to the Echo Mirage repo or sibling projects under ${devRoot} ` +
      `(got ${path.resolve(targetPath)}).`
    );
  }
  return "localfs write/mkdir is only allowed under the Echo Mirage workspace root.";
}

export function buildOperatorDevWriteScopePrompt(): string {
  const devRoot = resolveOperatorDevWriteRoot();
  if (!devRoot) return "";
  return (
    `\n\nOPERATOR DEV TREE: This deck runs locally. localfs mkdir/write may create sibling projects under ${devRoot} ` +
    `(e.g. ${path.join(devRoot, "plasma")}) when the operator asks — not only inside the Echo Mirage repo. ` +
    "Use Agent posture. Prefer a dedicated project folder; do not write into other repos without being asked."
  );
}
