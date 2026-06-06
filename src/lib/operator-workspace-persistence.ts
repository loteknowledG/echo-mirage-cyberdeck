import type { OperatorAssetSurface } from "@/lib/operator-file-surface";
import { createBlankOperatorDocument } from "@/lib/operator-document-types";

export const OPERATOR_WORKSPACE_STORAGE_KEY = "echo-mirage-operator-workspace-v1";

export type PersistedOperatorAsset = {
  kind: string;
  name: string;
  mimeType: string;
  size: number;
  text?: string;
  surface?: OperatorAssetSurface;
  localFilePath?: string;
};

export type PersistedOperatorWorkspace = {
  version: 1;
  activeFilePath: string | null;
  docMode: "view" | "edit";
  fileHistory: string[];
  fileHistoryIndex: number;
  asset: PersistedOperatorAsset;
};

type SerializableOperatorAsset = {
  kind: string;
  name: string;
  mimeType: string;
  size: number;
  text?: string;
  surface?: OperatorAssetSurface;
  localFilePath?: string;
  pdfSrc?: string;
  imageSrc?: string;
  docxSrc?: string;
};

const BLANK = createBlankOperatorDocument();

export function isDefaultBlankOperatorAsset(asset: PersistedOperatorAsset): boolean {
  return (
    asset.kind === BLANK.kind &&
    asset.name === BLANK.name &&
    !asset.text?.trim() &&
    !asset.localFilePath &&
    asset.size <= 0
  );
}

export function isPersistableOperatorWorkspace(
  asset: PersistedOperatorAsset,
  activeFilePath: string | null,
): boolean {
  if (activeFilePath?.trim()) return true;
  if (!isDefaultBlankOperatorAsset(asset)) return true;
  return false;
}

export function serializeOperatorAssetForPersistence(
  asset: SerializableOperatorAsset,
): PersistedOperatorAsset {
  return {
    kind: asset.kind,
    name: asset.name,
    mimeType: asset.mimeType,
    size: asset.size,
    ...(asset.text !== undefined ? { text: asset.text } : {}),
    ...(asset.surface ? { surface: asset.surface } : {}),
    ...(asset.localFilePath ? { localFilePath: asset.localFilePath } : {}),
  };
}

export function restoredAssetFromPersistence(asset: PersistedOperatorAsset): SerializableOperatorAsset {
  return {
    kind: asset.kind,
    name: asset.name,
    mimeType: asset.mimeType,
    size: asset.size,
    ...(asset.text !== undefined ? { text: asset.text } : {}),
    ...(asset.surface ? { surface: asset.surface } : {}),
    ...(asset.localFilePath ? { localFilePath: asset.localFilePath } : {}),
  };
}

export function loadOperatorWorkspace(): PersistedOperatorWorkspace | null {
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(OPERATOR_WORKSPACE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedOperatorWorkspace> | null;
    if (!parsed || parsed.version !== 1 || !parsed.asset || typeof parsed.asset !== "object") {
      return null;
    }
    const asset = parsed.asset as PersistedOperatorAsset;
    if (typeof asset.name !== "string" || typeof asset.kind !== "string") return null;
    return {
      version: 1,
      activeFilePath: typeof parsed.activeFilePath === "string" ? parsed.activeFilePath : null,
      docMode: parsed.docMode === "edit" ? "edit" : "view",
      fileHistory: Array.isArray(parsed.fileHistory)
        ? parsed.fileHistory.filter((entry): entry is string => typeof entry === "string")
        : [],
      fileHistoryIndex:
        typeof parsed.fileHistoryIndex === "number" && Number.isFinite(parsed.fileHistoryIndex)
          ? parsed.fileHistoryIndex
          : -1,
      asset,
    };
  } catch {
    return null;
  }
}

export function saveOperatorWorkspace(state: PersistedOperatorWorkspace): void {
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") return;
  try {
    window.localStorage.setItem(OPERATOR_WORKSPACE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore quota errors */
  }
}

export function operatorFilePathNeedsFolderReload(filePath: string | null | undefined): boolean {
  if (!filePath?.trim()) return false;
  return !/^[a-z+]+:\/\//i.test(filePath);
}
