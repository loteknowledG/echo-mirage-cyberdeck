import { mkdir, stat } from "node:fs/promises";
import path from "node:path";
import {
  isPathInsideWorkspace,
  validateWriteFilePath,
  WORKSPACE_ROOT,
} from "@/lib/muthur/execution/safety-policy";
import {
  joinWorkspaceFolderPath,
  normalizeWorkspaceParentPath,
  validateFolderName,
  validateWorkspaceParentPath,
} from "@/lib/workspace-folder-validation";

export type CreateWorkspaceFolderResult =
  | { success: true; path: string }
  | { success: false; error: string; status: number };

export async function createWorkspaceFolder(
  parentPath: string,
  folderName: string,
): Promise<CreateWorkspaceFolderResult> {
  const parentValidation = validateWorkspaceParentPath(parentPath);
  if (!parentValidation.ok) {
    return { success: false, error: parentValidation.reason, status: 400 };
  }

  const nameValidation = validateFolderName(folderName);
  if (!nameValidation.ok) {
    return { success: false, error: nameValidation.reason, status: 400 };
  }

  const normalizedParent = normalizeWorkspaceParentPath(parentPath);
  const parentAbs = normalizedParent
    ? path.join(WORKSPACE_ROOT, normalizedParent)
    : WORKSPACE_ROOT;
  const parentValidated = validateWriteFilePath(parentAbs);
  if (!parentValidated.ok) {
    return { success: false, error: parentValidated.reason, status: 403 };
  }

  let parentStat;
  try {
    parentStat = await stat(parentValidated.abs);
  } catch {
    return { success: false, error: "Parent folder does not exist.", status: 404 };
  }
  if (!parentStat.isDirectory()) {
    return { success: false, error: "Parent path is not a folder.", status: 400 };
  }

  const newAbs = path.join(parentValidated.abs, folderName);
  if (!isPathInsideWorkspace(newAbs)) {
    return { success: false, error: "Folder path is outside the workspace.", status: 403 };
  }

  const newValidated = validateWriteFilePath(newAbs);
  if (!newValidated.ok) {
    return { success: false, error: newValidated.reason, status: 403 };
  }

  try {
    await stat(newValidated.abs);
    return { success: false, error: "A file or folder with that name already exists.", status: 409 };
  } catch {
    /* expected when folder does not exist */
  }

  try {
    await mkdir(newValidated.abs);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Could not create folder.",
      status: 500,
    };
  }

  const relativePath = joinWorkspaceFolderPath(normalizedParent, folderName);
  return { success: true, path: relativePath };
}

export { WORKSPACE_ROOT };
