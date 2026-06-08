'use client';

import { useCallback, useEffect, useRef, useState, type ChangeEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import type { Dispatch, DragEvent, RefObject, SetStateAction } from "react";
import {
  cdxIconArrowNext,
  cdxIconArrowPrevious,
  cdxIconCopy,
  cdxIconDownload,
  cdxIconEdit,
  cdxIconEye,
  cdxIconPaste,
  cdxIconRedo,
  cdxIconTrash,
  cdxIconUndo,
} from "@wikimedia/codex-icons";
import { LuExternalLink, LuFileText, LuPanelRightClose, LuPanelRightOpen, LuSave } from "react-icons/lu";
import { isConvertibleDocumentPath } from "@/lib/muthur-document-conversion-intent";
import { publishMuthurObservation } from "@/lib/muthur/observation/publish-observation";
import { toast } from "sonner";
import { Streamdown } from "streamdown";
import { OperatorDocFolderPane } from "@/components/cyberdeck/operator-doc-folder-pane";
import type { OperatorDocFolderRoot } from "@/lib/operator-folder-nav";
import { CyberdeckPaneHeader, CyberdeckPaneHeaderTitle } from "@/components/cyberdeck/pane-header";
import { Switch } from "@/components/ui/switch";
import { OperatorDocTypeMenu } from "@/components/cyberdeck/operator-doc-type-menu";
import type { OperatorExportFormat } from "@/components/cyberdeck/operator-export-picker";
import {
  OperatorConvertPicker,
  type OperatorConvertFormat,
  type OperatorConvertOption,
} from "@/components/cyberdeck/operator-convert-picker";
import {
  CyberdeckControlTooltip,
  CyberdeckPaneTooltip,
  CyberdeckPaneTooltipProvider,
} from "@/components/cyberdeck/cyberdeck-pane-tooltip";
import {
  normalizeOperatorDocumentKind,
  type OperatorDocumentPickerKind,
} from "@/lib/operator-document-types";
import { cn } from "@/lib/utils";
import {
  CyberdeckActionButton,
  CyberdeckControl,
} from "@/components/cyberdeck/cyberdeck-control-button";
import { LEGACY_SWITCH_EMERALD } from "@/lib/cyberdeck/realmorphism-control";
import { MORPHISM_ZONE_ASCIIMORPHISM } from "@/lib/cyberdeck/morphism-zones";
import { useDeckMode } from "@/lib/deck-mode";
import { useGlyphTextHistory } from "@/lib/use-glyph-text-history";
import { CodexIcon } from "@/components/codex-icon";
import { OperatorMonacoWorkbench } from "@/components/cyberdeck/operator-monaco-workbench";
import { getMonacoEditorContext } from "@/lib/monaco-editor-context";
import { detectOperatorEditorLanguage } from "@/lib/operator-workbench";
import {
  analyzeTextForBinaryDisplay,
  isOperatorTextEditableSurface,
  resolveOperatorAssetSurface,
  type OperatorAssetSurface,
} from "@/lib/operator-file-surface";
import { OperatorImagePreview } from "@/components/cyberdeck/operator-image-preview";
import dynamic from "next/dynamic";
import { OperatorPdfPreview } from "@/components/cyberdeck/operator-pdf-preview";
import { OperatorUnsupportedPreview } from "@/components/cyberdeck/operator-unsupported-preview";
import {
  exportMarkdownToDocx,
  exportMarkdownToPdf,
} from "@/lib/markdown-to-docx-export";
import {
  docxFilenameFromMarkdownName,
  pdfFilenameFromMarkdownName,
} from "@/lib/markdown-to-docx-intent";

const OperatorDocxWorkbench = dynamic(
  () =>
    import("@/components/cyberdeck/operator-docx-workbench").then(
      (mod) => mod.OperatorDocxWorkbench,
    ),
  { ssr: false },
);

type DroppedOperatorAsset = {
  kind: string;
  name: string;
  mimeType: string;
  size: number;
  text?: string;
  imageSrc?: string;
  pdfSrc?: string;
  docxSrc?: string;
  localFilePath?: string;
  surface?: OperatorAssetSurface;
};

type OperatorPaneBodyProps = {
  isOperatorDragOver: boolean;
  operatorDroppedAsset: DroppedOperatorAsset | null;
  operatorSurfaceMode: "workspace" | "browser";
  operatorBrowserEngine: string;
  operatorSurfaceIsDocument: boolean;
  operatorBrowserUrl: string;
  operatorDocMode: "view" | "edit";
  operatorDocNameDraft: string;
  operatorActiveFilePath?: string | null;
  operatorEditorRef: RefObject<HTMLTextAreaElement>;
  operatorNameInputRef: RefObject<HTMLInputElement>;
  operatorBrowserRef: RefObject<HTMLWebViewElement>;
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
  onSaveOperatorDocInPlace?: () => void | Promise<void>;
  onSaveOperatorDocAsFile: () => void | Promise<void>;
  operatorCanSaveInPlace?: boolean;
  onCopyOperatorDocToClipboard: () => void | Promise<void>;
  onOperatorDocumentTextChange: (nextText: string) => void;
  onClearOperatorDocument?: () => void;
  operatorDocumentKind: OperatorDocumentPickerKind;
  onOperatorDocumentKindChange: (kind: OperatorDocumentPickerKind) => void;
  onOpenOperatorFolderFile: (path: string, file: File) => void | Promise<void>;
  onOperatorFolderRootsChange?: (roots: OperatorDocFolderRoot[]) => void;
  operatorCanNavigateFileBack: boolean;
  operatorCanNavigateFileForward: boolean;
  onOperatorFileHistoryBack: () => void;
  onOperatorFileHistoryForward: () => void;
  onConvertDocumentToMarkdown: (
    filePath: string,
    options?: { edit?: boolean },
  ) => void | Promise<void>;
  onExportOperatorMarkdown: (format: OperatorExportFormat) => void | Promise<void>;
};

function readWebviewNavigationState(view: HTMLWebViewElement | null): {
  canGoBack: boolean;
  canGoForward: boolean;
} {
  if (!view) return { canGoBack: false, canGoForward: false };
  try {
    return { canGoBack: view.canGoBack(), canGoForward: view.canGoForward() };
  } catch {
    return { canGoBack: false, canGoForward: false };
  }
}

const ZOOM_LEVELS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3] as const;

/** Shared document surface scale for operator view + edit modes. */
const OPERATOR_DOC_SURFACE_CLASS =
  "min-h-[50vh] w-full rounded-sm border border-[#1c1c1c] bg-black px-3 py-3 font-mono text-[12px] leading-snug text-green-200";

const OPERATOR_MARKDOWN_VIEW_CLASS =
  "max-w-none font-mono text-[12px] leading-snug text-green-200 [&_h1]:my-2 [&_h1]:font-mono [&_h1]:text-[12px] [&_h1]:font-normal [&_h2]:my-2 [&_h2]:font-mono [&_h2]:text-[12px] [&_h3]:font-mono [&_h3]:text-[12px] [&_p]:my-1 [&_li]:my-0 [&_pre]:my-2 [&_pre]:bg-black [&_pre]:text-green-300";

const OPERATOR_FOLDER_PANE_OPEN_KEY = "echo-mirage-operator-folder-pane-open-v1";
const OPERATOR_FOLDER_PANE_WIDTH_KEY = "echo-mirage-operator-folder-pane-width-v1";
const OPERATOR_FOLDER_PANE_DEFAULT_WIDTH = 176;
const OPERATOR_FOLDER_PANE_MIN_WIDTH = 148;
const OPERATOR_FOLDER_PANE_MAX_WIDTH = 360;

