'use client';

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Dispatch, DragEvent, RefObject, SetStateAction } from "react";
import { CopyIcon, DownloadIcon } from "@radix-ui/react-icons";
import { FaRegPaste } from "react-icons/fa6";
import { GrFormEdit, GrFormView } from "react-icons/gr";
import { LuArrowLeft, LuArrowRight, LuPanelRightClose, LuPanelRightOpen } from "react-icons/lu";
import { Streamdown } from "streamdown";
import { OperatorDocFolderPane } from "@/components/cyberdeck/operator-doc-folder-pane";
import type { OperatorDocFolderRoot } from "@/lib/operator-folder-nav";
import { CyberdeckPaneHeader, CyberdeckPaneHeaderTitle } from "@/components/cyberdeck/pane-header";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { OperatorDocTypePicker } from "@/components/cyberdeck/operator-doc-type-picker";
import {
  CyberdeckPaneTooltip,
  CyberdeckPaneTooltipProvider,
} from "@/components/cyberdeck/cyberdeck-pane-tooltip";
import {
  normalizeOperatorDocumentKind,
  type OperatorDocumentPickerKind,
} from "@/lib/operator-document-types";
import { cn } from "@/lib/utils";

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
  onSaveOperatorDocAsFile: () => void | Promise<void>;
  onCopyOperatorDocToClipboard: () => void | Promise<void>;
  onOperatorDocumentTextChange: (nextText: string) => void;
  operatorDocumentKind: OperatorDocumentPickerKind;
  onOperatorDocumentKindChange: (kind: OperatorDocumentPickerKind) => void;
  onOpenOperatorFolderFile: (path: string, file: File) => void | Promise<void>;
  onOperatorFolderRootsChange?: (roots: OperatorDocFolderRoot[]) => void;
  operatorCanNavigateFileBack: boolean;
  operatorCanNavigateFileForward: boolean;
  onOperatorFileHistoryBack: () => void;
  onOperatorFileHistoryForward: () => void;
};

const ZOOM_LEVELS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3] as const;

/** Shared document surface scale for operator view + edit modes. */
const OPERATOR_DOC_SURFACE_CLASS =
  "min-h-[50vh] w-full rounded-sm border border-[#1c1c1c] bg-black px-3 py-3 font-mono text-[12px] leading-snug text-green-200";

const OPERATOR_MARKDOWN_VIEW_CLASS =
  "max-w-none font-mono text-[12px] leading-snug text-green-200 [&_h1]:my-2 [&_h1]:font-mono [&_h1]:text-[12px] [&_h1]:font-normal [&_h2]:my-2 [&_h2]:font-mono [&_h2]:text-[12px] [&_h3]:font-mono [&_h3]:text-[12px] [&_p]:my-1 [&_li]:my-0 [&_pre]:my-2 [&_pre]:bg-black [&_pre]:text-green-300";

const OPERATOR_HEADER_ICON_BTN =
  "inline-flex h-7 w-7 items-center justify-center rounded border border-[#2d2d2d] bg-black text-[#8a8a8a] transition hover:border-emerald-500/60 hover:text-emerald-200";

