const WINDOWS_RESERVED_NAMES = new Set([
  "con",
  "prn",
  "aux",
  "nul",
  "com1",
  "com2",
  "com3",
  "com4",
  "com5",
  "com6",
  "com7",
  "com8",
  "com9",
  "lpt1",
  "lpt2",
  "lpt3",
  "lpt4",
  "lpt5",
  "lpt6",
  "lpt7",
  "lpt8",
  "lpt9",
]);

const INVALID_FOLDER_NAME_CHARS = /[<>:"|?*\x00-\x1f]/;
const ABSOLUTE_PATH_PATTERN = /^([a-zA-Z]:[\\/]|\\\\|\/)/;

export type FolderValidationResult = { ok: true } | { ok: false; reason: string };

export function validateFolderName(folderName: string): FolderValidationResult {
  const trimmed = folderName.trim();
  if (!trimmed) {
    return { ok: false, reason: "Folder name cannot be empty." };
  }
  if (trimmed !== folderName) {
    return { ok: false, reason: "Folder name cannot have leading or trailing spaces." };
  }
  if (trimmed === "." || trimmed === "..") {
    return { ok: false, reason: "Folder name cannot be . or .." };
  }
  if (trimmed.includes("/") || trimmed.includes("\\")) {
    return { ok: false, reason: "Folder name cannot contain path separators." };
  }
  if (INVALID_FOLDER_NAME_CHARS.test(trimmed)) {
    return { ok: false, reason: "Folder name contains invalid characters." };
  }
  if (/[. ]$/.test(trimmed)) {
    return { ok: false, reason: "Folder name cannot end with a dot or space." };
  }
  if (WINDOWS_RESERVED_NAMES.has(trimmed.toLowerCase())) {
    return { ok: false, reason: `Folder name "${trimmed}" is reserved.` };
  }
  return { ok: true };
}

export function normalizeWorkspaceParentPath(parentPath: string): string {
  return parentPath
    .replace(/\\/g, "/")
    .split("/")
    .filter((segment) => segment.length > 0 && segment !== ".")
    .join("/");
}

export function validateWorkspaceParentPath(parentPath: string): FolderValidationResult {
  const trimmed = parentPath.trim();
  if (!trimmed) {
    return { ok: true };
  }
  if (trimmed.includes("\0")) {
    return { ok: false, reason: "Invalid parent path." };
  }
  if (ABSOLUTE_PATH_PATTERN.test(trimmed)) {
    return { ok: false, reason: "Parent path must be relative to the workspace." };
  }
  if (trimmed.includes("..")) {
    return { ok: false, reason: "Parent path cannot contain .." };
  }

  const segments = normalizeWorkspaceParentPath(trimmed).split("/").filter(Boolean);
  for (const segment of segments) {
    const segmentValidation = validateFolderName(segment);
    if (!segmentValidation.ok) {
      return { ok: false, reason: `Invalid parent path segment: ${segmentValidation.reason}` };
    }
  }
  return { ok: true };
}

export function joinWorkspaceFolderPath(parentPath: string, folderName: string): string {
  const normalizedParent = normalizeWorkspaceParentPath(parentPath);
  return normalizedParent ? `${normalizedParent}/${folderName}` : folderName;
}

export function absoluteToWorkspaceRelative(workspaceRoot: string, absolutePath: string): string | null {
  const normRoot = workspaceRoot.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
  const normAbs = absolutePath.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
  if (!normAbs.startsWith(normRoot)) return null;
  const relative = absolutePath
    .replace(/\\/g, "/")
    .slice(workspaceRoot.replace(/\\/g, "/").replace(/\/+$/, "").length)
    .replace(/^[/\\]+/, "");
  return relative.replace(/\\/g, "/");
}