function clampFolderPaneWidth(width: number): number {
  return Math.min(OPERATOR_FOLDER_PANE_MAX_WIDTH, Math.max(OPERATOR_FOLDER_PANE_MIN_WIDTH, Math.round(width)));
}

function readPersistedFolderPaneOpen(): boolean {
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") return false;
  try {
    return window.localStorage.getItem(OPERATOR_FOLDER_PANE_OPEN_KEY) === "1";
  } catch {
    return false;
  }
}

function readPersistedFolderPaneWidth(): number {
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") return OPERATOR_FOLDER_PANE_DEFAULT_WIDTH;
  try {
    const parsed = Number(window.localStorage.getItem(OPERATOR_FOLDER_PANE_WIDTH_KEY));
    return Number.isFinite(parsed) ? clampFolderPaneWidth(parsed) : OPERATOR_FOLDER_PANE_DEFAULT_WIDTH;
  } catch {
    return OPERATOR_FOLDER_PANE_DEFAULT_WIDTH;
  }
}

function OperatorToolbarIconButton({
  label,
  onClick,
  disabled = false,
  className = "",
  pressed = false,
  children,
}: {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  pressed?: boolean;
  children: ReactNode;
}) {
  const button = (
    <CyberdeckControl
      control={{ size: "toolbar", signal: pressed }}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={pressed}
      className={cn(
        disabled && "disabled:cursor-not-allowed disabled:opacity-30",
        className,
      )}
    >
      {children}
    </CyberdeckControl>
  );

  return (
    <CyberdeckPaneTooltip label={label} side="top">
      {disabled ? <span className="inline-flex">{button}</span> : button}
    </CyberdeckPaneTooltip>
  );
}

function OperatorFileHistoryNav({
  canBack,
  canForward,
  onBack,
  onForward,
}: {
  canBack: boolean;
  canForward: boolean;
  onBack: () => void;
  onForward: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      <OperatorToolbarIconButton label="Previous file" onClick={onBack} disabled={!canBack}>
        <CodexIcon icon={cdxIconArrowPrevious} className="h-3.5 w-3.5" />
      </OperatorToolbarIconButton>
      <OperatorToolbarIconButton label="Next file" onClick={onForward} disabled={!canForward}>
        <CodexIcon icon={cdxIconArrowNext} className="h-3.5 w-3.5" />
      </OperatorToolbarIconButton>
    </div>
  );
}

function OperatorViewEditControls({
  operatorDocMode,
  onCommitOperatorDocName,
  onSetOperatorDocMode,
}: {
  operatorDocMode: "view" | "edit";
  onCommitOperatorDocName: () => void;
  onSetOperatorDocMode: Dispatch<SetStateAction<"view" | "edit">>;
}) {
  const deckMode = useDeckMode();

  return (
    <div className="flex shrink-0 items-center gap-1">
      <OperatorToolbarIconButton
        label="View"
        pressed={operatorDocMode === "view"}
        onClick={() => {
          onCommitOperatorDocName();
          onSetOperatorDocMode("view");
        }}
      >
        <CodexIcon icon={cdxIconEye} className="h-3.5 w-3.5" />
      </OperatorToolbarIconButton>
      <CyberdeckPaneTooltip label={operatorDocMode === "edit" ? "Switch to view" : "Switch to edit"}>
        <span className="inline-flex">
          <Switch
            checked={operatorDocMode === "edit"}
            onCheckedChange={(checked) => {
              if (!checked) {
                onCommitOperatorDocName();
                onSetOperatorDocMode("view");
                return;
              }
              onSetOperatorDocMode("edit");
            }}
            aria-label="Toggle operator view edit mode"
            className={cn("realmorphism-switch shrink-0", deckMode === "ascii" && LEGACY_SWITCH_EMERALD)}
          />
        </span>
      </CyberdeckPaneTooltip>
      <OperatorToolbarIconButton
        label="Edit"
        pressed={operatorDocMode === "edit"}
        onClick={() => onSetOperatorDocMode("edit")}
      >
        <CodexIcon icon={cdxIconEdit} className="h-3.5 w-3.5" />
      </OperatorToolbarIconButton>
    </div>
  );
}

function OperatorDocumentTitleRow({
  operatorDocMode,
  operatorDocNameDraft,
  operatorNameInputRef,
  operatorDroppedAsset,
  operatorFileSizeLabel,
  operatorCanNavigateFileBack,
  operatorCanNavigateFileForward,
  onOperatorDocNameDraftChange,
  onCommitOperatorDocName,
  onOperatorFileHistoryBack,
  onOperatorFileHistoryForward,
}: {
  operatorDocMode: "view" | "edit";
  operatorDocNameDraft: string;
  operatorNameInputRef: RefObject<HTMLInputElement>;
  operatorDroppedAsset: DroppedOperatorAsset;
  operatorFileSizeLabel: string | null;
  operatorCanNavigateFileBack: boolean;
  operatorCanNavigateFileForward: boolean;
  onOperatorDocNameDraftChange: (nextValue: string) => void;
  onCommitOperatorDocName: () => void;
  onOperatorFileHistoryBack: () => void;
  onOperatorFileHistoryForward: () => void;
}) {
  const [nameFocused, setNameFocused] = useState(false);
  const displayName = operatorDroppedAsset.name || "OPERATOR_DOC_SURFACE";

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <OperatorFileHistoryNav
        canBack={operatorCanNavigateFileBack}
        canForward={operatorCanNavigateFileForward}
        onBack={onOperatorFileHistoryBack}
        onForward={onOperatorFileHistoryForward}
      />
      {operatorDocMode === "edit" ? (
        <input
          ref={operatorNameInputRef}
          value={operatorDocNameDraft}
          onChange={(event) => onOperatorDocNameDraftChange(event.target.value)}
          onFocus={() => setNameFocused(true)}
          onBlur={() => {
            setNameFocused(false);
            onCommitOperatorDocName();
          }}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            onCommitOperatorDocName();
            operatorNameInputRef.current?.blur();
          }}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          aria-label="Rename operator document"
          className={cn(
            "min-w-0 w-full max-w-[min(100%,28rem)] flex-1 border-0 bg-transparent font-mono text-[10px] tracking-[0.04em] text-[#cfcfcf] outline-none placeholder:text-[#5a5a5a]",
            nameFocused && "ring-1 ring-emerald-500/35 ring-offset-0 ring-offset-black",
          )}
          style={{ textShadow: "0 0 6px rgba(138,138,138,0.2)" }}
        />
      ) : (
        <CyberdeckPaneTooltip
          label={displayName}
          contentClassName="max-w-[90vw] whitespace-nowrap text-left"
        >
          <span className="min-w-0 flex-1 cursor-default overflow-hidden">
            <CyberdeckPaneHeaderTitle
              className="block truncate"
              style={{ textShadow: "0 0 6px rgba(138,138,138,0.2)" }}
            >
              {displayName}
            </CyberdeckPaneHeaderTitle>
          </span>
        </CyberdeckPaneTooltip>
      )}
      {operatorFileSizeLabel ? (
        <span className="shrink-0 font-mono text-[9px] tracking-[0.04em] text-[#5a5a5a]">
          {operatorFileSizeLabel}
        </span>
      ) : null}
    </div>
  );
}

function OperatorReturnToDocumentButton({ onClick }: { onClick: () => void }) {
  return (
    <OperatorToolbarIconButton label="Return to document mode" onClick={onClick}>
      <LuFileText className="h-3.5 w-3.5" />
    </OperatorToolbarIconButton>
  );
}

