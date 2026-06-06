"use client";

import { useDebouncedEffect } from "@/lib/use-debounced-effect";
import type { OperatorAssetSurface } from "@/lib/operator-file-surface";
import {
  isPersistableOperatorWorkspace,
  OPERATOR_WORKSPACE_STORAGE_KEY,
  saveOperatorWorkspace,
  serializeOperatorAssetForPersistence,
  type PersistedOperatorWorkspace,
} from "@/lib/operator-workspace-persistence";

type OperatorWorkspacePersistenceProps = {
  deckUiHydrated: boolean;
  operatorDroppedAsset: {
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
  } | null;
  operatorActiveFilePath: string | null;
  operatorDocMode: "view" | "edit";
  operatorFileHistory: string[];
  operatorFileHistoryIndex: number;
};

/** Persists operator pane document + folder path for reload after app restart. */
export function OperatorWorkspacePersistence({
  deckUiHydrated,
  operatorDroppedAsset,
  operatorActiveFilePath,
  operatorDocMode,
  operatorFileHistory,
  operatorFileHistoryIndex,
}: OperatorWorkspacePersistenceProps) {
  useDebouncedEffect(
    () => {
      if (!deckUiHydrated || !operatorDroppedAsset) return;
      const asset = serializeOperatorAssetForPersistence(operatorDroppedAsset);
      if (!isPersistableOperatorWorkspace(asset, operatorActiveFilePath)) {
        try {
          window.localStorage.removeItem(OPERATOR_WORKSPACE_STORAGE_KEY);
        } catch {
          /* ignore */
        }
        return;
      }
      const payload: PersistedOperatorWorkspace = {
        version: 1,
        activeFilePath: operatorActiveFilePath,
        docMode: operatorDocMode,
        fileHistory: operatorFileHistory,
        fileHistoryIndex: operatorFileHistoryIndex,
        asset,
      };
      saveOperatorWorkspace(payload);
    },
    [
      deckUiHydrated,
      operatorActiveFilePath,
      operatorDocMode,
      operatorDroppedAsset,
      operatorFileHistory,
      operatorFileHistoryIndex,
    ],
    300,
  );

  return null;
}
