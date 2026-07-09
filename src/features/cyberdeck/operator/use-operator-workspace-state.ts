"use client";

import type { Dispatch, SetStateAction } from "react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { OPERATOR_BROWSER_HOME_URL } from "@/lib/browser-intents";
import { useBrowserController } from "@/lib/use-browser-controller";
import { copyTextToClipboard } from "@/lib/grok-image-prompt";
import {
  applyOperatorTextAutodetect,
  createBlankOperatorDocument,
  normalizeOperatorDocumentKind,
  operatorMimeTypeForKind,
  resolveOperatorDocumentNameForKind,
  type OperatorDocumentPickerKind,
} from "@/lib/operator-document-types";
import { revokeOperatorBlobUrl } from "@/lib/operator-binary-preview";
import {
  analyzeTextForBinaryDisplay,
  buildOperatorIngestFromFile,
  isOperatorTextEditableSurface,
  resolveOperatorAssetSurface,
  type OperatorIngestHints,
} from "@/lib/operator-file-surface";
import { cleanOperatorPasteText, operatorPasteWasCleaned } from "@/lib/operator-paste-cleaner";
import {
  normalizeMarkdownMechanical,
  operatorMarkdownWasHousekept,
} from "@/lib/operator-markdown-housekeeping";
import {
  operatorFileHistoryBackIndex,
  operatorFileHistoryForwardIndex,
  pushOperatorFileHistory,
} from "@/lib/operator-file-history";
import {
  isPersistableOperatorWorkspace,
  loadOperatorWorkspace,
  operatorFilePathNeedsFolderReload,
  restoredAssetFromPersistence,
} from "@/lib/operator-workspace-persistence";
import { readFileFromFolderRoot, type OperatorDocFolderRoot } from "@/lib/operator-folder-nav";
import {
  buildOperatorSaveIntent,
  canSaveOperatorDocumentInPlace,
  downloadOperatorDoc,
  isPickerAbortError,
  saveOperatorDocumentInPlace,
  saveViaCadreApi,
  type OperatorSaveIntent,
} from "@/lib/operator-save";
import { OPERATOR_FILE_SAVED_EVENT } from "@/lib/workspace-create-folder";
import { pasteIntoOperatorTextDocument, readOperatorPaneSaveText } from "@/lib/operator-workbench";
import {
  docxFilenameFromMarkdownName,
  pdfFilenameFromMarkdownName,
  type OperatorExportFormat,
} from "@/lib/markdown-to-docx-intent";
import type { MuthurOperatorOpenFileRef } from "@/lib/muthur-core/types";
import type { ChatMessage } from "@/features/cyberdeck/muthur/muthur-chat-types";
import type { DroppedOperatorAsset } from "@/features/cyberdeck/muthur/coding-verify-format";
import { useCyberdeckTabStore, type CyberdeckServerId } from "@/lib/cyberdeck-tab-store";
import { toast } from "sonner";
import { useOperatorDragDrop } from "./use-operator-drag-drop";

type SaveFilePickerHandle = {
  createWritable(): Promise<{
    write(data: Blob | string): Promise<void>;
    close(): Promise<void>;
  }>;
};

type SaveFilePickerOptions = {
  suggestedName?: string;
  types?: Array<{
    description?: string;
    accept: Record<string, string[]>;
  }>;
  excludeAcceptAllOption?: boolean;
};

type EchoMirageClipboardApi = {
  readText(): string;
  writeText(text: string): void;
};

type EchoMirageSaveApi = {
  showDialog(options: {
    defaultRelativePath: string;
    content: string;
  }): Promise<{ canceled: boolean; filePath?: string; error?: string }>;
};

async function readEchoMirageClipboardText() {
  const bridge = (window as Window & { echoMirageClipboard?: EchoMirageClipboardApi })
    .echoMirageClipboard;
  if (bridge?.readText) {
    try {
      return bridge.readText();
    } catch {
      /* fall through */
    }
  }
  return navigator.clipboard.readText();
}

export type OperatorUiRestoreSlice = {
  operatorSurfaceMode?: "workspace" | "browser";
  operatorBrowserUrl?: string;
};

export type UseOperatorWorkspaceStateOptions = {
  deckUiHydrated: boolean;
  setNavRailContext: (context: "gateway" | "tabs") => void;
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  getActiveServerId: () => CyberdeckServerId;
};

