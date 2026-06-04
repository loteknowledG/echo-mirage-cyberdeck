"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type DragEvent } from "react";
import { toast } from "sonner";
import { CyberdeckOperatorPaneBody } from "@/components/cyberdeck/operator-pane-body";
import type { OperatorExportFormat } from "@/components/cyberdeck/operator-export-picker";
import type { OperatorDocFolderRoot } from "@/lib/operator-folder-nav";
import {
  pushOperatorFileHistory,
  operatorFileHistoryBackIndex,
  operatorFileHistoryForwardIndex,
} from "@/lib/operator-file-history";
import { revokeOperatorBlobUrl } from "@/lib/operator-binary-preview";
import { buildOperatorIngestFromFile } from "@/lib/operator-file-ingest";
import type { OperatorIngestHints } from "@/lib/operator-file-surface";
import {
  analyzeTextForBinaryDisplay,
  isOperatorTextEditableSurface,
  resolveOperatorAssetSurface,
  type OperatorAssetSurface,
} from "@/lib/operator-file-surface";
import {
  applyOperatorTextAutodetect,
  createBlankOperatorDocument,
  normalizeOperatorDocumentKind,
  operatorMimeTypeForKind,
  resolveOperatorDocumentNameForKind,
  type OperatorDocumentPickerKind,
} from "@/lib/operator-document-types";
import {
  normalizeMarkdownMechanical,
  operatorMarkdownWasHousekept,
} from "@/lib/operator-markdown-housekeeping";
import { exportMarkdownToDocx, exportMarkdownToPdf } from "@/lib/markdown-to-docx-export";
import {
  docxFilenameFromMarkdownName,
  pdfFilenameFromMarkdownName,
} from "@/lib/markdown-to-docx-intent";
import { cleanOperatorPasteText } from "@/lib/operator-paste-cleaner";
import {
  buildOperatorSaveIntent,
  canSaveOperatorFileInPlace,
  downloadOperatorDoc,
  isPickerAbortError,
  saveOperatorFileInPlace,
  saveViaCadreApi,
} from "@/lib/operator-save";
import { readFileFromFolderRoot } from "@/lib/operator-folder-nav";
import { copyTextToClipboard } from "@/lib/grok-image-prompt";
import { useCyberdeckTabStore } from "@/lib/cyberdeck-tab-store";

type TabAsset = {
  kind: string;
  name: string;
  mimeType: string;
  size: number;
  text?: string;
  imageSrc?: string;
  pdfSrc?: string;
  surface?: OperatorAssetSurface;
};

type EchoMirageClipboardApi = { readText?: () => Promise<string> };

async function readClipboardText() {
  const bridge = (window as Window & { echoMirageClipboard?: EchoMirageClipboardApi })
    .echoMirageClipboard;
  if (bridge?.readText) {
    try {
      return await bridge.readText();
    } catch {
      /* fall through */
    }
  }
  if (typeof navigator !== "undefined" && navigator.clipboard?.readText) {
    return navigator.clipboard.readText();
  }
  return "";
}