function OperatorToolbarIconButton({
  label,
  onClick,
  disabled = false,
  className = "",
  children,
}: {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const button = (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={`${OPERATOR_HEADER_ICON_BTN} disabled:cursor-not-allowed disabled:opacity-30 ${className}`}
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
        <LuArrowLeft className="h-3.5 w-3.5" />
      </OperatorToolbarIconButton>
      <OperatorToolbarIconButton label="Next file" onClick={onForward} disabled={!canForward}>
        <LuArrowRight className="h-3.5 w-3.5" />
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
  return (
    <div className="flex shrink-0 items-center gap-1">
      <OperatorToolbarIconButton
        label="View"
        onClick={() => {
          onCommitOperatorDocName();
          onSetOperatorDocMode("view");
        }}
        className={operatorDocMode === "view" ? "border-emerald-500/60 text-emerald-200" : ""}
      >
        <GrFormView className="h-3.5 w-3.5" />
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
            className="data-[state=checked]:border-emerald-500/70 data-[state=checked]:bg-emerald-500/10 data-[state=unchecked]:border-[#2d2d2d] data-[state=unchecked]:bg-[#0c0c0c]"
          />
        </span>
      </CyberdeckPaneTooltip>
      <OperatorToolbarIconButton
        label="Edit"
        onClick={() => onSetOperatorDocMode("edit")}
        className={operatorDocMode === "edit" ? "border-emerald-500/60 text-emerald-200" : ""}
      >
        <GrFormEdit className="h-3.5 w-3.5" />
      </OperatorToolbarIconButton>
    </div>
  );
}

function OperatorDocumentToolbarRow({
  operatorDocMode,
  operatorDocNameDraft,
  operatorNameInputRef,
  operatorDroppedAsset,
  operatorFileSizeLabel,
  operatorDocumentKind,
  operatorCanNavigateFileBack,
  operatorCanNavigateFileForward,
  folderPaneOpen,
  onOperatorDocNameDraftChange,
  onCommitOperatorDocName,
  onSetOperatorDocMode,
  onOperatorFileHistoryBack,
  onOperatorFileHistoryForward,
  onOperatorDocumentKindChange,
  onCopyOperatorDocToClipboard,
  onPasteClipboardToOperator,
  onSaveOperatorDocAsFile,
  onToggleFolderPane,
}: {
  operatorDocMode: "view" | "edit";
  operatorDocNameDraft: string;
  operatorNameInputRef: RefObject<HTMLInputElement>;
  operatorDroppedAsset: DroppedOperatorAsset;
  operatorFileSizeLabel: string | null;
  operatorDocumentKind: OperatorDocumentPickerKind;
  operatorCanNavigateFileBack: boolean;
  operatorCanNavigateFileForward: boolean;
  folderPaneOpen: boolean;
  onOperatorDocNameDraftChange: (nextValue: string) => void;
  onCommitOperatorDocName: () => void;
  onSetOperatorDocMode: Dispatch<SetStateAction<"view" | "edit">>;
  onOperatorFileHistoryBack: () => void;
  onOperatorFileHistoryForward: () => void;
  onOperatorDocumentKindChange: (kind: OperatorDocumentPickerKind) => void;
  onCopyOperatorDocToClipboard: () => void | Promise<void>;
  onPasteClipboardToOperator: () => void | Promise<void>;
  onSaveOperatorDocAsFile: () => void | Promise<void>;
  onToggleFolderPane: () => void;
}) {
  const [nameFocused, setNameFocused] = useState(false);
  const displayName = operatorDroppedAsset.name || "OPERATOR_DOC_SURFACE";

  return (
    <CyberdeckPaneTooltipProvider delayDuration={300}>
      <div className="flex w-full min-w-0 flex-1 flex-wrap items-center gap-x-1.5 gap-y-1.5">
        <div className="flex min-w-0 flex-[1_1_8rem] items-center gap-1.5 overflow-hidden">
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
                "min-w-0 w-full flex-1 border-0 bg-transparent font-mono text-[10px] tracking-[0.04em] text-[#cfcfcf] outline-none placeholder:text-[#5a5a5a]",
                nameFocused && "ring-1 ring-emerald-500/35 ring-offset-0 ring-offset-black",
              )}
              style={{ textShadow: "0 0 6px rgba(138,138,138,0.2)" }}
            />
          ) : (
            <CyberdeckPaneTooltip
              label={displayName}
              contentClassName="max-w-[90vw] whitespace-nowrap text-left"
            >
              <span className="min-w-0 w-full flex-1 cursor-default overflow-hidden">
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

        <div className="ml-auto flex max-w-full basis-full flex-wrap items-center justify-end gap-1.5 sm:basis-auto">
          <OperatorDocTypePicker
            value={normalizeOperatorDocumentKind(operatorDocumentKind)}
            onChange={onOperatorDocumentKindChange}
          />

          <OperatorToolbarIconButton
            label="Copy"
            onClick={() => void onCopyOperatorDocToClipboard()}
          >
            <CopyIcon className="h-3.5 w-3.5" />
          </OperatorToolbarIconButton>
          <OperatorToolbarIconButton
            label="Paste"
            onClick={() => void onPasteClipboardToOperator()}
          >
            <FaRegPaste className="h-3.5 w-3.5" />
          </OperatorToolbarIconButton>
          <OperatorToolbarIconButton
            label="Save"
            onClick={() => void onSaveOperatorDocAsFile()}
          >
            <DownloadIcon className="h-3.5 w-3.5" />
          </OperatorToolbarIconButton>

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
      </div>
    </CyberdeckPaneTooltipProvider>
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
  onSaveOperatorDocAsFile,
  onCopyOperatorDocToClipboard,
  onOperatorDocumentTextChange,
  operatorDocumentKind,
  onOperatorDocumentKindChange,
  onOpenOperatorFolderFile,
  onOperatorFolderRootsChange,
  operatorCanNavigateFileBack,
  operatorCanNavigateFileForward,
  onOperatorFileHistoryBack,
  onOperatorFileHistoryForward,
}: OperatorPaneBodyProps) {
  const [browserDraft, setBrowserDraft] = useState(operatorBrowserUrl);
  const [folderPaneOpen, setFolderPaneOpen] = useState(false);
  const [imageZoom, setImageZoom] = useState<number>(1);
  const imageZoomIndexRef = useRef(3);

  const operatorDocText = operatorDroppedAsset?.text || "";
  const operatorShowsMarkdown = normalizeOperatorDocumentKind(operatorDocumentKind) === "markdown";
  const operatorFileSizeLabel = operatorDroppedAsset
    ? `// ${Math.max(1, Math.round(operatorDroppedAsset.size / 1024))} KB`
    : null;

  useEffect(() => {
    setBrowserDraft(operatorBrowserUrl);
  }, [operatorBrowserUrl]);

  useEffect(() => {
    imageZoomIndexRef.current = 3;
    setImageZoom(1);
  }, [operatorDroppedAsset?.imageSrc]);

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
      >
        <CyberdeckPaneHeader
          className={cn(
            "z-20 shrink-0 bg-black py-2",
            operatorSurfaceIsDocument && operatorDroppedAsset && "items-start",
          )}
          left={
            operatorSurfaceMode === "browser" ? (
              <CyberdeckPaneHeaderTitle style={{ textShadow: "0 0 6px rgba(138,138,138,0.2)" }}>
                MUTHUR_BROWSER
              </CyberdeckPaneHeaderTitle>
            ) : operatorSurfaceIsDocument && operatorDroppedAsset ? (
              <OperatorDocumentToolbarRow
                operatorDocMode={operatorDocMode}
                operatorDocNameDraft={operatorDocNameDraft}
                operatorNameInputRef={operatorNameInputRef}
                operatorDroppedAsset={operatorDroppedAsset}
                operatorFileSizeLabel={operatorFileSizeLabel}
                operatorDocumentKind={operatorDocumentKind}
                operatorCanNavigateFileBack={operatorCanNavigateFileBack}
                operatorCanNavigateFileForward={operatorCanNavigateFileForward}
                folderPaneOpen={folderPaneOpen}
                onOperatorDocNameDraftChange={onOperatorDocNameDraftChange}
                onCommitOperatorDocName={onCommitOperatorDocName}
                onSetOperatorDocMode={onSetOperatorDocMode}
                onOperatorFileHistoryBack={onOperatorFileHistoryBack}
                onOperatorFileHistoryForward={onOperatorFileHistoryForward}
                onOperatorDocumentKindChange={onOperatorDocumentKindChange}
                onCopyOperatorDocToClipboard={onCopyOperatorDocToClipboard}
                onPasteClipboardToOperator={onPasteClipboardToOperator}
                onSaveOperatorDocAsFile={onSaveOperatorDocAsFile}
                onToggleFolderPane={() => setFolderPaneOpen((open) => !open)}
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
              <CyberdeckPaneTooltipProvider delayDuration={300}>
                <div className="flex items-center gap-2">
                  <OperatorToolbarIconButton
                    label="Paste"
                    onClick={() => void onPasteClipboardToOperator()}
                  >
                    <FaRegPaste className="h-3.5 w-3.5" />
                  </OperatorToolbarIconButton>
                  <div className="flex items-center gap-2 font-mono text-[9px] tracking-[0.08em]">
                    <span className="text-emerald-200">LIVE WEB</span>
                    <span className="rounded border border-[#2d2d2d] px-2 py-0.5 text-[#8a8a8a]">
                      ENGINE: {operatorBrowserEngine}
                    </span>
                  </div>
                </div>
              </CyberdeckPaneTooltipProvider>
            ) : operatorDroppedAsset && !operatorSurfaceIsDocument ? (
              <div className="font-mono text-[9px] tracking-[0.08em] text-[#8a8a8a]">
                {operatorDroppedAsset.kind.toUpperCase()}
              </div>
            ) : null
          }
          leftClassName={
            operatorSurfaceIsDocument && operatorDroppedAsset
              ? "flex min-w-0 w-full flex-1 items-center pr-0"
              : undefined
          }
        />
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
                className="rounded border border-[#2d2d2d] bg-black px-2 py-1 font-mono text-[9px] tracking-[0.08em] text-[#8a8a8a] transition hover:border-emerald-500/60 hover:text-emerald-200 disabled:cursor-not-allowed disabled:opacity-40"
              >
                BACK
              </button>
              <button
                type="button"
                onClick={() => operatorBrowserRef.current?.goForward()}
                disabled={!operatorBrowserRef.current?.canGoForward()}
                className="rounded border border-[#2d2d2d] bg-black px-2 py-1 font-mono text-[9px] tracking-[0.08em] text-[#8a8a8a] transition hover:border-emerald-500/60 hover:text-emerald-200 disabled:cursor-not-allowed disabled:opacity-40"
              >
                FORWARD
              </button>
              <button
                type="button"
                onClick={() => operatorBrowserRef.current?.reload()}
                className="rounded border border-[#2d2d2d] bg-black px-2 py-1 font-mono text-[9px] tracking-[0.08em] text-[#8a8a8a] transition hover:border-emerald-500/60 hover:text-emerald-200"
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
                className="rounded border border-[#2d2d2d] bg-black px-2 py-1 font-mono text-[9px] tracking-[0.08em] text-[#8a8a8a] transition hover:border-emerald-500/60 hover:text-emerald-200"
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
                      className="flex h-5 w-5 items-center justify-center rounded border border-[#2d2d2d] bg-black font-mono text-[9px] tracking-[0.04em] text-[#8a8a8a] transition hover:border-emerald-500/60 hover:text-emerald-200 disabled:cursor-not-allowed disabled:opacity-30"
                      title="Zoom out"
                    >
                      −
                    </button>
                    <span className="w-10 text-center font-mono text-[9px] tracking-[0.04em] text-[#8a8a8a]">
                      {Math.round(imageZoom * 100)}%
                    </span>
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
                      className="flex h-5 w-5 items-center justify-center rounded border border-[#2d2d2d] bg-black font-mono text-[9px] tracking-[0.04em] text-[#8a8a8a] transition hover:border-emerald-500/60 hover:text-emerald-200 disabled:cursor-not-allowed disabled:opacity-30"
                      title="Zoom in"
                    >
                      +
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        imageZoomIndexRef.current = 3;
                        setImageZoom(1);
                      }}
                      className="ml-1 flex h-5 items-center justify-center rounded border border-[#2d2d2d] bg-black px-1.5 font-mono text-[8px] tracking-[0.04em] text-[#8a8a8a] transition hover:border-emerald-500/60 hover:text-emerald-200"
                      title="Reset zoom"
                    >
                      FIT
                    </button>
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
                  onChange={(event) => onOperatorDocumentTextChange(event.target.value)}
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
            {operatorSurfaceIsDocument && folderPaneOpen ? (
              <OperatorDocFolderPane
                onOpenFile={onOpenOperatorFolderFile}
                onRootsChange={onOperatorFolderRootsChange}
              />
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
  );
}