export function useOperatorWorkspaceState({
  deckUiHydrated,
  setNavRailContext,
  setMessages,
  getActiveServerId,
}: UseOperatorWorkspaceStateOptions) {
  const [operatorDroppedAsset, setOperatorDroppedAsset] = useState<DroppedOperatorAsset | null>(() =>
    createBlankOperatorDocument(),
  );
  const [operatorSurfaceMode, setOperatorSurfaceMode] = useState<"workspace" | "browser">("workspace");
  const [operatorBrowserEngine, setOperatorBrowserEngine] = useState("UNKNOWN");
  const [operatorDocMode, setOperatorDocMode] = useState<"view" | "edit">("edit");
  const [operatorDocNameDraft, setOperatorDocNameDraft] = useState(
    () => createBlankOperatorDocument().name,
  );
  const [operatorFileHistory, setOperatorFileHistory] = useState<string[]>([]);
  const [operatorFileHistoryIndex, setOperatorFileHistoryIndex] = useState(-1);
  const [operatorActiveFilePath, setOperatorActiveFilePath] = useState<string | null>(null);
  const operatorFileHistoryRef = useRef<string[]>([]);
  const operatorFileHistoryIndexRef = useRef(-1);
  const operatorFolderRootsRef = useRef<OperatorDocFolderRoot[]>([]);
  const [operatorFolderRootsCount, setOperatorFolderRootsCount] = useState(0);
  const operatorFileHistoryLoadersRef = useRef<Map<string, () => Promise<void>>>(new Map());
  const operatorPreviewBlobUrlRef = useRef<string | null>(null);
  const operatorWorkspaceHydratedRef = useRef(false);
  const operatorWorkspaceRestoreRef = useRef<{ activeFilePath: string; docMode: "view" | "edit" } | null>(
    null,
  );
  const [operatorBrowserUrl, setOperatorBrowserUrl] = useState(OPERATOR_BROWSER_HOME_URL);
  const [operatorBrowserSnapshot, setOperatorBrowserSnapshot] = useState("");
  const operatorEditorRef = useRef<HTMLTextAreaElement | null>(null);
  const operatorKindManualRef = useRef(false);
  const operatorBrowserRef = useRef<HTMLWebViewElement | null>(null);
  const operatorNameInputRef = useRef<HTMLInputElement | null>(null);

  const restoreOperatorUiFromDeck = useCallback((parsed: OperatorUiRestoreSlice) => {
    if (parsed.operatorSurfaceMode === "workspace" || parsed.operatorSurfaceMode === "browser") {
      setOperatorSurfaceMode(parsed.operatorSurfaceMode);
    }
    if (typeof parsed.operatorBrowserUrl === "string" && parsed.operatorBrowserUrl.trim()) {
      setOperatorBrowserUrl(parsed.operatorBrowserUrl);
    }
  }, []);

  useEffect(() => {
    if (!deckUiHydrated || operatorWorkspaceHydratedRef.current) return;
    operatorWorkspaceHydratedRef.current = true;

    const persisted = loadOperatorWorkspace();
    if (!persisted || !isPersistableOperatorWorkspace(persisted.asset, persisted.activeFilePath)) {
      return;
    }

    setOperatorDocMode("edit");
    operatorFileHistoryRef.current = persisted.fileHistory;
    operatorFileHistoryIndexRef.current = persisted.fileHistoryIndex;
    setOperatorFileHistory(persisted.fileHistory);
    setOperatorFileHistoryIndex(persisted.fileHistoryIndex);
    setOperatorDocNameDraft(persisted.asset.name);

    const logicalPath = persisted.activeFilePath;
    const restoredAsset = restoredAssetFromPersistence(persisted.asset) as DroppedOperatorAsset;
    setOperatorDroppedAsset(restoredAsset);

    if (logicalPath && operatorFilePathNeedsFolderReload(logicalPath)) {
      operatorWorkspaceRestoreRef.current = {
        activeFilePath: logicalPath,
        docMode: persisted.docMode,
      };
      setOperatorActiveFilePath(logicalPath);
      return;
    }

    setOperatorActiveFilePath(logicalPath);
  }, [deckUiHydrated]);

  const operatorSurfaceIsDocument = operatorDroppedAsset
    ? isOperatorTextEditableSurface(resolveOperatorAssetSurface(operatorDroppedAsset))
    : false;

  const { captureOperatorBrowserSnapshot, openOperatorBrowser, performBrowserCommand } = useBrowserController({
    operatorBrowserRef,
    operatorBrowserUrl,
    setOperatorBrowserUrl,
    setOperatorSurfaceMode,
    setServer: (next) => useCyberdeckTabStore.getState().setServer(next),
    setOperatorBrowserSnapshot,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    setOperatorBrowserEngine(window.echoMirageBrowser ? "PLAYWRIGHT" : "WEBVIEW_DOM_FALLBACK");
  }, []);

  const setOperatorTextAsset = useCallback((asset: DroppedOperatorAsset) => {
    if (asset.surface && asset.surface !== "markdown" && asset.surface !== "text") {
      setOperatorDroppedAsset(asset);
      setOperatorDocNameDraft(asset.name || "");
      return false;
    }
    if (asset.text && !analyzeTextForBinaryDisplay(asset.text, { fileName: asset.name }).safe) {
      const { text: _text, ...rest } = asset;
      setOperatorDroppedAsset({ ...rest, surface: "binary-unsafe", kind: "file" });
      setOperatorDocNameDraft(asset.name || "");
      return false;
    }
    let prepared = asset;
    if (asset.text) {
      const cleanedText = cleanOperatorPasteText(asset.text);
      if (cleanedText !== asset.text) {
        prepared = {
          ...asset,
          text: cleanedText,
          size: new Blob([cleanedText]).size,
        };
      }
    }
    let next = operatorKindManualRef.current ? prepared : applyOperatorTextAutodetect(prepared);
    if (next.text && normalizeOperatorDocumentKind(next.kind) === "markdown") {
      const housekept = normalizeMarkdownMechanical(next.text);
      if (housekept !== next.text) {
        next = {
          ...next,
          text: housekept,
          size: new Blob([housekept]).size,
        };
      }
    }
    setOperatorDroppedAsset(next);
    setOperatorDocNameDraft(next.name || "");
    return operatorMarkdownWasHousekept(asset.text || "", next.text || "");
  }, []);

  const openOperatorFile = useCallback(
    async (filePath: string, load: () => Promise<void>, fromHistory = false) => {
      operatorFileHistoryLoadersRef.current.set(filePath, () => openOperatorFile(filePath, load, true));

      if (!fromHistory && filePath !== operatorActiveFilePath) {
        const pushed = pushOperatorFileHistory(
          operatorFileHistoryRef.current,
          operatorFileHistoryIndexRef.current,
          filePath,
          operatorActiveFilePath,
        );
        if (pushed) {
          operatorFileHistoryRef.current = pushed.history;
          operatorFileHistoryIndexRef.current = pushed.historyIndex;
          setOperatorFileHistory(pushed.history);
          setOperatorFileHistoryIndex(pushed.historyIndex);
        }
      }

      setOperatorActiveFilePath(filePath);
      await load();
    },
    [operatorActiveFilePath],
  );

  const navigateOperatorFileHistory = useCallback(
    (direction: "back" | "forward") => {
      const history = operatorFileHistoryRef.current;
      const idx = operatorFileHistoryIndexRef.current;
      const nextIdx =
        direction === "back"
          ? operatorFileHistoryBackIndex(idx)
          : operatorFileHistoryForwardIndex(history, idx);
      if (nextIdx === null) return;

      const path = history[nextIdx];
      if (!path) return;

      operatorFileHistoryIndexRef.current = nextIdx;
      setOperatorFileHistoryIndex(nextIdx);
      setOperatorActiveFilePath(path);

      const loader = operatorFileHistoryLoadersRef.current.get(path);
      if (loader) void loader();
    },
    [],
  );

  const openConvertedMarkdownInOperator = useCallback(
    async (filePath: string, options?: { edit?: boolean }): Promise<boolean> => {
      const convertHints = {
        activeFilePath: operatorActiveFilePath,
        localFilePath: operatorDroppedAsset?.localFilePath ?? null,
        folderRoots: operatorFolderRootsRef.current.map((root) => ({
          name: root.name,
          diskPath: root.diskPath,
        })),
      };
      const toastId =
        options?.edit === true
          ? toast.loading("Converting DOCX for editing…")
          : undefined;
      setMessages((prev) => [
        ...prev,
        { role: "system", text: `MUTHUR_CONVERT // ${filePath}` },
      ]);
      try {
        const res = await fetch("/api/convert-document-to-markdown", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filePath, ...convertHints }),
        });
        const payload = (await res.json()) as {
          ok?: boolean;
          markdown?: string;
          outputPath?: string;
          sourcePath?: string;
          error?: string;
        };

        if (!res.ok || !payload.ok) {
          throw new Error(payload.error || `Conversion failed (${res.status})`);
        }

        if (!payload.markdown) {
          throw new Error("Conversion completed but returned no markdown.");
        }

        const markdown = payload.markdown;

        const outputName =
          payload.outputPath?.split(/[/\\]/).pop() ||
          filePath.replace(/\.(pdf|docx)$/i, ".md").split(/[/\\]/).pop() ||
          "converted.md";
        const convertHistoryPath = `convert://${filePath}`;
        const openInEditMode = options?.edit === true;
        await openOperatorFile(convertHistoryPath, async () => {
          operatorKindManualRef.current = false;
          setOperatorTextAsset({
            kind: "markdown",
            name: outputName,
            mimeType: "text/markdown",
            size: new Blob([markdown]).size,
            text: markdown,
          });
          useCyberdeckTabStore.getState().setServer("m");
          setNavRailContext("gateway");
          setOperatorSurfaceMode("workspace");
          setOperatorDocMode("edit");
        });
        const successMessage = openInEditMode
          ? `Editing ${outputName} (converted from DOCX). Export to DOCX when done.`
          : `Converted ${filePath} → markdown in operator.`;
        if (toastId !== undefined) {
          toast.success(successMessage, { id: toastId });
        } else {
          toast.success(successMessage);
        }
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            text: openInEditMode
              ? `Opened **${outputName}** for editing (converted from \`${filePath}\`).\n\nUse export to DOCX when you are done.`
              : `Converted **${filePath}** to markdown.\n\nOutput: \`${payload.outputPath || outputName}\`\n\nOpened in OperatorMarkdownViewer as \`text/markdown\`.`,
          },
        ]);
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Document conversion failed.";
        if (toastId !== undefined) {
          toast.error(message, { id: toastId });
        } else {
          toast.error(message);
        }
        setMessages((prev) => [
          ...prev,
          { role: "system", text: `MUTHUR_CONVERT // FAILED // ${message}` },
        ]);
        return false;
      }
    },
    [
      openOperatorFile,
      operatorActiveFilePath,
      operatorDroppedAsset?.localFilePath,
      setOperatorTextAsset,
    ],
  );

  const openWorkspaceFileInOperator = useCallback(
    async (ref: MuthurOperatorOpenFileRef): Promise<boolean> => {
      try {
        const res = await fetch(`/api/read-file?path=${encodeURIComponent(ref.filePath)}`);
        const payload = (await res.json()) as { content?: string; error?: string };
        if (!res.ok || typeof payload.content !== "string") {
          throw new Error(payload.error || `Failed to read file (${res.status})`);
        }
        const fileContent = payload.content;

        const fileName = ref.fileName || ref.filePath.split(/[/\\]/).pop() || "file.txt";
        const isMarkdown = /\.(md|markdown)$/i.test(fileName);

        await openOperatorFile(ref.filePath, async () => {
          operatorKindManualRef.current = false;
          setOperatorTextAsset({
            kind: isMarkdown ? "markdown" : "text",
            name: fileName,
            mimeType: isMarkdown ? "text/markdown" : "text/plain",
            size: new Blob([fileContent]).size,
            text: fileContent,
            localFilePath: ref.filePath,
          });
          useCyberdeckTabStore.getState().setServer("m");
          setNavRailContext("gateway");
          setOperatorSurfaceMode("workspace");
          setOperatorDocMode(ref.mode === "view" ? "view" : "edit");
        });
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Could not open file in operator pane.";
        setMessages((prev) => [
          ...prev,
          { role: "system", text: `OPERATOR OPEN // FAILED // ${message}` },
        ]);
        return false;
      }
    },
    [openOperatorFile, setOperatorTextAsset],
  );

  const handleSetOperatorDocMode = useCallback((next: SetStateAction<"view" | "edit">) => {
    setOperatorDocMode(next);
  }, []);

  const handleOperatorDocumentKindChange = useCallback((nextKind: OperatorDocumentPickerKind) => {
    operatorKindManualRef.current = true;
    setOperatorDroppedAsset((prev) => {
      if (!prev) return prev;
      const name = resolveOperatorDocumentNameForKind(nextKind, prev.text || "", prev.name);
      if (nextKind === "pdf") {
        const hasPdfPreview = Boolean(
          prev.pdfSrc ||
            prev.surface === "pdf" ||
            prev.name.toLowerCase().endsWith(".pdf") ||
            prev.localFilePath?.toLowerCase().endsWith(".pdf"),
        );
        if (!hasPdfPreview) {
          toast.error("Open a PDF file before switching document type to PDF.");
          return prev;
        }
        const { text: _text, imageSrc: _imageSrc, ...rest } = prev;
        return {
          ...rest,
          kind: nextKind,
          mimeType: operatorMimeTypeForKind(nextKind),
          name,
          surface: "pdf",
        };
      }
      if (nextKind === "docx") {
        const hasDocxPreview = Boolean(
          prev.docxSrc ||
            prev.surface === "docx" ||
            prev.name.toLowerCase().endsWith(".docx") ||
            prev.localFilePath?.toLowerCase().endsWith(".docx"),
        );
        if (!hasDocxPreview) {
          toast.error("Open a DOCX file before switching document type to DOCX.");
          return prev;
        }
        const { text: _text, imageSrc: _imageSrc, pdfSrc: _pdfSrc, ...rest } = prev;
        return {
          ...rest,
          kind: nextKind,
          mimeType: operatorMimeTypeForKind(nextKind),
          name,
          surface: "docx",
        };
      }
      return {
        ...prev,
        kind: nextKind,
        mimeType: operatorMimeTypeForKind(nextKind),
        name,
        surface: undefined,
        pdfSrc: undefined,
        docxSrc: undefined,
        text: prev.text ?? "",
      };
    });
  }, []);

  useEffect(() => {
    if (!operatorDroppedAsset) return;
    if (document.activeElement === operatorNameInputRef.current) return;
    setOperatorDocNameDraft(operatorDroppedAsset.name);
  }, [operatorDroppedAsset?.kind, operatorDroppedAsset?.name]);

  const handleOperatorDocumentTextChange = useCallback((nextText: string) => {
    setOperatorDroppedAsset((prev) => {
      if (!prev) return prev;
      const name =
        prev.kind === "markdown"
          ? resolveOperatorDocumentNameForKind("markdown", nextText, prev.name)
          : prev.name;
      return {
        ...prev,
        text: nextText,
        name,
        size: new Blob([nextText]).size,
      };
    });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.echoMirageOperatorDocumentText = () => operatorDroppedAsset?.text ?? "";
    return () => {
      delete window.echoMirageOperatorDocumentText;
    };
  }, [operatorDroppedAsset?.text]);

  useLayoutEffect(() => {
    if (!operatorSurfaceIsDocument || operatorDocMode !== "edit") return;
    const el = operatorEditorRef.current;
    if (!el) return;
    el.style.height = "auto";
    const minHeight = Math.max(el.scrollHeight, el.clientHeight);
    el.style.height = `${minHeight}px`;
  }, [operatorDocMode, operatorDroppedAsset?.text, operatorSurfaceIsDocument]);

  useEffect(() => {
    if (!operatorSurfaceIsDocument || operatorDocMode !== "edit") return;
    operatorNameInputRef.current?.focus({ preventScroll: true });
    operatorNameInputRef.current?.select();
  }, [operatorDocMode, operatorSurfaceIsDocument]);

  const commitOperatorDocName = useCallback(() => {
    if (!operatorDroppedAsset) return;
    const nextName = operatorDocNameDraft.trim();
    if (!nextName) {
      setOperatorDocNameDraft(operatorDroppedAsset.name);
      return;
    }
    if (nextName === operatorDroppedAsset.name) return;
    setOperatorDroppedAsset((prev) => (prev ? { ...prev, name: nextName } : prev));
    setOperatorDocNameDraft(nextName);
  }, [operatorDocNameDraft, operatorDroppedAsset]);

  const clearOperatorDocument = useCallback(() => {
    operatorKindManualRef.current = false;
    setOperatorActiveFilePath(null);
    operatorFileHistoryRef.current = [];
    operatorFileHistoryIndexRef.current = -1;
    operatorFileHistoryLoadersRef.current.clear();
    setOperatorFileHistory([]);
    setOperatorFileHistoryIndex(-1);
    setOperatorTextAsset({
      kind: "text",
      name: "",
      mimeType: "text/plain",
      size: 0,
      text: "",
    });
    setOperatorDocNameDraft("");
    setOperatorDocMode("edit");
  }, [setOperatorTextAsset]);


  const copyOperatorDocToClipboard = useCallback(async () => {
    const text = operatorDroppedAsset?.text || "";
    if (!operatorSurfaceIsDocument || !text.trim()) {
      toast.error("Operator document has no text.");
      return;
    }

    try {
      await copyTextToClipboard(text);
      toast.success(`Copied "${operatorDroppedAsset?.name || "Operator document"}" to clipboard.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not copy operator document.");
    }
  }, [operatorDroppedAsset?.name, operatorDroppedAsset?.text, operatorSurfaceIsDocument]);

  const completeOperatorSave = useCallback(
    async (
      intent: OperatorSaveIntent,
      options: {
        pickerPromise?: Promise<SaveFilePickerHandle> | null;
      },
    ) => {
      const electronSave = (window as Window & { echoMirageSave?: EchoMirageSaveApi }).echoMirageSave;
      const pickerFn = (window as Window & {
        showSaveFilePicker?: (options?: SaveFilePickerOptions) => Promise<SaveFilePickerHandle>;
      }).showSaveFilePicker;

      const writePickerResult = async (pickerPromise: Promise<SaveFilePickerHandle>) => {
        const handle = await pickerPromise;
        const writable = await handle.createWritable();
        await writable.write(intent.text);
        await writable.close();
        toast.success(
          intent.cadreTarget?.constitutionalPrefix
            ? `Saved ${intent.suggestedFilename} (Cadre folder: ${intent.cadreTarget.relativeDirectory})`
            : `Saved "${intent.suggestedFilename}".`,
        );
      };

      try {
        if (electronSave) {
          const result = await electronSave.showDialog({
            defaultRelativePath: intent.suggestedSavePath,
            content: intent.text,
          });
          if (!result.canceled && result.filePath) {
            toast.success(
              intent.cadreTarget?.constitutionalPrefix
                ? `Saved to Cadre route // ${intent.cadreTarget.relativeDirectory} // ${result.filePath}`
                : `Saved "${result.filePath}".`,
            );
            return;
          }
          if (result.canceled && !result.error) {
            toast.info("Save canceled.");
            return;
          }
          if (result.error) {
            toast.error(`Native save failed: ${result.error}`);
          }
        }

        if (await saveViaCadreApi(intent, false)) {
          toast.success(`Saved to ${intent.suggestedSavePath}`);
          return;
        }

        if (options.pickerPromise) {
          await writePickerResult(options.pickerPromise);
          return;
        }

        if (typeof pickerFn === "function") {
          await writePickerResult(
            pickerFn({
              suggestedName: intent.suggestedFilename,
              types: intent.fileTypes,
              excludeAcceptAllOption: false,
            }),
          );
          return;
        }

        downloadOperatorDoc(intent);
        toast.success(
          intent.cadreTarget?.constitutionalPrefix
            ? `Downloaded ${intent.suggestedFilename} (browser download — target ${intent.suggestedSavePath})`
            : `Downloaded "${intent.suggestedFilename}".`,
        );
      } catch (err) {
        if (isPickerAbortError(err)) {
          toast.info("Save canceled.");
          return;
        }
        try {
          if (await saveViaCadreApi(intent, true)) {
            toast.success(`Saved to ${intent.suggestedSavePath}`);
            return;
          }
        } catch (apiErr) {
          toast.error(apiErr instanceof Error ? apiErr.message : "Cadre save failed");
          return;
        }
        downloadOperatorDoc(intent);
        toast.info(`Saved via download as ${intent.suggestedFilename}`);
      }
    },
    [],
  );

  const saveOperatorDocAsFile = useCallback(async () => {
    const text = readOperatorPaneSaveText(operatorDroppedAsset?.text || "");
    if (!operatorSurfaceIsDocument || !text.trim()) {
      toast.error("Operator document has no text.");
      return;
    }
    if (text !== (operatorDroppedAsset?.text || "")) {
      handleOperatorDocumentTextChange(text);
    }

    const intent = buildOperatorSaveIntent({
      text,
      kind: operatorDroppedAsset?.kind,
      mimeType: operatorDroppedAsset?.mimeType || "text/plain",
      currentName: operatorDroppedAsset?.name,
      headerName: operatorDocNameDraft,
      sourceFilePath: operatorActiveFilePath,
    });

    const electronSave = (window as Window & { echoMirageSave?: EchoMirageSaveApi }).echoMirageSave;
    const pickerFn = (window as Window & {
      showSaveFilePicker?: (options?: SaveFilePickerOptions) => Promise<SaveFilePickerHandle>;
    }).showSaveFilePicker;

    let pickerPromise: Promise<SaveFilePickerHandle> | null = null;
    if (!electronSave && typeof pickerFn === "function") {
      try {
        pickerPromise = pickerFn({
          suggestedName: intent.suggestedFilename,
          types: intent.fileTypes,
          excludeAcceptAllOption: false,
        });
      } catch {
        await completeOperatorSave(intent, { pickerPromise: null });
        return;
      }
    }

    await completeOperatorSave(intent, { pickerPromise });
  }, [
    completeOperatorSave,
    handleOperatorDocumentTextChange,
    operatorActiveFilePath,
    operatorDocNameDraft,
    operatorDroppedAsset?.kind,
    operatorDroppedAsset?.mimeType,
    operatorDroppedAsset?.name,
    operatorDroppedAsset?.text,
    operatorSurfaceIsDocument,
  ]);

  const saveOperatorDocInPlace = useCallback(async () => {
    const text = readOperatorPaneSaveText(operatorDroppedAsset?.text || "");
    if (!operatorSurfaceIsDocument || !text.trim()) {
      toast.error("Operator document has no text.");
      return;
    }
    if (!operatorActiveFilePath) {
      toast.error("No open file to save.");
      return;
    }
    if (
      !canSaveOperatorDocumentInPlace(
        operatorActiveFilePath,
        operatorDroppedAsset?.localFilePath,
        operatorFolderRootsRef.current,
      )
    ) {
      toast.info("This document has no folder path — use Save as or pick a location.");
      await saveOperatorDocAsFile();
      return;
    }
    if (text !== (operatorDroppedAsset?.text || "")) {
      handleOperatorDocumentTextChange(text);
    }

    const result = await saveOperatorDocumentInPlace(
      operatorActiveFilePath,
      text,
      operatorFolderRootsRef.current,
      operatorDroppedAsset?.localFilePath,
    );
    if (!result.ok) {
      toast.error(result.error || "Could not save file.");
      return;
    }
    window.dispatchEvent(
      new CustomEvent(OPERATOR_FILE_SAVED_EVENT, {
        detail: { logicalPath: operatorActiveFilePath },
      }),
    );
    const savedName =
      result.filePath?.split(/[/\\]/).pop() ||
      operatorActiveFilePath.split(/[/\\]/).pop() ||
      "file";
    toast.success(`Saved "${savedName}".`);
  }, [
    handleOperatorDocumentTextChange,
    operatorActiveFilePath,
    operatorDroppedAsset?.localFilePath,
    operatorDroppedAsset?.text,
    operatorSurfaceIsDocument,
    saveOperatorDocAsFile,
  ]);

  const saveOperatorDocument = useCallback(() => {
    if (
      canSaveOperatorDocumentInPlace(
        operatorActiveFilePath,
        operatorDroppedAsset?.localFilePath,
        operatorFolderRootsRef.current,
      )
    ) {
      void saveOperatorDocInPlace();
      return;
    }
    saveOperatorDocAsFile();
  }, [
    operatorActiveFilePath,
    operatorDroppedAsset?.localFilePath,
    saveOperatorDocAsFile,
    saveOperatorDocInPlace,
  ]);

  const exportOperatorMarkdown = useCallback(async (format: OperatorExportFormat) => {
    const text = operatorDroppedAsset?.text || "";
    if (!operatorSurfaceIsDocument || !text.trim()) {
      toast.error("Operator document has no text.");
      return;
    }
    const baseName = operatorDocNameDraft || operatorDroppedAsset?.name || "document.md";
    const localFilePath = operatorDroppedAsset?.localFilePath ?? null;
    try {
      const { exportMarkdownToDocx, exportMarkdownToPdf } = await import(
        "@/lib/markdown-to-docx-export"
      );
      if (format === "docx") {
        const suggestedFilename = docxFilenameFromMarkdownName(baseName);
        const result = await exportMarkdownToDocx({
          markdown: text,
          suggestedFilename,
          localFilePath,
        });
        if (result.canceled) {
          toast.info("DOCX export canceled.");
          return;
        }
        toast.success(
          result.outputPath
            ? `Exported as DOCX → ${result.outputPath}`
            : `Exported as DOCX: "${result.filename}".`,
        );
      } else {
        const suggestedFilename = pdfFilenameFromMarkdownName(baseName);
        const result = await exportMarkdownToPdf({
          markdown: text,
          suggestedFilename,
          localFilePath,
        });
        if (result.canceled) {
          toast.info("PDF export canceled.");
          return;
        }
        toast.success(
          result.outputPath
            ? `Exported as PDF → ${result.outputPath}`
            : `Exported as PDF: "${result.filename}".`,
        );
        if (result.outputPath && window.echoMirageOpen?.openPath) {
          void window.echoMirageOpen.openPath(result.outputPath);
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `${format.toUpperCase()} export failed.`);
    }
  }, [
    operatorDocNameDraft,
    operatorDroppedAsset?.localFilePath,
    operatorDroppedAsset?.name,
    operatorDroppedAsset?.text,
    operatorSurfaceIsDocument,
  ]);

  const exportMarkdownFileToDocx = useCallback(async (filePath: string) => {
    setMessages((prev) => [...prev, { role: "system", text: `MUTHUR_EXPORT_DOCX // ${filePath}` }]);
    try {
      const res = await fetch("/api/convert-markdown-to-docx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filePath }),
      });
      const payload = (await res.json()) as {
        ok?: boolean;
        outputPath?: string;
        suggestedFilename?: string;
        error?: string;
      };
      if (!res.ok || !payload.ok) {
        throw new Error(payload.error || `DOCX export failed (${res.status})`);
      }
      toast.success(`Exported ${filePath} → ${payload.outputPath || payload.suggestedFilename || "docx"}`);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: `Exported **${filePath}** to DOCX.\n\nOutput: \`${payload.outputPath || payload.suggestedFilename}\``,
        },
      ]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "DOCX export failed.");
      setMessages((prev) => [
        ...prev,
        { role: "system", text: "MUTHUR_EXPORT_DOCX // FAILED" },
      ]);
    }
  }, []);

  const exportMarkdownFileToPdf = useCallback(async (filePath: string) => {
    setMessages((prev) => [...prev, { role: "system", text: `MUTHUR_EXPORT_PDF // ${filePath}` }]);
    try {
      const res = await fetch("/api/convert-markdown-to-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filePath }),
      });
      const payload = (await res.json()) as {
        ok?: boolean;
        outputPath?: string;
        suggestedFilename?: string;
        error?: string;
      };
      if (!res.ok || !payload.ok) {
        throw new Error(payload.error || `PDF export failed (${res.status})`);
      }
      toast.success(`Exported ${filePath} → ${payload.outputPath || payload.suggestedFilename || "pdf"}`);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: `Exported **${filePath}** to PDF.\n\nOutput: \`${payload.outputPath || payload.suggestedFilename}\``,
        },
      ]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "PDF export failed.");
      setMessages((prev) => [
        ...prev,
        { role: "system", text: "MUTHUR_EXPORT_PDF // FAILED" },
      ]);
    }
  }, []);

  const pasteClipboardToOperator = useCallback(async () => {
    operatorKindManualRef.current = false;
    try {
      const raw = await readEchoMirageClipboardText();

      if (!raw.trim()) {
        toast.error("Clipboard has no text.");
        return;
      }

      const clipboardText = cleanOperatorPasteText(raw);
      const strippedWrapper = operatorPasteWasCleaned(raw, clipboardText);

      if (
        operatorDocMode === "edit" &&
        operatorSurfaceIsDocument &&
        operatorDroppedAsset
      ) {
        const merged = pasteIntoOperatorTextDocument(
          clipboardText,
          operatorDroppedAsset.text ?? "",
        );
        setOperatorTextAsset({
          ...operatorDroppedAsset,
          text: merged,
          size: new Blob([merged]).size,
        });
        toast.success(
          strippedWrapper
            ? "Pasted at cursor — stripped chat code-fence wrapper."
            : "Pasted into document.",
        );
        return;
      }

      const pasteHistoryPath = `paste://${Date.now()}`;
      let strippedWrapperOnDraft = false;
      await openOperatorFile(pasteHistoryPath, async () => {
        strippedWrapperOnDraft = setOperatorTextAsset({
          kind: "text",
          name: operatorDroppedAsset?.name ?? "draft.txt",
          mimeType: "text/plain",
          size: new Blob([clipboardText]).size,
          text: clipboardText,
        });
      });
      setOperatorSurfaceMode("workspace");
      setOperatorDocMode("edit");
      toast.success(
        strippedWrapperOnDraft
          ? "Pasted into operator — stripped chat code-fence wrapper."
          : "Pasted clipboard into a new operator draft.",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not paste clipboard text.");
    }
  }, [
    openOperatorFile,
    operatorDocMode,
    operatorDroppedAsset,
    operatorSurfaceIsDocument,
    setOperatorTextAsset,
  ]);

  const loadOperatorAssetFromFile = useCallback(async (file: File, hints?: OperatorIngestHints) => {
    operatorKindManualRef.current = false;
    revokeOperatorBlobUrl(operatorPreviewBlobUrlRef.current);
    operatorPreviewBlobUrlRef.current = null;
    const ingested = await buildOperatorIngestFromFile(file, hints);
    const asset: DroppedOperatorAsset = {
      kind: ingested.kind,
      name: ingested.name,
      mimeType: ingested.mimeType,
      size: ingested.size,
      surface: ingested.surface,
      ...(ingested.text !== undefined ? { text: ingested.text } : {}),
      ...(ingested.imageSrc ? { imageSrc: ingested.imageSrc } : {}),
      ...(ingested.pdfSrc ? { pdfSrc: ingested.pdfSrc } : {}),
      ...(ingested.docxSrc ? { docxSrc: ingested.docxSrc } : {}),
      ...(hints?.diskAbsolutePath ? { localFilePath: hints.diskAbsolutePath } : {}),
    };

    if (ingested.surface === "markdown" || ingested.surface === "text") {
      setOperatorTextAsset(asset);
    } else {
      const { text: _text, ...binarySafe } = asset;
      if (binarySafe.pdfSrc?.startsWith("blob:")) {
        operatorPreviewBlobUrlRef.current = binarySafe.pdfSrc;
      }
      if (binarySafe.docxSrc?.startsWith("blob:")) {
        operatorPreviewBlobUrlRef.current = binarySafe.docxSrc;
      }
      if (binarySafe.imageSrc?.startsWith("blob:")) {
        operatorPreviewBlobUrlRef.current = binarySafe.imageSrc;
      }
      setOperatorDroppedAsset(binarySafe);
      setOperatorDocNameDraft(asset.name);
    }
    setOperatorSurfaceMode("workspace");
    setOperatorDocMode("edit");
  }, [setOperatorTextAsset]);

  const reloadOperatorFolderFile = useCallback(
    async (filePath: string) => {
      const rootName = filePath.split("/")[0];
      const root = operatorFolderRootsRef.current.find((entry) => entry.name === rootName);
      if (!root) return;
      const read = await readFileFromFolderRoot(root, filePath);
      if (!read) return;
      await loadOperatorAssetFromFile(read.file, {
        diskAbsolutePath: read.diskAbsolutePath,
        fileSize: read.fileSize,
        pdfBase64: read.pdfBase64,
        inlineBase64: read.inlineBase64,
      });
    },
    [loadOperatorAssetFromFile],
  );

  useEffect(() => {
    if (!deckUiHydrated) return;
    const pending = operatorWorkspaceRestoreRef.current;
    if (!pending) return;
    if (operatorFolderRootsRef.current.length === 0) return;

    operatorWorkspaceRestoreRef.current = null;
    void openOperatorFile(
      pending.activeFilePath,
      () => reloadOperatorFolderFile(pending.activeFilePath),
      true,
    ).finally(() => {
      setOperatorDocMode(pending.docMode);
    });
  }, [deckUiHydrated, openOperatorFile, operatorFolderRootsCount, reloadOperatorFolderFile]);

  const openOperatorFolderFile = useCallback(
    async (filePath: string, file: File) => {
      await openOperatorFile(filePath, async () => {
        const rootName = filePath.split("/")[0];
        const root = operatorFolderRootsRef.current.find((entry) => entry.name === rootName);
        if (root) {
          const fresh = await readFileFromFolderRoot(root, filePath);
          if (fresh) {
            await loadOperatorAssetFromFile(fresh.file, {
              diskAbsolutePath: fresh.diskAbsolutePath,
              fileSize: fresh.fileSize,
              pdfBase64: fresh.pdfBase64,
              inlineBase64: fresh.inlineBase64,
            });
          } else {
            await loadOperatorAssetFromFile(file);
          }
          return;
        }
        await loadOperatorAssetFromFile(file);
      });
    },
    [loadOperatorAssetFromFile, openOperatorFile],
  );

  const handleOperatorFolderRootsChange = useCallback((roots: OperatorDocFolderRoot[]) => {
    operatorFolderRootsRef.current = roots;
    setOperatorFolderRootsCount(roots.length);
  }, []);
  useEffect(() => {
    const onRequestEditMode = () => setOperatorDocMode("edit");
    window.addEventListener("echo-mirage-operator-request-edit-mode", onRequestEditMode);
    return () => {
      window.removeEventListener("echo-mirage-operator-request-edit-mode", onRequestEditMode);
    };
  }, []);

  useEffect(() => {
    if (operatorSurfaceMode !== "browser") return;
    const view = operatorBrowserRef.current;
    if (!view) return;

    const syncSnapshot = () => {
      void captureOperatorBrowserSnapshot();
    };

    view.addEventListener("dom-ready", syncSnapshot as EventListener);
    view.addEventListener("did-stop-loading", syncSnapshot as EventListener);
    view.addEventListener("page-title-updated", syncSnapshot as EventListener);
    syncSnapshot();

    return () => {
      view.removeEventListener("dom-ready", syncSnapshot as EventListener);
      view.removeEventListener("did-stop-loading", syncSnapshot as EventListener);
      view.removeEventListener("page-title-updated", syncSnapshot as EventListener);
    };
  }, [captureOperatorBrowserSnapshot, operatorSurfaceMode, operatorBrowserUrl]);

  useEffect(() => {
    const onContextAction = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      if (detail === "save-operator") {
        saveOperatorDocument();
        return;
      }
      if (detail === "paste-operator") {
        void pasteClipboardToOperator();
        return;
      }
      if (detail === "copy-operator") {
        void copyOperatorDocToClipboard();
      }
    };

    window.addEventListener("echo-mirage-context-action", onContextAction);
    return () => window.removeEventListener("echo-mirage-context-action", onContextAction);
  }, [copyOperatorDocToClipboard, pasteClipboardToOperator, saveOperatorDocument]);

  const {
    isOperatorDragOver,
    handleOperatorDragOver,
    handleOperatorDragLeave,
    handleOperatorDrop,
  } = useOperatorDragDrop({
    getActiveServerId,
    openOperatorFile,
    loadOperatorAssetFromFile,
  });

  const showSurveyOperatorImage = useCallback((asset: DroppedOperatorAsset) => {
    setOperatorDroppedAsset(asset);
    setOperatorSurfaceMode("workspace");
    setOperatorDocMode("edit");
  }, []);

  const assignOperatorAsset = useCallback((asset: DroppedOperatorAsset) => {
    operatorKindManualRef.current = false;
    setOperatorDroppedAsset(asset);
    setOperatorDocNameDraft(asset.name);
    setOperatorSurfaceMode("workspace");
    setOperatorDocMode("edit");
  }, []);

  return {
    operatorDroppedAsset,
    operatorSurfaceMode,
    operatorBrowserEngine,
    operatorDocMode,
    operatorDocNameDraft,
    operatorFileHistory,
    operatorFileHistoryIndex,
    operatorActiveFilePath,
    operatorFolderRootsRef,
    operatorFolderRootsCount,
    operatorBrowserUrl,
    operatorBrowserSnapshot,
    operatorEditorRef,
    operatorNameInputRef,
    operatorBrowserRef,
    operatorPreviewBlobUrlRef,
    operatorSurfaceIsDocument,
    setOperatorDocNameDraft,
    setOperatorSurfaceMode,
    setOperatorBrowserUrl,
    setOperatorDocMode,
    setOperatorBrowserEngine,
    restoreOperatorUiFromDeck,
    captureOperatorBrowserSnapshot,
    openOperatorBrowser,
    performBrowserCommand,
    openOperatorFile,
    navigateOperatorFileHistory,
    openConvertedMarkdownInOperator,
    openWorkspaceFileInOperator,
    handleSetOperatorDocMode,
    handleOperatorDocumentKindChange,
    handleOperatorDocumentTextChange,
    commitOperatorDocName,
    clearOperatorDocument,
    copyOperatorDocToClipboard,
    saveOperatorDocInPlace,
    saveOperatorDocAsFile,
    saveOperatorDocument,
    exportOperatorMarkdown,
    pasteClipboardToOperator,
    openOperatorFolderFile,
    handleOperatorFolderRootsChange,
    reloadOperatorFolderFile,
    isOperatorDragOver,
    handleOperatorDragOver,
    handleOperatorDragLeave,
    handleOperatorDrop,
    showSurveyOperatorImage,
    loadOperatorAssetFromFile,
    setOperatorTextAsset,
    assignOperatorAsset,
  };
}
