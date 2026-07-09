"use client";

import type { Dispatch, DragEvent, RefObject, SetStateAction } from "react";
import dynamic from "next/dynamic";
import type { OperatorExportFormat } from "@/components/cyberdeck/operator-export-picker";
import {
  canNavigateOperatorFileBack,
  canNavigateOperatorFileForward,
} from "@/lib/operator-file-history";
import { canSaveOperatorDocumentInPlace } from "@/lib/operator-save";
import {
  normalizeOperatorDocumentKind,
  type OperatorDocumentPickerKind,
} from "@/lib/operator-document-types";
import type { OperatorDocFolderRoot } from "@/lib/operator-folder-nav";
import { PanelLoader } from "@/features/cyberdeck/panel-loader";
import type { DroppedOperatorAsset } from "@/features/cyberdeck/muthur/coding-verify-format";

const ActivatedCyberdeckPane = dynamic(
  () =>
    import("@/features/cyberdeck/activated-cyberdeck-pane").then((m) => ({
      default: m.ActivatedCyberdeckPane,
    })),
  { ssr: false, loading: () => <PanelLoader label="ØPERATOR" /> },
);

export type OperatorPaneHostProps = {
  isOperatorDragOver: boolean;
  operatorDroppedAsset: DroppedOperatorAsset | null;
  operatorSurfaceMode: "workspace" | "browser";
  operatorBrowserEngine: string;
  operatorSurfaceIsDocument: boolean;
  operatorBrowserUrl: string;
  operatorDocMode: "view" | "edit";
  operatorDocNameDraft: string;
  operatorActiveFilePath: string | null;
  operatorFileHistory: string[];
  operatorFileHistoryIndex: number;
  operatorFolderRootsRef: RefObject<OperatorDocFolderRoot[]>;
  operatorFolderRootsCount: number;
  operatorEditorRef: RefObject<HTMLTextAreaElement | null>;
  operatorNameInputRef: RefObject<HTMLInputElement | null>;
  operatorBrowserRef: RefObject<HTMLWebViewElement | null>;
  onOperatorDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onOperatorDragLeave: (event: DragEvent<HTMLDivElement>) => void;
  onOperatorDrop: (event: DragEvent<HTMLDivElement>) => void;
  onOperatorDocNameDraftChange: (nextValue: string) => void;
  onCommitOperatorDocName: () => void;
  onSetOperatorDocMode: Dispatch<SetStateAction<"view" | "edit">>;
  onOperatorBrowserNavigate: (nextUrl: string) => void;
  onOperatorBrowserUrlChange: (nextUrl: string) => void;
  onSetOperatorSurfaceMode: (mode: "workspace" | "browser") => void;
  onPasteClipboardToOperator: () => void | Promise<void>;
  onSaveOperatorDocInPlace: () => void | Promise<void>;
  onSaveOperatorDocAsFile: () => void | Promise<void>;
  onConvertDocumentToMarkdown: (
    filePath: string,
    options?: { edit?: boolean },
  ) => void | Promise<void | boolean>;
  onExportOperatorMarkdown: (format: OperatorExportFormat) => void | Promise<void>;
  onCopyOperatorDocToClipboard: () => void | Promise<void>;
  onOperatorDocumentTextChange: (nextText: string) => void;
  onClearOperatorDocument: () => void;
  onOperatorDocumentKindChange: (kind: OperatorDocumentPickerKind) => void;
  onOpenOperatorFolderFile: (path: string, file: File) => void | Promise<void>;
  onOperatorFolderRootsChange: (roots: OperatorDocFolderRoot[]) => void;
  onOperatorFileHistoryBack: () => void;
  onOperatorFileHistoryForward: () => void;
  onReloadOperatorFile: (filePath: string) => void | Promise<void>;
};

export function OperatorPaneHost({
  operatorDroppedAsset,
  operatorActiveFilePath,
  operatorFileHistory,
  operatorFileHistoryIndex,
  operatorFolderRootsRef,
  operatorFolderRootsCount,
  ...paneProps
}: OperatorPaneHostProps) {
  return (
    <ActivatedCyberdeckPane
      kind="operator"
      operatorDroppedAsset={operatorDroppedAsset}
      operatorActiveFilePath={operatorActiveFilePath}
      operatorDocumentKind={normalizeOperatorDocumentKind(operatorDroppedAsset?.kind)}
      operatorCanSaveInPlace={
        operatorFolderRootsCount >= 0 &&
        canSaveOperatorDocumentInPlace(
          operatorActiveFilePath,
          operatorDroppedAsset?.localFilePath,
          operatorFolderRootsRef.current ?? [],
        )
      }
      operatorCanNavigateFileBack={canNavigateOperatorFileBack(operatorFileHistoryIndex)}
      operatorCanNavigateFileForward={canNavigateOperatorFileForward(
        operatorFileHistory,
        operatorFileHistoryIndex,
      )}
      {...paneProps}
    />
  );
}

export { useOperatorDragDrop } from "./use-operator-drag-drop";
export type { UseOperatorDragDropOptions } from "./use-operator-drag-drop";
