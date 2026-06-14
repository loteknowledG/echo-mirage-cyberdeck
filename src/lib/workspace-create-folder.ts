import { validateFolderName } from "@/lib/workspace-folder-validation";

export type CreateFolderResponse =
  | { success: true; path: string }
  | { success: false; error: string };

let cachedWorkspaceRoot: string | null = null;

export async function fetchWorkspaceRoot(): Promise<string | null> {
  if (cachedWorkspaceRoot) return cachedWorkspaceRoot;
  try {
    const res = await fetch("/api/workspace/root");
    const payload = (await res.json().catch(() => ({}))) as { root?: string };
    if (!res.ok || typeof payload.root !== "string" || !payload.root.trim()) return null;
    cachedWorkspaceRoot = payload.root;
    return cachedWorkspaceRoot;
  } catch {
    return null;
  }
}

export async function createWorkspaceFolder(
  parentPath: string,
  folderName: string,
): Promise<CreateFolderResponse> {
  const nameValidation = validateFolderName(folderName);
  if (!nameValidation.ok) {
    return { success: false, error: nameValidation.reason };
  }

  try {
    const res = await fetch("/api/workspace/create-folder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parentPath, folderName }),
    });
    const payload = (await res.json().catch(() => ({}))) as {
      success?: boolean;
      path?: string;
      error?: string;
    };
    if (!res.ok || !payload.success) {
      return { success: false, error: payload.error || `Create folder failed (${res.status}).` };
    }
    if (!payload.path) {
      return { success: false, error: "Create folder succeeded without a path." };
    }
    return { success: true, path: payload.path };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Create folder failed.",
    };
  }
}

export const OPERATOR_FILE_SAVED_EVENT = "echo-mirage-operator-file-saved";

export type OperatorFileSavedDetail = {
  logicalPath?: string;
};
