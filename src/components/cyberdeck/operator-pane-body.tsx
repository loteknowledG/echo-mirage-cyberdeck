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
  cdxIconUpload,
} from "@wikimedia/codex-icons";
import { LuPanelRightClose, LuPanelRightOpen, LuSave } from "react-icons/lu";
import { isConvertibleDocumentPath } from "@/lib/muthur-document-conversion-intent";
import { toast } from "sonner";
import { Streamdown } from "streamdown";
import { OperatorDocFolderPane } from "@/components/cyberdeck/operator-doc-folder-pane";
import type { OperatorDocFolderRoot } from "@/lib/operator-folder-nav";
import { CyberdeckPaneHeader, CyberdeckPaneHeaderTitle } from "@/components/cyberdeck/pane-header";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { OperatorDocTypePicker } from "@/components/cyberdeck/operator-doc-type-picker";
import {
  OperatorExportPicker,
  type OperatorExportFormat,
} from "@/components/cyberdeck/operator-export-picker";
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
import { useDeckMode } from "@/lib/deck-mode";
import {
  LEGACY_SWITCH_EMERALD,
  LEGACY_TOOLBAR_ICON,
  realmorphismActionClass,
  realmorphismControlClass,
} from "@/lib/cyberdeck/realmorphism-control";
import { MORPHISM_ZONE_ASCIIMORPHISM } from "@/lib/cyberdeck/morphism-zones";
import { useGlyphTextHistory } from "@/lib/use-glyph-text-history";
import { CodexIcon } from "@/components/codex-icon";

type DroppedOperatorAsset = {
  kind: string;
  name: string;
  mimeType: string;
  size: number;
  text?: string;
  imageSrc?: string;
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
  onConvertDocumentToMarkdown: (filePath: string) => void | Promise<void>;
  onExportOperatorMarkdown: (format: OperatorExportFormat) => void | Promise<void>;
};

const ZOOM_LEVELS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3] as const;

/** Shared document surface scale for operator view + edit modes. */
const OPERATOR_DOC_SURFACE_CLASS =
  "min-h-[50vh] w-full rounded-sm border border-[#1c1c1c] bg-black px-3 py-3 font-mono text-[12px] leading-snug text-green-200";

const OPERATOR_MARKDOWN_VIEW_CLASS =
  "max-w-none font-mono text-[12px] leading-snug text-green-200 [&_h1]:my-2 [&_h1]:font-mono [&_h1]:text-[12px] [&_h1]:font-normal [&_h2]:my-2 [&_h2]:font-mono [&_h2]:text-[12px] [&_h3]:font-mono [&_h3]:text-[12px] [&_p]:my-1 [&_li]:my-0 [&_pre]:my-2 [&_pre]:bg-black [&_pre]:text-green-300";