/** Per-tab operator document workspace (drop → markdown, folders, export). */
export function CyberdeckTabDocumentPane({ tabId }: { tabId: string }) {
  const asset = useCyberdeckTabStore((s) => {
    const tab = s.customTabs.find((t) => t.id === tabId);
    return (tab?.asset as TabAsset | null | undefined) ?? null;
  });

  const [isDragOver, setIsDragOver] = useState(false);
  const [docMode, setDocMode] = useState<"view" | "edit">("view");
  const [nameDraft, setNameDraft] = useState(() => asset?.name ?? createBlankOperatorDocument().name);
  const [fileHistory, setFileHistory] = useState<string[]>([]);
  const [fileHistoryIndex, setFileHistoryIndex] = useState(-1);
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);

  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const browserRef = useRef<HTMLWebViewElement | null>(null);
  const kindManualRef = useRef(false);
  const folderRootsRef = useRef<OperatorDocFolderRoot[]>([]);
  const [folderRootsCount, setFolderRootsCount] = useState(0);
  const fileHistoryRef = useRef<string[]>([]);
  const fileHistoryIndexRef = useRef(-1);
  const historyLoadersRef = useRef<Map<string, () => Promise<void>>>(new Map());
  const previewBlobUrlRef = useRef<string | null>(null);

  const updateTabAsset = useCallback(
    (updater: (prev: TabAsset | null) => TabAsset | null) => {
      useCyberdeckTabStore.getState().setCustomTabs((prev) =>
        prev.map((tab) =>
          tab.id === tabId ? { ...tab, asset: updater((tab.asset as TabAsset | null) ?? null) } : tab,
        ),
      );
    },
    [tabId],
  );

  const setTextAsset = useCallback(
    (next: TabAsset) => {
      if (next.surface && next.surface !== "markdown" && next.surface !== "text") {
        updateTabAsset(() => next);
        setNameDraft(next.name || "");
        return false;
      }
      if (next.text && !analyzeTextForBinaryDisplay(next.text, { fileName: next.name }).safe) {
        const { text: _text, ...rest } = next;
        updateTabAsset(() => ({ ...rest, surface: "binary-unsafe", kind: "file" }));
        setNameDraft(next.name || "");
        return false;
      }
      let prepared = next;
      if (next.text) {
        const cleanedText = cleanOperatorPasteText(next.text);
        if (cleanedText !== next.text) {
          prepared = { ...next, text: cleanedText, size: new Blob([cleanedText]).size };
        }
      }
      let normalized = kindManualRef.current ? prepared : applyOperatorTextAutodetect(prepared);
      if (normalized.text && normalizeOperatorDocumentKind(normalized.kind) === "markdown") {
        const housekept = normalizeMarkdownMechanical(normalized.text);
        if (housekept !== normalized.text) {
          normalized = {
            ...normalized,
            text: housekept,
            size: new Blob([housekept]).size,
          };
        }
      }
      updateTabAsset(() => normalized);
      setNameDraft(normalized.name || "");
      return operatorMarkdownWasHousekept(next.text || "", normalized.text || "");
    },
    [updateTabAsset],
  );

  const loadAssetFromFile = useCallback(
    async (file: File, hints?: OperatorIngestHints) => {
      kindManualRef.current = false;
      revokeOperatorBlobUrl(previewBlobUrlRef.current);
      previewBlobUrlRef.current = null;
      const ingested = await buildOperatorIngestFromFile(file, hints);
      let next: TabAsset = {
        kind: ingested.kind,
        name: ingested.name,
        mimeType: ingested.mimeType,
        size: ingested.size,
        surface: ingested.surface,
        ...(ingested.text !== undefined ? { text: ingested.text } : {}),
        ...(ingested.imageSrc ? { imageSrc: ingested.imageSrc } : {}),
        ...(ingested.pdfSrc ? { pdfSrc: ingested.pdfSrc } : {}),
      };

      if (ingested.surface === "markdown" || ingested.surface === "text") {
        setTextAsset(next);
      } else {
        const { text: _text, ...withoutText } = next;
        next = withoutText;
        if (next.pdfSrc?.startsWith("blob:")) previewBlobUrlRef.current = next.pdfSrc;
        if (next.imageSrc?.startsWith("blob:")) previewBlobUrlRef.current = next.imageSrc;
        updateTabAsset(() => next);
        setNameDraft(next.name);
      }
      setDocMode("view");
    },
    [setTextAsset, updateTabAsset],
  );

  const openFilePath = useCallback(
    async (filePath: string, load: () => Promise<void>, fromHistory = false) => {
      historyLoadersRef.current.set(filePath, () => openFilePath(filePath, load, true));

      if (!fromHistory && filePath !== activeFilePath) {
        const pushed = pushOperatorFileHistory(
          fileHistoryRef.current,
          fileHistoryIndexRef.current,
          filePath,
          activeFilePath,
        );
        if (pushed) {
          fileHistoryRef.current = pushed.history;
          fileHistoryIndexRef.current = pushed.historyIndex;
          setFileHistory(pushed.history);
          setFileHistoryIndex(pushed.historyIndex);
        }
      }

      setActiveFilePath(filePath);
      await load();
    },
    [activeFilePath],
  );

  useEffect(() => {
    if (!asset) return;
    if (document.activeElement === nameInputRef.current) return;
    setNameDraft(asset.name);
  }, [asset?.kind, asset?.name]);

  useLayoutEffect(() => {
    const isDoc = asset ? isOperatorTextEditableSurface(resolveOperatorAssetSurface(asset)) : false;
    if (!isDoc || docMode !== "edit") return;
    const el = editorRef.current;
    if (!el) return;
    el.style.height = "auto";
    const minHeight = Math.max(el.scrollHeight, el.clientHeight);
    el.style.height = `${minHeight}px`;
  }, [asset?.text, docMode, asset]);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    async (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (!file) return;
      const dropPath = `drop://${file.name}#${file.lastModified}`;
      await openFilePath(dropPath, () => loadAssetFromFile(file));
    },
    [loadAssetFromFile, openFilePath],
  );

  const handleFolderFile = useCallback(
    async (filePath: string, file: File) => {
      await openFilePath(filePath, async () => {
        const rootName = filePath.split("/")[0];
        const root = folderRootsRef.current.find((entry) => entry.name === rootName);
        if (root) {
          const fresh = await readFileFromFolderRoot(root, filePath);
          if (fresh) {
            await loadAssetFromFile(fresh.file, {
              diskAbsolutePath: fresh.diskAbsolutePath,
              pdfBase64: fresh.pdfBase64,
            });
          } else {
            await loadAssetFromFile(file);
          }
          return;
        }
        await loadAssetFromFile(file);
      });
    },
    [loadAssetFromFile, openFilePath],
  );

  const navigateFileHistory = useCallback((direction: "back" | "forward") => {
    const history = fileHistoryRef.current;
    const idx = fileHistoryIndexRef.current;
    const nextIdx =
      direction === "back"
        ? operatorFileHistoryBackIndex(idx)
        : operatorFileHistoryForwardIndex(history, idx);
    if (nextIdx === null) return;
    const path = history[nextIdx];
    if (!path) return;
    fileHistoryIndexRef.current = nextIdx;
    setFileHistoryIndex(nextIdx);
    setActiveFilePath(path);
    const loader = historyLoadersRef.current.get(path);
    if (loader) void loader();
  }, []);

  const handleTextChange = useCallback(
    (text: string) => {
      updateTabAsset((prev) => {
        if (!prev) return prev;
        const name =
          prev.kind === "markdown"
            ? resolveOperatorDocumentNameForKind("markdown", text, prev.name)
            : prev.name;
        return { ...prev, text, name, size: new Blob([text]).size };
      });
    },
    [updateTabAsset],
  );

  const handleKindChange = useCallback(
    (kind: OperatorDocumentPickerKind) => {
      kindManualRef.current = true;
      updateTabAsset((prev) => {
        if (!prev) return prev;
        const name = resolveOperatorDocumentNameForKind(kind, prev.text || "", prev.name);
        return {
          ...prev,
          kind,
          mimeType: operatorMimeTypeForKind(kind),
          name,
        };
      });
    },
    [updateTabAsset],
  );

  const commitName = useCallback(() => {
    if (!asset) return;
    const nextName = nameDraft.trim();
    if (!nextName) {
      setNameDraft(asset.name);
      return;
    }
    if (nextName === asset.name) return;
    updateTabAsset((prev) => (prev ? { ...prev, name: nextName } : prev));
    setNameDraft(nextName);
  }, [asset, nameDraft, updateTabAsset]);

  const copyToClipboard = useCallback(async () => {
    const text = asset?.text || "";
    if (!text.trim()) {
      toast.error("Document has no text.");
      return;
    }
    try {
      await copyTextToClipboard(text);
      toast.success(`Copied "${asset?.name || "document"}".`);
    } catch {
      toast.error("Could not copy.");
    }
  }, [asset]);

  const pasteFromClipboard = useCallback(async () => {
    kindManualRef.current = false;
    try {
      const text = await readClipboardText();
      if (!text.trim()) {
        toast.error("Clipboard has no text.");
        return;
      }
      const stripped = setTextAsset({
        kind: "text",
        name: asset?.name || "draft.txt",
        mimeType: "text/plain",
        size: new Blob([text]).size,
        text,
      });
      setDocMode("edit");
      toast.success(
        stripped ? "Pasted — stripped chat code-fence wrapper." : "Pasted clipboard into document.",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not paste.");
    }
  }, [asset?.name, setTextAsset]);

  const clearDocument = useCallback(() => {
    kindManualRef.current = false;
    setActiveFilePath(null);
    fileHistoryRef.current = [];
    fileHistoryIndexRef.current = -1;
    historyLoadersRef.current.clear();
    setFileHistory([]);
    setFileHistoryIndex(-1);
    setTextAsset({
      kind: "text",
      name: "",
      mimeType: "text/plain",
      size: 0,
      text: "",
    });
    setNameDraft("");
    setDocMode("view");
  }, [setTextAsset]);

  const saveDocInPlace = useCallback(async () => {
    const text = asset?.text || "";
    if (!text.trim()) {
      toast.error("Document has no text.");
      return;
    }
    if (!activeFilePath) {
      toast.error("No open file to save.");
      return;
    }
    const result = await saveOperatorFileInPlace(activeFilePath, text, folderRootsRef.current);
    if (!result.ok) {
      toast.error(result.error || "Could not save file.");
      return;
    }
    toast.success(`Saved "${activeFilePath.split("/").pop()}".`);
  }, [activeFilePath, asset?.text]);

  const saveDocAs = useCallback(async () => {
    const text = asset?.text || "";
    if (!text.trim()) {
      toast.error("Document has no text.");
      return;
    }
    const intent = buildOperatorSaveIntent({
      text,
      kind: asset?.kind,
      mimeType: asset?.mimeType || "text/plain",
      currentName: asset?.name,
      headerName: nameDraft,
      sourceFilePath: activeFilePath,
    });
    try {
      const electronSave = window.echoMirageSave;
      if (electronSave) {
        const result = await electronSave.showDialog({
          defaultRelativePath: intent.suggestedSavePath,
          content: intent.text,
        });
        if (!result.canceled && result.filePath) {
          toast.success(`Saved "${result.filePath}".`);
          return;
        }
        if (result.canceled && !result.error) return;
        if (result.error) toast.error(result.error);
      }
      if (await saveViaCadreApi(intent, false)) {
        toast.success(`Saved to ${intent.suggestedSavePath}`);
        return;
      }
      downloadOperatorDoc(intent);
      toast.success(`Downloaded "${intent.suggestedFilename}".`);
    } catch (err) {
      if (!isPickerAbortError(err)) {
        toast.error(err instanceof Error ? err.message : "Save failed.");
      }
    }
  }, [activeFilePath, asset, nameDraft]);

  const exportMarkdown = useCallback(
    async (format: OperatorExportFormat) => {
      const text = asset?.text || "";
      if (!text.trim()) {
        toast.error("Document has no text.");
        return;
      }
      if (normalizeOperatorDocumentKind(asset?.kind) !== "markdown") {
        toast.error(`Export ${format.toUpperCase()} requires markdown.`);
        return;
      }
      const baseName = nameDraft || asset?.name || "document.md";
      try {
        if (format === "docx") {
          const result = await exportMarkdownToDocx({
            markdown: text,
            suggestedFilename: docxFilenameFromMarkdownName(baseName),
          });
          toast.success(result.outputPath ? `Exported DOCX to ${result.outputPath}` : "Exported DOCX.");
        } else {
          const result = await exportMarkdownToPdf({
            markdown: text,
            suggestedFilename: pdfFilenameFromMarkdownName(baseName),
          });
          toast.success(result.outputPath ? `Exported PDF to ${result.outputPath}` : "Exported PDF.");
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Export failed.");
      }
    },
    [asset, nameDraft],
  );

  const convertToMarkdown = useCallback(
    async (filePath: string) => {
      try {
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
        const outputName =
          payload.outputPath?.split(/[/\\]/).pop() ||
          filePath.replace(/\.(pdf|docx)$/i, ".md").split(/[/\\]/).pop() ||
          "converted.md";
        await openFilePath(`convert://${filePath}`, async () => {
          kindManualRef.current = false;
          setTextAsset({
            kind: "markdown",
            name: outputName,
            mimeType: "text/markdown",
            size: new Blob([payload.markdown!]).size,
            text: payload.markdown!,
          });
          setDocMode("view");
        });
        toast.success(`Converted ${filePath} → markdown.`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Conversion failed.");
      }
    },
    [openFilePath, setTextAsset],
  );

  const surfaceIsDocument = asset
    ? isOperatorTextEditableSurface(resolveOperatorAssetSurface(asset))
    : false;

  return (
    <CyberdeckOperatorPaneBody
      isOperatorDragOver={isDragOver}
      operatorDroppedAsset={asset}
      operatorSurfaceMode="workspace"
      operatorBrowserEngine="N/A"
      operatorSurfaceIsDocument={surfaceIsDocument}
      operatorBrowserUrl=""
      operatorDocMode={docMode}
      operatorDocNameDraft={nameDraft}
      operatorActiveFilePath={activeFilePath}
      operatorEditorRef={editorRef}
      operatorNameInputRef={nameInputRef}
      operatorBrowserRef={browserRef}
      onOperatorDragOver={handleDragOver}
      onOperatorDragLeave={handleDragLeave}
      onOperatorDrop={handleDrop}
      onOperatorDocNameDraftChange={setNameDraft}
      onCommitOperatorDocName={commitName}
      onSetOperatorDocMode={setDocMode}
      onOperatorBrowserNavigate={() => {}}
      onOperatorBrowserUrlChange={() => {}}
      onPasteClipboardToOperator={pasteFromClipboard}
      onSaveOperatorDocInPlace={saveDocInPlace}
      onSaveOperatorDocAsFile={saveDocAs}
      operatorCanSaveInPlace={
        folderRootsCount >= 0 &&
        canSaveOperatorFileInPlace(activeFilePath, folderRootsRef.current)
      }
      onCopyOperatorDocToClipboard={copyToClipboard}
      onOperatorDocumentTextChange={handleTextChange}
      onClearOperatorDocument={clearDocument}
      operatorDocumentKind={normalizeOperatorDocumentKind(asset?.kind)}
      onOperatorDocumentKindChange={handleKindChange}
      onOpenOperatorFolderFile={handleFolderFile}
      onOperatorFolderRootsChange={(roots) => {
        folderRootsRef.current = roots;
        setFolderRootsCount(roots.length);
      }}
      operatorCanNavigateFileBack={operatorFileHistoryBackIndex(fileHistoryIndex) !== null}
      operatorCanNavigateFileForward={
        operatorFileHistoryForwardIndex(fileHistory, fileHistoryIndex) !== null
      }
      onOperatorFileHistoryBack={() => navigateFileHistory("back")}
      onOperatorFileHistoryForward={() => navigateFileHistory("forward")}
      onConvertDocumentToMarkdown={convertToMarkdown}
      onExportOperatorMarkdown={exportMarkdown}
    />
  );
}