function OperatorDocumentHeaderControls({
  operatorDocMode,
  folderPaneOpen,
  onCommitOperatorDocName,
  onSetOperatorDocMode,
  onToggleFolderPane,
}: {
  operatorDocMode: "view" | "edit";
  folderPaneOpen: boolean;
  onCommitOperatorDocName: () => void;
  onSetOperatorDocMode: Dispatch<SetStateAction<"view" | "edit">>;
  onToggleFolderPane: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <OperatorViewEditControls
        operatorDocMode={operatorDocMode}
        onCommitOperatorDocName={onCommitOperatorDocName}
        onSetOperatorDocMode={onSetOperatorDocMode}
      />
      <OperatorToolbarIconButton
        label={folderPaneOpen ? "Close folders" : "Open folders"}
        onClick={onToggleFolderPane}
      >
        {folderPaneOpen ? (
          <LuPanelRightClose className="h-3.5 w-3.5" />
        ) : (
          <LuPanelRightOpen className="h-3.5 w-3.5" />
        )}
      </OperatorToolbarIconButton>
    </div>
  );
}

function OperatorDocumentToolStrip({
  operatorDocumentKind,
  previewSurface,
  localFilePath,
  textEditingEnabled,
  editToolsEnabled,
  convertOptions,
  converting = false,
  onConvert,
  canUndo,
  canRedo,
  canClear,
  onUndo,
  onRedo,
  onClear,
  onOperatorDocumentKindChange,
  onCopyOperatorDocToClipboard,
  onPasteClipboardToOperator,
  onSaveOperatorDocInPlace,
  onSaveOperatorDocAsFile,
  operatorCanSaveInPlace = false,
  docxEditActive = false,
  onSaveOperatorDocx,
  onSaveOperatorDocxAs,
}: {
  operatorDocumentKind: OperatorDocumentPickerKind;
  previewSurface: OperatorAssetSurface | null;
  localFilePath: string | null;
  /** Markdown/text/code editor tools (undo, export, save, …). */
  textEditingEnabled: boolean;
  editToolsEnabled: boolean;
  convertOptions: OperatorConvertOption[];
  converting?: boolean;
  onConvert: (format: OperatorConvertFormat) => void | Promise<void>;
  canUndo: boolean;
  canRedo: boolean;
  canClear: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  onOperatorDocumentKindChange: (kind: OperatorDocumentPickerKind) => void;
  onCopyOperatorDocToClipboard: () => void | Promise<void>;
  onPasteClipboardToOperator: () => void | Promise<void>;
  onSaveOperatorDocInPlace?: () => void | Promise<void>;
  onSaveOperatorDocAsFile: () => void | Promise<void>;
  operatorCanSaveInPlace?: boolean;
  docxEditActive?: boolean;
  onSaveOperatorDocx?: () => void | Promise<void>;
  onSaveOperatorDocxAs?: () => void | Promise<void>;
}) {
  const binaryPreview =
    previewSurface != null && !isOperatorTextEditableSurface(previewSurface);
  const resolvedPath = localFilePath?.trim() ?? "";
  const showSaveControls =
    (textEditingEnabled && editToolsEnabled) || (docxEditActive && Boolean(onSaveOperatorDocx));
  const saveInPlaceDisabled = docxEditActive
    ? !resolvedPath
    : !editToolsEnabled || !operatorCanSaveInPlace;
  const saveAsDisabled = docxEditActive ? false : !editToolsEnabled;

  const handleSave = useCallback(() => {
    if (docxEditActive && onSaveOperatorDocx) {
      void onSaveOperatorDocx();
      return;
    }
    void (onSaveOperatorDocInPlace ?? onSaveOperatorDocAsFile)();
  }, [
    docxEditActive,
    onSaveOperatorDocInPlace,
    onSaveOperatorDocAsFile,
    onSaveOperatorDocx,
  ]);

  const handleSaveAs = useCallback(() => {
    if (docxEditActive && onSaveOperatorDocxAs) {
      void onSaveOperatorDocxAs();
      return;
    }
    void onSaveOperatorDocAsFile();
  }, [docxEditActive, onSaveOperatorDocAsFile, onSaveOperatorDocxAs]);

  const copyLocalFilePath = useCallback(async () => {
    if (!resolvedPath) {
      toast.error("No file path available.");
      return;
    }
    try {
      await navigator.clipboard.writeText(resolvedPath);
      toast.success("File path copied.");
    } catch {
      toast.error("Could not copy file path.");
    }
  }, [resolvedPath]);

  const openLocalFileInSystem = useCallback(async () => {
    if (!resolvedPath) {
      toast.error("No file path available.");
      return;
    }
    const bridge = window.echoMirageOpen;
    if (!bridge?.openPath) {
      toast.error("Open in viewer requires the Echo Mirage desktop app.");
      return;
    }
    const result = await bridge.openPath(resolvedPath);
    if (!result.ok) {
      toast.error(result.error || "Could not open file.");
    }
  }, [resolvedPath]);

  return (
    <div
      data-morphism={MORPHISM_ZONE_ASCIIMORPHISM}
      className="z-10 flex w-full min-w-0 shrink-0 flex-wrap items-center justify-end gap-1.5 overflow-hidden border-b border-[#141414] bg-black px-3 py-2"
    >
      {binaryPreview ? (
        <>
          <span className="mr-auto font-mono text-[9px] tracking-[0.08em] text-[#5a5a5a]">
            {previewSurface.toUpperCase()} PREVIEW
          </span>
          <OperatorDocTypeMenu
            trigger="toolbar"
            value={normalizeOperatorDocumentKind(operatorDocumentKind)}
            onChange={onOperatorDocumentKindChange}
          />
          <OperatorConvertPicker
            disabled={converting || convertOptions.length === 0}
            options={convertOptions}
            onConvert={onConvert}
          />
          <span className="mx-0.5 h-4 w-px shrink-0 bg-[#2d2d2d]" aria-hidden />
          <OperatorToolbarIconButton
            label="Copy file path"
            onClick={() => void copyLocalFilePath()}
            disabled={!resolvedPath}
          >
            <CodexIcon icon={cdxIconCopy} className="h-3.5 w-3.5" />
          </OperatorToolbarIconButton>
          <OperatorToolbarIconButton
            label="Open in system viewer"
            onClick={() => void openLocalFileInSystem()}
            disabled={!resolvedPath}
          >
            <LuExternalLink className="h-3.5 w-3.5" />
          </OperatorToolbarIconButton>
        </>
      ) : (
        <>
      {textEditingEnabled ? (
        <>
          <OperatorToolbarIconButton label="Undo" onClick={onUndo} disabled={!editToolsEnabled || !canUndo}>
            <CodexIcon icon={cdxIconUndo} className="h-3.5 w-3.5" />
          </OperatorToolbarIconButton>
          <OperatorToolbarIconButton label="Redo" onClick={onRedo} disabled={!editToolsEnabled || !canRedo}>
            <CodexIcon icon={cdxIconRedo} className="h-3.5 w-3.5" />
          </OperatorToolbarIconButton>
          <OperatorToolbarIconButton label="Clear document" onClick={onClear} disabled={!editToolsEnabled || !canClear}>
            <CodexIcon icon={cdxIconTrash} className="h-3.5 w-3.5" />
          </OperatorToolbarIconButton>
          <span className="mx-0.5 h-4 w-px shrink-0 bg-[#2d2d2d]" aria-hidden />
        </>
      ) : null}
      {!textEditingEnabled ? (
        <OperatorDocTypeMenu
          trigger="toolbar"
          value={normalizeOperatorDocumentKind(operatorDocumentKind)}
          onChange={onOperatorDocumentKindChange}
        />
      ) : null}
      <OperatorConvertPicker
        disabled={converting || convertOptions.length === 0}
        options={convertOptions}
        onConvert={onConvert}
      />
      {textEditingEnabled ? (
        <>
          <OperatorToolbarIconButton
            label="Copy"
            onClick={() => void onCopyOperatorDocToClipboard()}
          >
            <CodexIcon icon={cdxIconCopy} className="h-3.5 w-3.5" />
          </OperatorToolbarIconButton>
          <OperatorToolbarIconButton
            label="Paste"
            onClick={() => void onPasteClipboardToOperator()}
            disabled={!editToolsEnabled}
          >
            <CodexIcon icon={cdxIconPaste} className="h-3.5 w-3.5" />
          </OperatorToolbarIconButton>
        </>
      ) : null}
        </>
      )}
      {showSaveControls ? (
        <>
          <span className="mx-0.5 h-4 w-px shrink-0 bg-[#2d2d2d]" aria-hidden />
          <OperatorToolbarIconButton
            label="Save"
            onClick={handleSave}
            disabled={saveInPlaceDisabled}
          >
            <LuSave className="h-3.5 w-3.5" />
          </OperatorToolbarIconButton>
          <OperatorToolbarIconButton
            label="Save as"
            onClick={handleSaveAs}
            disabled={saveAsDisabled}
          >
            <CodexIcon icon={cdxIconDownload} className="h-3.5 w-3.5" />
          </OperatorToolbarIconButton>
        </>
      ) : null}
    </div>
  );
}