const OPERATOR_HEADER_ICON_BTN = LEGACY_TOOLBAR_ICON;
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
  latched = false,
  children,
}: {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  latched?: boolean;
  children: ReactNode;
}) {
  const deckMode = useDeckMode();
  const button = (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        realmorphismControlClass(deckMode, {
          size: "toolbar",
          latched,
          signal: latched,
          legacyClassName: OPERATOR_HEADER_ICON_BTN,
        }),
        disabled && "disabled:cursor-not-allowed disabled:opacity-30",
        className,
      )}
    >
      {children}
    </button>
  );

  return (
    <CyberdeckPaneTooltip label={label}>
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
        latched={operatorDocMode === "view"}
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
        latched={operatorDocMode === "edit"}
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
  onConvertDocumentToMarkdown,
  onExportOperatorMarkdown,
}: {
  operatorDocumentKind: OperatorDocumentPickerKind;
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
  onConvertDocumentToMarkdown: (filePath: string) => void | Promise<void>;
  onExportOperatorMarkdown: (format: OperatorExportFormat) => void | Promise<void>;
}) {
  const [converting, setConverting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const convertInputRef = useRef<HTMLInputElement>(null);

  const runConvert = useCallback(
    async (filePath: string) => {
      setConverting(true);
      try {
        await onConvertDocumentToMarkdown(filePath);
      } finally {
        setConverting(false);
      }
    },
    [onConvertDocumentToMarkdown],
  );

  const handlePickConvertDocument = useCallback(async () => {
    const openBridge = window.echoMirageOpen;
    if (openBridge?.pickConvertDocument) {
      const result = await openBridge.pickConvertDocument();
      if (result.error) {
        toast.error(result.error);
        return;
      }
      if (!result.canceled && result.filePath) {
        await runConvert(result.filePath);
      }
      return;
    }
    convertInputRef.current?.click();
  }, [runConvert]);

  const handleConvertFileInput = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
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
      await runConvert(filePath);
    },
    [runConvert],
  );

  return (
    <div
      data-morphism={MORPHISM_ZONE_ASCIIMORPHISM}
      className="flex w-full shrink-0 flex-wrap items-center justify-end gap-1.5 border-b border-[#141414] bg-black px-3 py-2"
    >
      <input
        ref={convertInputRef}
        type="file"
        accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="sr-only"
        aria-hidden
        tabIndex={-1}
        onChange={(event) => void handleConvertFileInput(event)}
      />
      <OperatorToolbarIconButton label="Undo" onClick={onUndo} disabled={!canUndo}>
        <CodexIcon icon={cdxIconUndo} className="h-3.5 w-3.5" />
      </OperatorToolbarIconButton>
      <OperatorToolbarIconButton label="Redo" onClick={onRedo} disabled={!canRedo}>
        <CodexIcon icon={cdxIconRedo} className="h-3.5 w-3.5" />
      </OperatorToolbarIconButton>
      <OperatorToolbarIconButton label="Clear document" onClick={onClear} disabled={!canClear}>
        <CodexIcon icon={cdxIconTrash} className="h-3.5 w-3.5" />
      </OperatorToolbarIconButton>
      <span className="mx-0.5 h-4 w-px shrink-0 bg-[#2d2d2d]" aria-hidden />
      <OperatorDocTypePicker
        value={normalizeOperatorDocumentKind(operatorDocumentKind)}
        onChange={onOperatorDocumentKindChange}
      />
      <OperatorToolbarIconButton
        label="Import MD"
        onClick={() => void handlePickConvertDocument()}
        disabled={converting}
      >
        <CodexIcon icon={cdxIconUpload} className="h-3.5 w-3.5" />
      </OperatorToolbarIconButton>
      <OperatorExportPicker
        disabled={exporting || normalizeOperatorDocumentKind(operatorDocumentKind) !== "markdown"}
        onExport={async (format) => {
          setExporting(true);
          try {
            await onExportOperatorMarkdown(format);
          } finally {
            setExporting(false);
          }
        }}
      />
      <OperatorToolbarIconButton
        label="Copy"
        onClick={() => void onCopyOperatorDocToClipboard()}
      >
        <CodexIcon icon={cdxIconCopy} className="h-3.5 w-3.5" />
      </OperatorToolbarIconButton>
      <OperatorToolbarIconButton
        label="Paste"
        onClick={() => void onPasteClipboardToOperator()}
      >
        <CodexIcon icon={cdxIconPaste} className="h-3.5 w-3.5" />
      </OperatorToolbarIconButton>
      <OperatorToolbarIconButton
        label="Save"
        onClick={() => void (onSaveOperatorDocInPlace ?? onSaveOperatorDocAsFile)()}
        disabled={!operatorCanSaveInPlace}
      >
        <LuSave className="h-3.5 w-3.5" />
      </OperatorToolbarIconButton>
      <OperatorToolbarIconButton
        label="Save as"
        onClick={() => void onSaveOperatorDocAsFile()}
      >
        <CodexIcon icon={cdxIconDownload} className="h-3.5 w-3.5" />
      </OperatorToolbarIconButton>
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
  operatorEditorRef,
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
  const deckMode = useDeckMode();
  const [browserDraft, setBrowserDraft] = useState(operatorBrowserUrl);
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
  const operatorShowsMarkdown = normalizeOperatorDocumentKind(operatorDocumentKind) === "markdown";
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
    if (!operatorSurfaceIsDocument || !operatorDroppedAsset) return;
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
    operatorSurfaceIsDocument,
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

  useEffect(() => {
    if (operatorSurfaceMode !== "browser") return;
    const view = operatorBrowserRef.current;
    if (!view) return;

    view.setAttribute("allowpopups", "");

    const blockDrop = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
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
    };

    view.addEventListener("did-navigate", syncUrl as EventListener);
    view.addEventListener("did-navigate-in-page", syncUrl as EventListener);
    view.addEventListener("page-title-updated", syncUrl as EventListener);
    view.addEventListener("dragover", blockDrop);
    view.addEventListener("drop", blockDrop);

    return () => {
      view.removeEventListener("did-navigate", syncUrl as EventListener);
      view.removeEventListener("did-navigate-in-page", syncUrl as EventListener);
      view.removeEventListener("page-title-updated", syncUrl as EventListener);
      view.removeEventListener("dragover", blockDrop);
      view.removeEventListener("drop", blockDrop);
    };
  }, [onOperatorBrowserUrlChange, operatorBrowserRef, operatorSurfaceMode]);

  const navigateBrowser = () => {
    const nextUrl = browserDraft.trim();
    if (!nextUrl) return;
    onOperatorBrowserNavigate(nextUrl);
  };

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
          className="z-20 shrink-0 bg-black py-2"
          left={
            operatorSurfaceMode === "browser" ? (
              <CyberdeckPaneHeaderTitle style={{ textShadow: "0 0 6px rgba(138,138,138,0.2)" }}>
                MUTHUR_BROWSER
              </CyberdeckPaneHeaderTitle>
            ) : operatorSurfaceIsDocument && operatorDroppedAsset ? (
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
                {operatorSurfaceIsDocument ? (
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
                <span className="text-emerald-200">LIVE WEB</span>
                <span className="rounded border border-[#2d2d2d] px-2 py-0.5 text-[#8a8a8a]">
                  ENGINE: {operatorBrowserEngine}
                </span>
              </div>
            ) : operatorSurfaceIsDocument && operatorDroppedAsset ? (
              <OperatorDocumentHeaderControls
                operatorDocMode={operatorDocMode}
                folderPaneOpen={folderPaneOpen}
                onCommitOperatorDocName={onCommitOperatorDocName}
                onSetOperatorDocMode={onSetOperatorDocMode}
                onToggleFolderPane={() => setFolderPaneOpen((open) => !open)}
              />
            ) : operatorDroppedAsset && !operatorSurfaceIsDocument ? (
              <div className="flex items-center gap-2 font-mono text-[9px] tracking-[0.08em] text-[#8a8a8a]">
                <span>{operatorDroppedAsset.kind.toUpperCase()}</span>
              </div>
            ) : (
              null
            )
          }
        />
        {operatorSurfaceMode === "browser" ? (
          <div
            data-morphism={MORPHISM_ZONE_ASCIIMORPHISM}
            className="flex w-full shrink-0 flex-wrap items-center justify-end gap-1.5 border-b border-[#141414] bg-black px-3 py-2"
          >
            <OperatorToolbarIconButton
              label="Paste"
              onClick={() => void onPasteClipboardToOperator()}
            >
              <CodexIcon icon={cdxIconPaste} className="h-3.5 w-3.5" />
            </OperatorToolbarIconButton>
          </div>
        ) : null}
        {operatorSurfaceIsDocument && operatorDroppedAsset ? (
          <OperatorDocumentToolStrip
            operatorDocumentKind={operatorDocumentKind}
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
            onSaveOperatorDocInPlace={onSaveOperatorDocInPlace}
            onSaveOperatorDocAsFile={onSaveOperatorDocAsFile}
            operatorCanSaveInPlace={operatorCanSaveInPlace}
            onConvertDocumentToMarkdown={onConvertDocumentToMarkdown}
            onExportOperatorMarkdown={onExportOperatorMarkdown}
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
              <button
                type="button"
                onClick={() => operatorBrowserRef.current?.goBack()}
                disabled={!operatorBrowserRef.current?.canGoBack()}
                className={realmorphismActionClass(deckMode, "neutral")}
              >
                BACK
              </button>
              <button
                type="button"
                onClick={() => operatorBrowserRef.current?.goForward()}
                disabled={!operatorBrowserRef.current?.canGoForward()}
                className={realmorphismActionClass(deckMode, "neutral")}
              >
                FORWARD
              </button>
              <button
                type="button"
                onClick={() => operatorBrowserRef.current?.reload()}
                className={realmorphismActionClass(deckMode, "neutral")}
              >
                RELOAD
              </button>
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
              <button
                type="button"
                onClick={navigateBrowser}
                className={realmorphismActionClass(deckMode, "accent")}
              >
                GO
              </button>
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
            <div className="custom-scrollbar min-w-0 flex-1 overflow-auto p-3">
            {operatorDroppedAsset.kind === "image" ? (
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
                      <button
                        type="button"
                        onClick={() => {
                          const idx = imageZoomIndexRef.current;
                          if (idx > 0) {
                            imageZoomIndexRef.current = idx - 1;
                            setImageZoom(ZOOM_LEVELS[idx - 1]);
                          }
                        }}
                        disabled={imageZoomIndexRef.current === 0}
                        aria-label="Zoom out"
                        className={realmorphismControlClass(deckMode, {
                          size: "micro",
                          legacyClassName:
                            "flex h-5 w-5 items-center justify-center rounded border border-[#2d2d2d] bg-black font-mono text-[9px] tracking-[0.04em] text-[#8a8a8a] transition hover:border-emerald-500/60 hover:text-emerald-200 disabled:cursor-not-allowed disabled:opacity-30",
                        })}
                      >
                        −
                      </button>
                    </CyberdeckControlTooltip>
                    <span className="w-10 text-center font-mono text-[9px] tracking-[0.04em] text-[#8a8a8a]">
                      {Math.round(imageZoom * 100)}%
                    </span>
                    <CyberdeckControlTooltip
                      label="Zoom in"
                      disabled={imageZoomIndexRef.current === ZOOM_LEVELS.length - 1}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          const idx = imageZoomIndexRef.current;
                          if (idx < ZOOM_LEVELS.length - 1) {
                            imageZoomIndexRef.current = idx + 1;
                            setImageZoom(ZOOM_LEVELS[idx + 1]);
                          }
                        }}
                        disabled={imageZoomIndexRef.current === ZOOM_LEVELS.length - 1}
                        aria-label="Zoom in"
                        className={realmorphismControlClass(deckMode, {
                          size: "micro",
                          legacyClassName:
                            "flex h-5 w-5 items-center justify-center rounded border border-[#2d2d2d] bg-black font-mono text-[9px] tracking-[0.04em] text-[#8a8a8a] transition hover:border-emerald-500/60 hover:text-emerald-200 disabled:cursor-not-allowed disabled:opacity-30",
                        })}
                      >
                        +
                      </button>
                    </CyberdeckControlTooltip>
                    <CyberdeckControlTooltip label="Reset zoom">
                      <button
                        type="button"
                        onClick={() => {
                          imageZoomIndexRef.current = 3;
                          setImageZoom(1);
                        }}
                        aria-label="Reset zoom"
                        className={realmorphismControlClass(deckMode, {
                          size: "compact",
                          legacyClassName:
                            "ml-1 flex h-5 items-center justify-center rounded border border-[#2d2d2d] bg-black px-1.5 font-mono text-[8px] tracking-[0.04em] text-[#8a8a8a] transition hover:border-emerald-500/60 hover:text-emerald-200",
                        })}
                      >
                        FIT
                      </button>
                    </CyberdeckControlTooltip>
                  </div>
                </div>
                {operatorDroppedAsset.imageSrc ? (
                  <div
                    className="overflow-auto rounded-sm border border-[#1c1c1c] bg-black"
                    style={{ maxHeight: "65vh" }}
                  >
                    <img
                      src={operatorDroppedAsset.imageSrc}
                      alt={operatorDroppedAsset.name}
                      style={{
                        transform: `scale(${imageZoom})`,
                        transformOrigin: "top left",
                        maxWidth: "none",
                      }}
                      className="block w-full rounded-sm object-contain"
                      draggable={false}
                    />
                  </div>
                ) : (
                  <div className="rounded-sm border border-dashed border-[#1c1c1c] bg-black p-4 font-mono text-[10px] leading-snug text-[#8a8a8a]">
                    Could not load image preview.
                  </div>
                )}
              </div>
            ) : operatorSurfaceIsDocument ? (
              operatorDocMode === "edit" ? (
                <Textarea
                  ref={operatorEditorRef}
                  value={operatorDocText}
                  onChange={(event) => applyOperatorDocText(event.target.value, "debounced")}
                  onKeyDown={(event) => {
                    if (!event.ctrlKey && !event.metaKey) return;
                    const key = event.key.toLowerCase();
                    if (key === "s") {
                      event.preventDefault();
                      if (operatorCanSaveInPlace && onSaveOperatorDocInPlace) {
                        void onSaveOperatorDocInPlace();
                      } else {
                        void onSaveOperatorDocAsFile();
                      }
                      return;
                    }
                    if (key === "z" && !event.shiftKey) {
                      event.preventDefault();
                      handleOperatorUndo();
                      return;
                    }
                    if (key === "y" || (key === "z" && event.shiftKey)) {
                      event.preventDefault();
                      handleOperatorRedo();
                    }
                  }}
                  spellCheck={false}
                  autoCapitalize="off"
                  autoComplete="off"
                  autoCorrect="off"
                  wrap="off"
                  className={`min-h-[50vh] resize-y overflow-auto shadow-none focus-visible:ring-1 focus-visible:ring-amber-500/40 ${OPERATOR_DOC_SURFACE_CLASS}`}
                />
              ) : operatorShowsMarkdown ? (
                <div className={OPERATOR_DOC_SURFACE_CLASS}>
                  <Streamdown className={OPERATOR_MARKDOWN_VIEW_CLASS}>
                    {operatorDocText}
                  </Streamdown>
                </div>
              ) : (
                <pre
                  className={`whitespace-pre-wrap break-words ${OPERATOR_DOC_SURFACE_CLASS}`}
                >
                  {operatorDocText}
                </pre>
              )
            ) : (
              <div className="rounded-sm border border-dashed border-amber-700/60 bg-black p-4 font-mono text-[10px] leading-snug text-amber-300/90">
                {operatorDroppedAsset.kind === "video"
                  ? "Video preview comes next. Drop a code or text file to edit it here."
                  : "Drop or paste a code, text, markdown, or image file here to view and edit it."}
              </div>
            )}
            </div>
            {operatorSurfaceIsDocument ? (
              folderPaneOpen ? (
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
              ) : null
            ) : null}
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center p-6 text-center font-mono text-[10px] tracking-[0.08em] text-[#8a8a8a]">
            DROP OR PASTE CODE, TEXT, MARKDOWN, OR IMAGE FILES HERE TO VIEW AND EDIT THEM.
          </div>
        )}
        </div>
      </div>
    </div>
    </CyberdeckPaneTooltipProvider>
  );
}
