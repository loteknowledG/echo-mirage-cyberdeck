'use client';

import { useEffect, useState } from "react";
import type { Dispatch, DragEvent, RefObject, SetStateAction } from "react";
import { CopyIcon, DownloadIcon } from "@radix-ui/react-icons";
import { Streamdown } from "streamdown";
import { CyberdeckPaneHeader, CyberdeckPaneHeaderTitle } from "@/components/cyberdeck/pane-header";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

type DroppedOperatorAsset = {
  kind: "text" | "code" | "markdown" | "image" | "video" | "file";
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
  onPasteClipboardToOperator: () => void | Promise<void>;
  onSaveOperatorDocAsFile: () => void | Promise<void>;
  onCopyOperatorDocToClipboard: () => void | Promise<void>;
  onSetOperatorDroppedAsset: Dispatch<SetStateAction<DroppedOperatorAsset | null>>;
};

export function CyberdeckOperatorPaneBody({
  isOperatorDragOver,
  operatorDroppedAsset,
  operatorSurfaceMode,
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
  onPasteClipboardToOperator,
  onSaveOperatorDocAsFile,
  onCopyOperatorDocToClipboard,
  onSetOperatorDroppedAsset,
}: OperatorPaneBodyProps) {
  const [browserDraft, setBrowserDraft] = useState(operatorBrowserUrl);

  useEffect(() => {
    setBrowserDraft(operatorBrowserUrl);
  }, [operatorBrowserUrl]);

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
          onOperatorBrowserNavigate(currentUrl);
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
  }, [onOperatorBrowserNavigate, operatorBrowserRef, operatorSurfaceMode]);

  const navigateBrowser = () => {
    const nextUrl = browserDraft.trim();
    if (!nextUrl) return;
    onOperatorBrowserNavigate(nextUrl);
  };

  return (
    <div
      className={`custom-scrollbar flex flex-1 flex-col overflow-y-auto bg-black p-4 ${
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
        className={`flex flex-1 flex-col rounded-sm border border-[#141414] bg-black transition-colors ${
          isOperatorDragOver ? "border-amber-500/60 ring-2 ring-amber-500/35 ring-inset" : ""
        }`}
      >
        <CyberdeckPaneHeader
          left={
            operatorSurfaceMode === "browser" ? (
              <CyberdeckPaneHeaderTitle style={{ textShadow: "0 0 6px rgba(138,138,138,0.2)" }}>
                MUTHUR_BROWSER
              </CyberdeckPaneHeaderTitle>
            ) : operatorSurfaceIsDocument && operatorDocMode === "edit" ? (
              <input
                ref={operatorNameInputRef}
                value={operatorDocNameDraft}
                onChange={(event) => onOperatorDocNameDraftChange(event.target.value)}
                onBlur={onCommitOperatorDocName}
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
                className="w-full border-0 bg-transparent font-mono text-[10px] tracking-[0.04em] text-[#cfcfcf] outline-none placeholder:text-[#5a5a5a]"
                style={{ textShadow: "0 0 6px rgba(138,138,138,0.2)" }}
              />
            ) : (
              <CyberdeckPaneHeaderTitle style={{ textShadow: "0 0 6px rgba(138,138,138,0.2)" }}>
                {operatorDroppedAsset ? operatorDroppedAsset.name : "OPERATOR_DOC_SURFACE"}
              </CyberdeckPaneHeaderTitle>
            )
          }
          right={
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void onPasteClipboardToOperator()}
                className="rounded border border-[#2d2d2d] bg-black px-2 py-1 font-mono text-[9px] tracking-[0.08em] text-[#8a8a8a] transition hover:border-emerald-500/60 hover:text-emerald-200"
              >
                PASTE
              </button>
              {operatorSurfaceMode === "browser" ? (
                <div className="font-mono text-[9px] tracking-[0.08em] text-emerald-200">
                  LIVE WEB
                </div>
              ) : operatorSurfaceIsDocument ? (
                <>
                  <div className="flex items-center gap-2 font-mono text-[9px] tracking-[0.08em] text-[#8a8a8a]">
                    <span className={operatorDocMode === "view" ? "text-emerald-200" : ""}>VIEW</span>
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
                    <span className={operatorDocMode === "edit" ? "text-emerald-200" : ""}>EDIT</span>
                  </div>
                </>
              ) : operatorDroppedAsset ? (
                <div className="font-mono text-[9px] tracking-[0.08em] text-[#8a8a8a]">
                  {operatorDroppedAsset.kind.toUpperCase()}
                </div>
              ) : null}
            </div>
          }
        />
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
          <div className="flex-1 overflow-auto p-3">
            <div className="mb-4 font-mono text-[9px] tracking-[0.04em] text-[#8a8a8a]">
              {operatorDroppedAsset.mimeType || "application/octet-stream"} //{" "}
              {Math.max(1, Math.round(operatorDroppedAsset.size / 1024))} KB
            </div>
            {operatorSurfaceIsDocument ? (
              <div className="mb-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => void onSaveOperatorDocAsFile()}
                  aria-label="Save operator document"
                  title="Save operator document"
                  className="inline-flex h-7 w-7 items-center justify-center rounded border border-[#2d2d2d] bg-black text-[#8a8a8a] transition hover:border-emerald-500/60 hover:text-emerald-200"
                >
                  <DownloadIcon className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => void onCopyOperatorDocToClipboard()}
                  aria-label="Copy operator document"
                  title="Copy operator document"
                  className="inline-flex h-7 w-7 items-center justify-center rounded border border-[#2d2d2d] bg-black text-[#8a8a8a] transition hover:border-emerald-500/60 hover:text-emerald-200"
                >
                  <CopyIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : null}
            {operatorDroppedAsset.kind === "image" ? (
              <div className="rounded-sm border border-[#1c1c1c] bg-black/80 p-3">
                <div className="mb-2 font-mono text-[9px] tracking-[0.04em] text-[#8a8a8a]">
                  IMAGE PREVIEW
                </div>
                {operatorDroppedAsset.imageSrc ? (
                  <img
                    src={operatorDroppedAsset.imageSrc}
                    alt={operatorDroppedAsset.name}
                    className="max-h-[72vh] w-full rounded-sm border border-[#1c1c1c] object-contain"
                    draggable={false}
                  />
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
                  value={operatorDroppedAsset.text || ""}
                  onChange={(event) => {
                    const nextText = event.target.value;
                    onSetOperatorDroppedAsset((prev) =>
                      prev ? { ...prev, text: nextText } : prev,
                    );
                  }}
                  spellCheck={false}
                  autoCapitalize="off"
                  autoComplete="off"
                  autoCorrect="off"
                  wrap="off"
                  className="min-h-0 resize-none overflow-hidden rounded-sm border border-[#1c1c1c] bg-black px-3 py-3 font-mono text-[12px] leading-snug text-green-200 shadow-none focus-visible:ring-1 focus-visible:ring-amber-500/40"
                  style={
                    operatorDocMode === "edit"
                      ? {
                          height: operatorEditorRef.current?.style.height || "auto",
                        }
                      : undefined
                  }
                />
              ) : operatorDroppedAsset.kind === "markdown" ? (
                <div className="rounded-sm border border-green-900/70 bg-black/70 p-3">
                  <Streamdown className="prose prose-invert prose-pre:bg-black prose-pre:text-green-300 max-w-none text-[12px] leading-snug text-green-200">
                    {operatorDroppedAsset.text || ""}
                  </Streamdown>
                </div>
              ) : (
                <pre className="min-h-[50vh] whitespace-pre-wrap break-words rounded-sm border border-[#1c1c1c] bg-black p-3 font-mono text-[12px] leading-snug text-green-200">
                  {operatorDroppedAsset.text || ""}
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
        ) : (
          <div className="flex flex-1 items-center justify-center p-6 text-center font-mono text-[10px] tracking-[0.08em] text-[#8a8a8a]">
            DROP OR PASTE CODE, TEXT, MARKDOWN, OR IMAGE FILES HERE TO VIEW AND EDIT THEM.
          </div>
        )}
      </div>
    </div>
  );
}