export function CyberdeckOperatorPaneBody({
  isOperatorDragOver,
  operatorDroppedAsset,
  operatorSurfaceMode,
  operatorBrowserEngine,
  operatorSurfaceIsDocument,
  operatorBrowserUrl,
  operatorDocMode,
  operatorDocNameDraft,
  operatorActiveFilePath,
  operatorNameInputRef,
  operatorBrowserRef,
  onOperatorDragOver,
  onOperatorDragLeave,
  onOperatorDrop,
  onOperatorDocNameDraftChange,
  onCommitOperatorDocName,
  onSetOperatorDocMode,
  onOperatorBrowserNavigate,
  onOperatorBrowserUrlChange,
  onSetOperatorSurfaceMode,
  onPasteClipboardToOperator,
  onSaveOperatorDocInPlace,
  onSaveOperatorDocAsFile,
  operatorCanSaveInPlace = false,
  onCopyOperatorDocToClipboard,
  onClearOperatorDocument,
  onOperatorDocumentTextChange,
  operatorDocumentKind,
  onOperatorDocumentKindChange,
  onOpenOperatorFolderFile,
  onOperatorFolderRootsChange,
  operatorCanNavigateFileBack,
  operatorCanNavigateFileForward,
  onOperatorFileHistoryBack,
  onOperatorFileHistoryForward,
  onConvertDocumentToMarkdown,
  onExportOperatorMarkdown,
}: OperatorPaneBodyProps) {
  const [browserDraft, setBrowserDraft] = useState(operatorBrowserUrl);
  const [browserCanGoBack, setBrowserCanGoBack] = useState(false);
  const [browserCanGoForward, setBrowserCanGoForward] = useState(false);
  const [folderPaneOpen, setFolderPaneOpen] = useState(readPersistedFolderPaneOpen);
  const [folderPaneWidth, setFolderPaneWidth] = useState(readPersistedFolderPaneWidth);
  const [imageZoom, setImageZoom] = useState<number>(1);
  const imageZoomIndexRef = useRef(3);
  const operatorAssetKeyRef = useRef("");
  const operatorApplyRef = useRef(false);
  const operatorDocHistoryTextRef = useRef("");
  const folderPaneResizeRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const {
    canUndo: operatorCanUndo,
    canRedo: operatorCanRedo,
    setText: setOperatorDocHistoryText,
    undo: undoOperatorDoc,
    redo: redoOperatorDoc,
    reset: resetOperatorDocHistory,
  } = useGlyphTextHistory("");

  const operatorDocText = operatorDroppedAsset?.text || "";
  const operatorAssetSurface = operatorDroppedAsset
    ? resolveOperatorAssetSurface(operatorDroppedAsset)
    : null;
  const operatorRenderSurface: OperatorAssetSurface | null = (() => {
    if (!operatorDroppedAsset) return null;
    if (
      operatorDocText &&
      !analyzeTextForBinaryDisplay(operatorDocText, { fileName: operatorDroppedAsset.name }).safe
    ) {
      const lowerName = operatorDroppedAsset.name.toLowerCase();
      if (
        operatorDocText.trimStart().startsWith("%PDF") ||
        lowerName.endsWith(".pdf") ||
        operatorDroppedAsset.kind === "pdf"
      ) {
        return "pdf";
      }
      return "binary-unsafe";
    }
    return operatorAssetSurface;
  })();
  const operatorTextDocument =
    operatorRenderSurface != null
      ? isOperatorTextEditableSurface(operatorRenderSurface)
      : false;
  const operatorShowsMarkdown =
    operatorTextDocument && normalizeOperatorDocumentKind(operatorDocumentKind) === "markdown";
  const operatorConvertOptions: OperatorConvertOption[] = (() => {
    if (operatorShowsMarkdown) {
      return [
        { format: "markdown", disabled: true, disabledReason: "Already Markdown" },
        { format: "docx" },
        { format: "pdf" },
      ];
    }
    if (operatorRenderSurface === "pdf") {
      return [
        { format: "pdf", disabled: true, disabledReason: "Already PDF" },
        { format: "markdown" },
        { format: "docx" },
      ];
    }
    if (operatorRenderSurface === "docx") {
      return [
        { format: "docx", disabled: true, disabledReason: "Already DOCX" },
        { format: "markdown" },
        { format: "pdf" },
      ];
    }
    if (operatorRenderSurface === "office-unsupported") {
      return [{ format: "markdown" }];
    }
    if (operatorRenderSurface === "binary-unsafe") {
      return [{ format: "markdown" }];
    }
    return [];
  })();
  const [convertPickBusy, setConvertPickBusy] = useState(false);
  const convertInputRef = useRef<HTMLInputElement>(null);
  const docxSaveHandlerRef = useRef<(() => Promise<void>) | null>(null);
  const docxSaveAsHandlerRef = useRef<(() => Promise<void>) | null>(null);

  const runConvertFromPath = useCallback(
    async (filePath: string, options?: { edit?: boolean }) => {
      setConvertPickBusy(true);
      try {
        await onConvertDocumentToMarkdown(filePath, options);
      } finally {
        setConvertPickBusy(false);
      }
    },
    [onConvertDocumentToMarkdown],
  );

  const convertDocumentPathToMarkdown = useCallback(async (filePath: string) => {
    const res = await fetch("/api/convert-document-to-markdown", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filePath }),
    });
    const payload = (await res.json()) as {
      ok?: boolean;
      markdown?: string;
      outputPath?: string;
      error?: string;
    };
    if (!res.ok || !payload.ok || !payload.markdown) {
      throw new Error(payload.error || "Conversion failed");
    }
    return {
      markdown: payload.markdown,
      outputName:
        payload.outputPath?.split(/[/\\]/).pop() ||
        filePath.replace(/\.(pdf|docx)$/i, ".md").split(/[/\\]/).pop() ||
        "converted.md",
    };
  }, []);

  const handlePickConvertDocument = useCallback(async () => {
    const openBridge = window.echoMirageOpen;
    if (openBridge?.pickConvertDocument) {
      const result = await openBridge.pickConvertDocument();
      if (result.error) {
        toast.error(result.error);
        return;
      }
      if (!result.canceled && result.filePath) {
        await runConvertFromPath(result.filePath);
      }
      return;
    }
    convertInputRef.current?.click();
  }, [runConvertFromPath]);

  const handleConvertActiveDocument = useCallback(async () => {
    const path = operatorActiveFilePath?.trim();
    if (path && isConvertibleDocumentPath(path)) {
      await runConvertFromPath(path);
      return;
    }
    await handlePickConvertDocument();
  }, [handlePickConvertDocument, operatorActiveFilePath, runConvertFromPath]);

  const handleConvertActiveDocumentFormat = useCallback(
    async (format: OperatorConvertFormat) => {
      if (format === "markdown") {
        await handleConvertActiveDocument();
        return;
      }

      const path = operatorDroppedAsset?.localFilePath?.trim() || operatorActiveFilePath?.trim();
      if (!path || !isConvertibleDocumentPath(path)) {
        toast.error("Open a local PDF or DOCX file first.");
        return;
      }

      setConvertPickBusy(true);
      try {
        const converted = await convertDocumentPathToMarkdown(path);
        const sourceName = operatorDroppedAsset?.name || converted.outputName;
        if (format === "docx") {
          const result = await exportMarkdownToDocx({
            markdown: converted.markdown,
            suggestedFilename: docxFilenameFromMarkdownName(sourceName),
            localFilePath: path,
          });
          if (result.canceled) {
            toast.info("DOCX conversion canceled.");
            return;
          }
          toast.success(result.outputPath ? `Converted DOCX to ${result.outputPath}` : "Converted DOCX.");
          return;
        }

        const result = await exportMarkdownToPdf({
          markdown: converted.markdown,
          suggestedFilename: pdfFilenameFromMarkdownName(sourceName),
          localFilePath: path,
        });
        if (result.canceled) {
          toast.info("PDF conversion canceled.");
          return;
        }
        toast.success(result.outputPath ? `Converted PDF to ${result.outputPath}` : "Converted PDF.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Conversion failed.");
      } finally {
        setConvertPickBusy(false);
      }
    },
    [
      convertDocumentPathToMarkdown,
      handleConvertActiveDocument,
      operatorActiveFilePath,
      operatorDroppedAsset?.localFilePath,
      operatorDroppedAsset?.name,
    ],
  );

  const handleSharedConvert = useCallback(
    async (format: OperatorConvertFormat) => {
      if (operatorShowsMarkdown) {
        if (format === "markdown") return;
        await onExportOperatorMarkdown(format);
        return;
      }
      await handleConvertActiveDocumentFormat(format);
    },
    [handleConvertActiveDocumentFormat, onExportOperatorMarkdown, operatorShowsMarkdown],
  );

  const operatorFileSizeLabel = operatorDroppedAsset
    ? `// ${Math.max(1, Math.round(operatorDroppedAsset.size / 1024))} KB`
    : null;

  useEffect(() => {
    setBrowserDraft(operatorBrowserUrl);
  }, [operatorBrowserUrl]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.localStorage === "undefined") return;
    try {
      window.localStorage.setItem(OPERATOR_FOLDER_PANE_OPEN_KEY, folderPaneOpen ? "1" : "0");
    } catch {
      /* ignore storage failures */
    }
  }, [folderPaneOpen]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.localStorage === "undefined") return;
    try {
      window.localStorage.setItem(OPERATOR_FOLDER_PANE_WIDTH_KEY, String(folderPaneWidth));
    } catch {
      /* ignore storage failures */
    }
  }, [folderPaneWidth]);

  const beginFolderPaneResize = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      folderPaneResizeRef.current = { startX: event.clientX, startWidth: folderPaneWidth };
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const resizeStart = folderPaneResizeRef.current;
        if (!resizeStart) return;
        setFolderPaneWidth(clampFolderPaneWidth(resizeStart.startWidth - (moveEvent.clientX - resizeStart.startX)));
      };

      const stopResize = () => {
        folderPaneResizeRef.current = null;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", stopResize);
        window.removeEventListener("pointercancel", stopResize);
      };

      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", stopResize);
      window.addEventListener("pointercancel", stopResize);
    },
    [folderPaneWidth],
  );

  useEffect(() => {
    imageZoomIndexRef.current = 3;
    setImageZoom(1);
  }, [operatorDroppedAsset?.imageSrc]);

  const applyOperatorDocText = useCallback(
    (next: string, mode: "immediate" | "debounced" | "skip" = "immediate") => {
      operatorApplyRef.current = true;
      setOperatorDocHistoryText(next, mode);
      onOperatorDocumentTextChange(next);
      operatorDocHistoryTextRef.current = next;
      queueMicrotask(() => {
        operatorApplyRef.current = false;
      });
    },
    [onOperatorDocumentTextChange, setOperatorDocHistoryText],
  );

  useEffect(() => {
    if (!operatorTextDocument || !operatorDroppedAsset) return;
    const key = `${operatorDroppedAsset.kind}::${operatorDroppedAsset.name}`;
    if (key !== operatorAssetKeyRef.current) {
      operatorAssetKeyRef.current = key;
      resetOperatorDocHistory(operatorDocText);
      operatorDocHistoryTextRef.current = operatorDocText;
      return;
    }
    if (operatorApplyRef.current) return;
    if (operatorDocText === operatorDocHistoryTextRef.current) return;
    setOperatorDocHistoryText(operatorDocText, "immediate");
    operatorDocHistoryTextRef.current = operatorDocText;
  }, [
    operatorDocText,
    operatorDroppedAsset,
    operatorTextDocument,
    resetOperatorDocHistory,
    setOperatorDocHistoryText,
  ]);

  const handleOperatorUndo = useCallback(() => {
    const restored = undoOperatorDoc();
    if (restored == null) return;
    operatorApplyRef.current = true;
    onOperatorDocumentTextChange(restored);
    operatorDocHistoryTextRef.current = restored;
    queueMicrotask(() => {
      operatorApplyRef.current = false;
    });
  }, [onOperatorDocumentTextChange, undoOperatorDoc]);

  const handleOperatorRedo = useCallback(() => {
    const restored = redoOperatorDoc();
    if (restored == null) return;
    operatorApplyRef.current = true;
    onOperatorDocumentTextChange(restored);
    operatorDocHistoryTextRef.current = restored;
    queueMicrotask(() => {
      operatorApplyRef.current = false;
    });
  }, [onOperatorDocumentTextChange, redoOperatorDoc]);

  const handleOperatorClear = useCallback(() => {
    if (onClearOperatorDocument) {
      onClearOperatorDocument();
      return;
    }
    if (!operatorDocText.trim()) return;
    applyOperatorDocText("", "immediate");
  }, [applyOperatorDocText, onClearOperatorDocument, operatorDocText]);

  const saveOperatorDocInPlaceAndMark = useCallback(async () => {
    if (!onSaveOperatorDocInPlace) return;
    await onSaveOperatorDocInPlace();
    window.dispatchEvent(new CustomEvent("echo-mirage-operator-file-saved"));
  }, [onSaveOperatorDocInPlace]);

  useEffect(() => {
    if (operatorSurfaceMode !== "browser") {
      setBrowserCanGoBack(false);
      setBrowserCanGoForward(false);
      return;
    }
    const view = operatorBrowserRef.current;
    if (!view) return;

    view.setAttribute("allowpopups", "");

    const blockDrop = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
    };

    const syncNavState = () => {
      const nav = readWebviewNavigationState(view);
      setBrowserCanGoBack(nav.canGoBack);
      setBrowserCanGoForward(nav.canGoForward);
    };

    const syncUrl = () => {
      try {
        const currentUrl = view.getURL();
        if (currentUrl) {
          // Keep browser state in sync with the guest view without re-triggering navigation.
          onOperatorBrowserUrlChange(currentUrl);
        }
      } catch {
        /* ignore */
      }
      syncNavState();
    };

    view.addEventListener("dom-ready", syncNavState as EventListener);
    view.addEventListener("did-navigate", syncUrl as EventListener);
    view.addEventListener("did-navigate-in-page", syncUrl as EventListener);
    view.addEventListener("page-title-updated", syncUrl as EventListener);
    view.addEventListener("dragover", blockDrop);
    view.addEventListener("drop", blockDrop);

    return () => {
      view.removeEventListener("dom-ready", syncNavState as EventListener);
      view.removeEventListener("did-navigate", syncUrl as EventListener);
      view.removeEventListener("did-navigate-in-page", syncUrl as EventListener);
      view.removeEventListener("page-title-updated", syncUrl as EventListener);
      view.removeEventListener("dragover", blockDrop);
      view.removeEventListener("drop", blockDrop);
    };
  }, [onOperatorBrowserUrlChange, operatorBrowserRef, operatorSurfaceMode]);

  // Send Monaco editor state to MUTHUR observation store
  useEffect(() => {
    if (!operatorTextDocument || !operatorDroppedAsset) return;

    // Get live context from MonacoEditorContext store
    const ctx = getMonacoEditorContext();

    // Also read current text from operatorDocText as fallback
    const content = ctx.contentLength > 0 ? ctx.content : operatorDocText;
    const dirty = ctx.dirty ?? (operatorDocText !== operatorDocHistoryTextRef.current);
    const filePath = operatorActiveFilePath ?? ctx.filePath ?? null;

    void publishMuthurObservation({
      route: typeof window !== "undefined" ? window.location.pathname : "/",
      surface: "cyberdeck",
      activeTab: null,
      activePane: "operator",
      visibleDocument: operatorDroppedAsset.name,
      documentExcerpt: content.slice(0, 200) + (content.length > 200 ? "..." : ""),
      editor: {
        active: ctx.active ?? true,
        filePath,
        fileName: operatorDroppedAsset.name,
        fileExtension: filePath?.includes(".") ? filePath.split(".").pop() ?? null : null,
        language: ctx.language ?? detectOperatorEditorLanguage(operatorDroppedAsset.name),
        content,
        contentExcerpt: content.slice(0, 200) + (content.length > 200 ? "..." : ""),
        selectionText: ctx.selectionText ?? null,
        cursorLine: ctx.cursorLine ?? null,
        cursorColumn: ctx.cursorColumn ?? null,
        dirty,
        readOnly: operatorDocMode !== "edit",
      },
    });
  }, [operatorTextDocument, operatorDroppedAsset, operatorActiveFilePath, operatorDocText, operatorDocMode]);

  // Tell MUTHUR when a DOCX (not Monaco) is open in the operator pane
  useEffect(() => {
    if (operatorRenderSurface !== "docx" || !operatorDroppedAsset) return;

    const filePath = operatorActiveFilePath ?? operatorDroppedAsset.localFilePath ?? null;

    void publishMuthurObservation({
      route: typeof window !== "undefined" ? window.location.pathname : "/",
      surface: "cyberdeck",
      activeTab: null,
      activePane: "operator",
      visibleDocument: operatorDroppedAsset.name,
      documentExcerpt: `DOCX // EDIT // ${operatorDroppedAsset.name}`,
      editor: {
        active: false,
        filePath,
        fileName: operatorDroppedAsset.name,
        fileExtension: "docx",
        language: "docx",
        content: null,
        contentExcerpt:
          "(DOCX WYSIWYG — MUTHUR cannot type here directly; convert to markdown for text edits)",
        selectionText: null,
        cursorLine: null,
        cursorColumn: null,
        dirty: false,
        readOnly: false,
      },
    });
  }, [
    operatorActiveFilePath,
    operatorDroppedAsset,
    operatorRenderSurface,
  ]);

  const navigateBrowser = () => {
    const nextUrl = browserDraft.trim();
    if (!nextUrl) return;
    onOperatorBrowserNavigate(nextUrl);
  };

  const returnToDocumentMode = useCallback(() => {
    onSetOperatorSurfaceMode("workspace");
    setFolderPaneOpen(true);
  }, [onSetOperatorSurfaceMode]);

  const folderPaneRail =
    operatorSurfaceMode === "workspace" && folderPaneOpen ? (
      <>
        <button
          type="button"
          role="separator"
          aria-label="Resize folder pane"
          aria-orientation="vertical"
          title="Resize folder pane"
          onPointerDown={beginFolderPaneResize}
          onDoubleClick={() => setFolderPaneWidth(OPERATOR_FOLDER_PANE_DEFAULT_WIDTH)}
          className="group relative z-10 w-2 shrink-0 cursor-col-resize border-l border-[#141414] bg-black transition hover:border-emerald-500/50 focus:outline-none focus-visible:border-emerald-400/80"
        >
          <span className="absolute left-1/2 top-1/2 h-10 w-px -translate-x-1/2 -translate-y-1/2 bg-[#2d2d2d] transition group-hover:bg-emerald-400/70" />
        </button>
        <div
          className="min-w-0 shrink-0 border-l border-[#1c1c1c]"
          style={{ width: `${folderPaneWidth}px` }}
        >
          <OperatorDocFolderPane
            className="w-full"
            onOpenFile={onOpenOperatorFolderFile}
            onRootsChange={onOperatorFolderRootsChange}
          />
        </div>
      </>
    ) : null;

  return (
    <CyberdeckPaneTooltipProvider delayDuration={300} disableHoverableContent>
    <div
      className={`flex min-h-0 flex-1 flex-col bg-black p-4 ${
        isOperatorDragOver ? "ring-2 ring-amber-500/50 ring-inset" : ""
      }`}
      onDragOver={operatorSurfaceMode === "browser" ? (event) => {
        event.preventDefault();
        event.stopPropagation();
      } : onOperatorDragOver}
      onDragLeave={operatorSurfaceMode === "browser" ? (event) => {
        event.preventDefault();
        event.stopPropagation();
      } : onOperatorDragLeave}
      onDrop={operatorSurfaceMode === "browser" ? (event) => {
        event.preventDefault();
        event.stopPropagation();
      } : onOperatorDrop}
    >
      <div
        className={`flex min-h-0 flex-1 flex-col overflow-hidden rounded-sm border border-[#141414] bg-black transition-colors ${
          isOperatorDragOver ? "border-amber-500/60 ring-2 ring-amber-500/35 ring-inset" : ""
        }`}
        data-observing="true"
      >
        <CyberdeckPaneHeader
          className="z-20 shrink-0 overflow-hidden bg-black py-2"
          left={
            operatorSurfaceMode === "browser" ? (
              <CyberdeckPaneHeaderTitle style={{ textShadow: "0 0 6px rgba(138,138,138,0.2)" }}>
                MUTHUR_BROWSER
              </CyberdeckPaneHeaderTitle>
            ) : operatorDroppedAsset && operatorSurfaceMode === "workspace" ? (
              <OperatorDocumentTitleRow
                operatorDocMode={operatorDocMode}
                operatorDocNameDraft={operatorDocNameDraft}
                operatorNameInputRef={operatorNameInputRef}
                operatorDroppedAsset={operatorDroppedAsset}
                operatorFileSizeLabel={operatorFileSizeLabel}
                operatorCanNavigateFileBack={operatorCanNavigateFileBack}
                operatorCanNavigateFileForward={operatorCanNavigateFileForward}
                onOperatorDocNameDraftChange={onOperatorDocNameDraftChange}
                onCommitOperatorDocName={onCommitOperatorDocName}
                onOperatorFileHistoryBack={onOperatorFileHistoryBack}
                onOperatorFileHistoryForward={onOperatorFileHistoryForward}
              />
            ) : (
              <div className="flex min-w-0 items-center gap-2">
                {operatorActiveFilePath ? (
                  <OperatorFileHistoryNav
                    canBack={operatorCanNavigateFileBack}
                    canForward={operatorCanNavigateFileForward}
                    onBack={onOperatorFileHistoryBack}
                    onForward={onOperatorFileHistoryForward}
                  />
                ) : null}
                <CyberdeckPaneHeaderTitle
                  className="min-w-0 flex-1"
                  style={{ textShadow: "0 0 6px rgba(138,138,138,0.2)" }}
                >
                  {operatorDroppedAsset ? operatorDroppedAsset.name : "OPERATOR_DOC_SURFACE"}
                </CyberdeckPaneHeaderTitle>
                {operatorDroppedAsset && operatorFileSizeLabel ? (
                  <span className="shrink-0 font-mono text-[9px] tracking-[0.04em] text-[#5a5a5a]">
                    {operatorFileSizeLabel}
                  </span>
                ) : null}
              </div>
            )
          }
          right={
            operatorSurfaceMode === "browser" ? (
              <div className="flex items-center gap-2 font-mono text-[9px] tracking-[0.08em]">
                <OperatorReturnToDocumentButton onClick={returnToDocumentMode} />
                <span className="text-emerald-200">LIVE WEB</span>
                <span className="rounded border border-[#2d2d2d] px-2 py-0.5 text-[#8a8a8a]">
                  ENGINE: {operatorBrowserEngine}
                </span>
              </div>
            ) : operatorDroppedAsset && operatorSurfaceMode === "workspace" ? (
              <OperatorDocumentHeaderControls
                operatorDocMode={operatorDocMode}
                folderPaneOpen={folderPaneOpen}
                onCommitOperatorDocName={onCommitOperatorDocName}
                onSetOperatorDocMode={onSetOperatorDocMode}
                onToggleFolderPane={() => setFolderPaneOpen((open) => !open)}
              />
            ) : operatorDroppedAsset ? (
              <OperatorViewEditControls
                operatorDocMode={operatorDocMode}
                onCommitOperatorDocName={onCommitOperatorDocName}
                onSetOperatorDocMode={onSetOperatorDocMode}
              />
            ) : null
          }
        />
        {operatorSurfaceMode === "browser" ? (
          <div
            data-morphism={MORPHISM_ZONE_ASCIIMORPHISM}
            className="flex w-full shrink-0 flex-wrap items-center justify-end gap-1.5 border-b border-[#141414] bg-black px-3 py-2"
          >
            <OperatorReturnToDocumentButton onClick={returnToDocumentMode} />
            <OperatorToolbarIconButton
              label="Paste"
              onClick={() => void onPasteClipboardToOperator()}
            >
              <CodexIcon icon={cdxIconPaste} className="h-3.5 w-3.5" />
            </OperatorToolbarIconButton>
          </div>
        ) : null}
        {operatorDroppedAsset && operatorSurfaceMode === "workspace" ? (
          <OperatorDocumentToolStrip
            operatorDocumentKind={operatorDocumentKind}
            previewSurface={operatorRenderSurface}
            localFilePath={operatorActiveFilePath ?? operatorDroppedAsset.localFilePath ?? null}
            textEditingEnabled={operatorTextDocument}
            editToolsEnabled={operatorTextDocument && operatorDocMode === "edit"}
            convertOptions={operatorConvertOptions}
            converting={convertPickBusy}
            onConvert={handleSharedConvert}
            canUndo={operatorCanUndo}
            canRedo={operatorCanRedo}
            canClear={Boolean(
              operatorDocText.trim() ||
                operatorDocNameDraft.trim() ||
                operatorDroppedAsset?.name?.trim(),
            )}
            onUndo={handleOperatorUndo}
            onRedo={handleOperatorRedo}
            onClear={handleOperatorClear}
            onOperatorDocumentKindChange={onOperatorDocumentKindChange}
            onCopyOperatorDocToClipboard={onCopyOperatorDocToClipboard}
            onPasteClipboardToOperator={onPasteClipboardToOperator}
            onSaveOperatorDocInPlace={saveOperatorDocInPlaceAndMark}
            onSaveOperatorDocAsFile={onSaveOperatorDocAsFile}
            operatorCanSaveInPlace={operatorCanSaveInPlace}
            docxEditActive={operatorRenderSurface === "docx" && operatorDocMode === "edit"}
            onSaveOperatorDocx={async () => {
              await docxSaveHandlerRef.current?.();
            }}
            onSaveOperatorDocxAs={async () => {
              await docxSaveAsHandlerRef.current?.();
            }}
          />
        ) : null}
        <div className="custom-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto">
        {operatorSurfaceMode === "browser" ? (
          <div
            className="flex min-h-0 flex-1 flex-col gap-3 p-3"
            onDragOver={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
            onDrop={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
          >
            <div className="flex items-center gap-2 rounded-sm border border-[#1c1c1c] bg-black/80 p-2">
              <CyberdeckActionButton
                variant="neutral"
                onClick={() => {
                  try {
                    operatorBrowserRef.current?.goBack();
                  } catch {
                    /* webview not ready */
                  }
                }}
                disabled={!browserCanGoBack}
              >
                BACK
              </CyberdeckActionButton>
              <CyberdeckActionButton
                variant="neutral"
                onClick={() => {
                  try {
                    operatorBrowserRef.current?.goForward();
                  } catch {
                    /* webview not ready */
                  }
                }}
                disabled={!browserCanGoForward}
              >
                FORWARD
              </CyberdeckActionButton>
              <CyberdeckActionButton
                variant="neutral"
                onClick={() => {
                  try {
                    operatorBrowserRef.current?.reload();
                  } catch {
                    /* webview not ready */
                  }
                }}
              >
                RELOAD
              </CyberdeckActionButton>
              <input
                value={browserDraft}
                onChange={(event) => setBrowserDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  event.preventDefault();
                  navigateBrowser();
                }}
                spellCheck={false}
                autoCapitalize="off"
                autoComplete="off"
                autoCorrect="off"
                aria-label="Browser address"
                className="min-w-0 flex-1 border-0 bg-transparent font-mono text-[10px] tracking-[0.04em] text-[#cfcfcf] outline-none placeholder:text-[#5a5a5a]"
                style={{ textShadow: "0 0 6px rgba(138,138,138,0.2)" }}
              />
              <CyberdeckActionButton variant="accent" onClick={navigateBrowser}>
                GO
              </CyberdeckActionButton>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden rounded-sm border border-[#1c1c1c] bg-black">
              <webview
                ref={operatorBrowserRef}
                src={operatorBrowserUrl}
                partition="persist:operator-browser"
                className="h-full w-full"
              />
            </div>
          </div>
        ) : operatorDroppedAsset ? (
          <div className="flex min-h-0 flex-1 overflow-hidden">
            <input
              ref={convertInputRef}
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="sr-only"
              aria-hidden
              tabIndex={-1}
              onChange={(event) => {
                void (async () => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (!file) return;
                  const filePath = (file as File & { path?: string }).path;
                  if (!filePath) {
                    toast.error("Could not read a local file path. Use the Echo Mirage desktop app.");
                    return;
                  }
                  if (!isConvertibleDocumentPath(filePath)) {
                    toast.error("Only .pdf and .docx files can be converted.");
                    return;
                  }
                  await runConvertFromPath(filePath);
                })();
              }}
            />
            <div className="custom-scrollbar min-w-0 flex-1 overflow-auto p-3">
            {operatorRenderSurface === "image" || operatorDroppedAsset.kind === "image" ? (
              <div className="rounded-sm border border-[#1c1c1c] bg-black/80 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="font-mono text-[9px] tracking-[0.04em] text-[#8a8a8a]">
                    IMAGE PREVIEW
                  </div>
                  <div className="flex items-center gap-1">
                    <CyberdeckControlTooltip
                      label="Zoom out"
                      disabled={imageZoomIndexRef.current === 0}
                    >
                      <CyberdeckControl
                        control={{ size: "micro" }}
                        onClick={() => {
                          const idx = imageZoomIndexRef.current;
                          if (idx > 0) {
                            imageZoomIndexRef.current = idx - 1;
                            setImageZoom(ZOOM_LEVELS[idx - 1]);
                          }
                        }}
                        disabled={imageZoomIndexRef.current === 0}
                        aria-label="Zoom out"
                      >
                        −
                      </CyberdeckControl>
                    </CyberdeckControlTooltip>
                    <span className="w-10 text-center font-mono text-[9px] tracking-[0.04em] text-[#8a8a8a]">
                      {Math.round(imageZoom * 100)}%
                    </span>
                    <CyberdeckControlTooltip
                      label="Zoom in"
                      disabled={imageZoomIndexRef.current === ZOOM_LEVELS.length - 1}
                    >
                      <CyberdeckControl
                        control={{ size: "micro" }}
                        onClick={() => {
                          const idx = imageZoomIndexRef.current;
                          if (idx < ZOOM_LEVELS.length - 1) {
                            imageZoomIndexRef.current = idx + 1;
                            setImageZoom(ZOOM_LEVELS[idx + 1]);
                          }
                        }}
                        disabled={imageZoomIndexRef.current === ZOOM_LEVELS.length - 1}
                        aria-label="Zoom in"
                      >
                        +
                      </CyberdeckControl>
                    </CyberdeckControlTooltip>
                    <CyberdeckControlTooltip label="Reset zoom">
                      <CyberdeckControl
                        control={{ size: "compact" }}
                        onClick={() => {
                          imageZoomIndexRef.current = 3;
                          setImageZoom(1);
                        }}
                        aria-label="Reset zoom"
                        className="ml-1"
                      >
                        FIT
                      </CyberdeckControl>
                    </CyberdeckControlTooltip>
                  </div>
                </div>
                {operatorDroppedAsset.imageSrc || operatorDroppedAsset.localFilePath ? (
                  <OperatorImagePreview
                    src={operatorDroppedAsset.imageSrc}
                    localFilePath={operatorDroppedAsset.localFilePath}
                    alt={operatorDroppedAsset.name}
                    zoom={imageZoom}
                    className="block w-full rounded-sm object-contain"
                  />
                ) : (
                  <div className="rounded-sm border border-dashed border-[#1c1c1c] bg-black p-4 font-mono text-[10px] leading-snug text-[#8a8a8a]">
                    Could not load image preview.
                  </div>
                )}
              </div>
            ) : operatorRenderSurface === "pdf" ? (
              <OperatorPdfPreview
                fileName={operatorDroppedAsset.name}
                pdfSrc={operatorDroppedAsset.pdfSrc}
                localFilePath={operatorDroppedAsset.localFilePath}
                mode={operatorDocMode}
              />
            ) : operatorRenderSurface === "docx" ? (
              <OperatorDocxWorkbench
                fileName={operatorDroppedAsset.name}
                docxSrc={operatorDroppedAsset.docxSrc}
                localFilePath={operatorDroppedAsset.localFilePath}
                mode={operatorDocMode}
                onBindDocxSave={(handler) => {
                  docxSaveHandlerRef.current = handler;
                }}
                onBindDocxSaveAs={(handler) => {
                  docxSaveAsHandlerRef.current = handler;
                }}
                onConvertToMarkdown={
                  operatorDroppedAsset.localFilePath
                    ? () =>
                        runConvertFromPath(operatorDroppedAsset.localFilePath!, { edit: true })
                    : undefined
                }
              />
            ) : operatorRenderSurface === "office-unsupported" ? (
              <OperatorUnsupportedPreview
                title="UNSUPPORTED PREVIEW"
                message="Office documents cannot be shown as plain text. Convert to Markdown to edit in the operator pane."
                fileName={operatorDroppedAsset.name}
              />
            ) : operatorRenderSurface === "binary-unsafe" ? (
              <OperatorUnsupportedPreview
                title="BINARY FILE DETECTED"
                message="This file cannot be displayed in the text viewer."
                fileName={operatorDroppedAsset.name}
              />
            ) : operatorTextDocument ? (
              operatorDocMode === "edit" ? (
                <OperatorMonacoWorkbench
                  activeFilePath={operatorActiveFilePath}
                  fileName={operatorDroppedAsset.name}
                  documentKind={operatorDocumentKind}
                  onDocumentKindChange={onOperatorDocumentKindChange}
                  value={operatorDocText}
                  onChange={(next) => applyOperatorDocText(next, "debounced")}
                  onSave={async () => {
                    if (operatorCanSaveInPlace && onSaveOperatorDocInPlace) {
                      await saveOperatorDocInPlaceAndMark();
                    } else {
                      await onSaveOperatorDocAsFile();
                    }
                  }}
                />
              ) : operatorShowsMarkdown ? (
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-sm border border-[#1c1c1c] bg-black">
                  <div className="flex items-center gap-1 border-b border-[#1c1c1c] px-2 py-1 font-mono text-[9px] tracking-[0.04em] text-[#8a8a8a]">
                    <OperatorDocTypeMenu
                      value={normalizeOperatorDocumentKind(operatorDocumentKind)}
                      onChange={onOperatorDocumentKindChange}
                      trigger="status"
                    />
                    <span>// VIEW</span>
                  </div>
                  <div className={`min-h-0 flex-1 overflow-auto ${OPERATOR_DOC_SURFACE_CLASS}`}>
                    <Streamdown className={OPERATOR_MARKDOWN_VIEW_CLASS}>
                      {operatorDocText}
                    </Streamdown>
                  </div>
                </div>
              ) : (
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-sm border border-[#1c1c1c] bg-black">
                  <div className="flex items-center gap-1 border-b border-[#1c1c1c] px-2 py-1 font-mono text-[9px] tracking-[0.04em] text-[#8a8a8a]">
                    <OperatorDocTypeMenu
                      value={normalizeOperatorDocumentKind(operatorDocumentKind)}
                      onChange={onOperatorDocumentKindChange}
                      trigger="status"
                    />
                    <span>// VIEW</span>
                  </div>
                  <pre
                    className={`min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words ${OPERATOR_DOC_SURFACE_CLASS}`}
                  >
                    {operatorDocText}
                  </pre>
                </div>
              )
            ) : (
              <div className="rounded-sm border border-dashed border-amber-700/60 bg-black p-4 font-mono text-[10px] leading-snug text-amber-300/90">
                {operatorDroppedAsset.kind === "video"
                  ? "Video preview comes next. Drop a code or text file to edit it here."
                  : "Drop or paste a code, text, markdown, or image file here to view and edit it."}
              </div>
            )}
            </div>
            {folderPaneRail}
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 overflow-hidden">
            <div className="flex flex-1 items-center justify-center p-6 text-center font-mono text-[10px] tracking-[0.08em] text-[#8a8a8a]">
              DROP OR PASTE CODE, TEXT, MARKDOWN, OR IMAGE FILES HERE TO VIEW AND EDIT THEM.
            </div>
            {folderPaneRail}
          </div>
        )}
        </div>
      </div>
    </div>
    </CyberdeckPaneTooltipProvider>
  );
}
