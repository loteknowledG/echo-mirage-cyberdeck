"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Editor, { DiffEditor, type OnMount } from "@monaco-editor/react";
import type { editor, IPosition, IRange, ISelection } from "monaco-editor";
import { appendFlightLog } from "@/lib/flight-log";
import {
  clearMonacoEditorContext,
  setMonacoEditorContext,
  type MonacoEditorContext,
} from "@/lib/monaco-editor-context";
import {
  detectOperatorEditorLanguage,
  exposeOperatorWorkbench,
  operatorEditorFileExtension,
  type OperatorEditorDiffProposal,
  type OperatorEditorEdit,
  type OperatorEditorRange,
  type OperatorEditorState,
} from "@/lib/operator-workbench";
import { OperatorDocTypeMenu } from "@/components/cyberdeck/operator-doc-type-menu";
import type { OperatorDocumentPickerKind } from "@/lib/operator-document-types";

type OperatorMonacoWorkbenchProps = {
  activeFilePath?: string | null;
  fileName: string;
  documentKind: OperatorDocumentPickerKind;
  onDocumentKindChange?: (kind: OperatorDocumentPickerKind) => void;
  value: string;
  onChange: (value: string) => void;
  onImmediateChange?: (value: string) => void;
  onSave: () => void | Promise<void>;
};

function lineRange(model: editor.ITextModel, startLine: number, endLine: number): IRange {
  const start = Math.max(1, Math.min(model.getLineCount(), Math.floor(startLine)));
  const end = Math.max(start, Math.min(model.getLineCount(), Math.floor(endLine)));
  return {
    startLineNumber: start,
    startColumn: 1,
    endLineNumber: end,
    endColumn: model.getLineMaxColumn(end),
  };
}

function proposalContent(
  model: editor.ITextModel,
  selection: ISelection,
  edit: OperatorEditorEdit,
): string {
  const content = model.getValue();
  if (edit.kind === "replace_content") return edit.text;
  if (edit.kind === "append_section") {
    return `${content}${content.endsWith("\n") || !content ? "" : "\n"}${edit.text}`;
  }

  const range: IRange =
    edit.kind === "replace_line_range"
      ? lineRange(model, edit.startLine, edit.endLine)
      : edit.kind === "replace_selection"
        ? {
            startLineNumber: selection.selectionStartLineNumber,
            startColumn: selection.selectionStartColumn,
            endLineNumber: selection.positionLineNumber,
            endColumn: selection.positionColumn,
          }
        : {
            startLineNumber: selection.positionLineNumber,
            startColumn: selection.positionColumn,
            endLineNumber: selection.positionLineNumber,
            endColumn: selection.positionColumn,
          };

  const start = model.getOffsetAt({
    lineNumber: range.startLineNumber,
    column: range.startColumn,
  });
  const end = model.getOffsetAt({
    lineNumber: range.endLineNumber,
    column: range.endColumn,
  });
  return `${content.slice(0, start)}${edit.text}${content.slice(end)}`;
}

function toRange(selection: ISelection | null): OperatorEditorRange | null {
  if (!selection) return null;
  return {
    startLineNumber: selection.selectionStartLineNumber,
    startColumn: selection.selectionStartColumn,
    endLineNumber: selection.positionLineNumber,
    endColumn: selection.positionColumn,
  };
}

function isLiveEditor(
  instance: editor.IStandaloneCodeEditor | null | undefined,
): instance is editor.IStandaloneCodeEditor {
  if (!instance) return false;
  try {
    const model = instance.getModel();
    return model !== null && !model.isDisposed();
  } catch {
    return false;
  }
}

export function OperatorMonacoWorkbench({
  activeFilePath = null,
  fileName,
  documentKind,
  onDocumentKindChange,
  value,
  onChange,
  onImmediateChange,
  onSave,
}: OperatorMonacoWorkbenchProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const mountedRef = useRef(true);
  const editorDisposablesRef = useRef<Array<{ dispose: () => void }>>([]);
  const savedTextRef = useRef(value);
  const stateRef = useRef<OperatorEditorState | null>(null);
  const [pendingDiff, setPendingDiff] = useState<OperatorEditorDiffProposal | null>(null);
  const pendingDiffRef = useRef<OperatorEditorDiffProposal | null>(null);
  const [cursor, setCursor] = useState<IPosition>({ lineNumber: 1, column: 1 });
  const [selection, setSelection] = useState<ISelection | null>(null);
  const [dirty, setDirty] = useState(false);

  const language = useMemo(() => detectOperatorEditorLanguage(fileName), [fileName]);

  useEffect(() => {
    savedTextRef.current = value;
    setDirty(false);
    setPendingDiff(null);
    pendingDiffRef.current = null;
  }, [activeFilePath, fileName]);

  // Publish context update whenever relevant state changes
  useEffect(() => {
    const ctx: Partial<MonacoEditorContext> = {
      active: true,
      filePath: activeFilePath ?? null,
      fileName,
      fileExtension: operatorEditorFileExtension(fileName),
      language,
      content: value,
      contentLength: value.length,
      dirty,
      readOnly: false,
      lastUpdated: Date.now(),
    };
    setMonacoEditorContext(ctx);
  }, [activeFilePath, fileName, value, language, dirty]);

  // Publish cursor and selection changes
  useEffect(() => {
    setMonacoEditorContext({
      cursorLine: cursor.lineNumber,
      cursorColumn: cursor.column,
      selectionStartLine: selection?.selectionStartLineNumber ?? null,
      selectionStartColumn: selection?.selectionStartColumn ?? null,
      selectionEndLine: selection?.positionLineNumber ?? null,
      selectionEndColumn: selection?.positionColumn ?? null,
      selectionText: selection ? (
        selection.selectionStartLineNumber !== selection.positionLineNumber ||
        selection.selectionStartColumn !== selection.positionColumn
      ) ? value.slice(0, 500) : null : null,
      lastUpdated: Date.now(),
    });
  }, [cursor, selection, value]);

  const readState = useCallback((): OperatorEditorState => {
    const instance = editorRef.current;
    if (isLiveEditor(instance)) {
      try {
        const model = instance.getModel();
        const currentSelection = instance.getSelection() ?? null;
        const position = instance.getPosition() ?? cursor;
        return {
          activeFilePath,
          fileName,
          fileExtension: operatorEditorFileExtension(fileName),
          language,
          content: model?.getValue() ?? value,
          selection: {
            text: model && currentSelection ? model.getValueInRange(currentSelection) : "",
            range: toRange(currentSelection),
          },
          cursor: position,
          dirty: model ? model.getValue() !== savedTextRef.current : dirty,
          readOnly: false,
        };
      } catch {
        // Editor torn down between mount check and read.
      }
    }

    return {
      activeFilePath,
      fileName,
      fileExtension: operatorEditorFileExtension(fileName),
      language,
      content: value,
      selection: {
        text: "",
        range: toRange(selection),
      },
      cursor,
      dirty,
      readOnly: false,
    };
  }, [activeFilePath, cursor, dirty, fileName, language, selection, value]);

  stateRef.current = readState();

  const suggestEdit = useCallback(
    (edit: OperatorEditorEdit): OperatorEditorDiffProposal => {
      const instance = editorRef.current;
      if (!isLiveEditor(instance)) throw new Error("Operator editor is not ready.");
      const model = instance.getModel();
      const currentSelection = instance.getSelection();
      if (!model || !currentSelection) throw new Error("Operator editor is not ready.");
      const proposal = {
        id: crypto.randomUUID(),
        action: edit.kind,
        original: model.getValue(),
        proposed: proposalContent(model, currentSelection, edit),
        createdAt: new Date().toISOString(),
      };
      pendingDiffRef.current = proposal;
      setPendingDiff(proposal);
      appendFlightLog({
        actor: "MUTHUR",
        action: `editor suggestion :: ${edit.kind}`,
        result: "AWAITING APPROVAL",
        severity: "warning",
      });
      return proposal;
    },
    [],
  );

  const publishDocumentChange = useCallback(
    (text: string, immediate = false) => {
      if (immediate) {
        (onImmediateChange ?? onChange)(text);
        return;
      }
      onChange(text);
    },
    [onChange, onImmediateChange],
  );

  const setDocumentTextInternal = useCallback(
    (text: string, immediate = true): boolean => {
      const instance = editorRef.current;
      if (!isLiveEditor(instance)) return false;
      try {
        const model = instance.getModel();
        if (!model) return false;
        if (model.getValue() === text) {
          setDirty(text !== savedTextRef.current);
          publishDocumentChange(text, immediate);
          return true;
        }
        instance.pushUndoStop();
        instance.executeEdits("muthur", [
          {
            range: model.getFullModelRange(),
            text,
            forceMoveMarkers: true,
          },
        ]);
        instance.pushUndoStop();
        setDirty(text !== savedTextRef.current);
        publishDocumentChange(text, immediate);
        appendFlightLog({
          actor: "MUTHUR",
          action: "editor document synced",
          result: "UNDOABLE // UNSAVED",
          severity: "success",
        });
        return true;
      } catch {
        return false;
      }
    },
    [publishDocumentChange],
  );

  const setDocumentText = useCallback(
    (text: string): boolean => setDocumentTextInternal(text),
    [setDocumentTextInternal],
  );

  const forceDocumentText = useCallback(
    (text: string): boolean => setDocumentTextInternal(text),
    [setDocumentTextInternal],
  );

  const applyEdit = useCallback(
    (edit: OperatorEditorEdit): boolean => {
      const instance = editorRef.current;
      if (!isLiveEditor(instance)) return false;
      const model = instance.getModel();
      const currentSelection = instance.getSelection();
      if (!model || !currentSelection) return false;

      const proposed = proposalContent(model, currentSelection, edit);
      return setDocumentTextInternal(proposed);
    },
    [setDocumentTextInternal],
  );

  const applyPendingDiff = useCallback((approval: { approved: true }): boolean => {
    if (approval?.approved !== true) return false;
    const proposal = pendingDiffRef.current;
    if (!proposal) return false;
    const applied = setDocumentTextInternal(proposal.proposed);
    if (!applied) return false;
    pendingDiffRef.current = null;
    setPendingDiff(null);
    appendFlightLog({
      actor: "MUTHUR",
      action: `editor edit applied :: ${proposal.action}`,
      result: "UNDOABLE // UNSAVED",
      severity: "success",
    });
    return true;
  }, [setDocumentTextInternal]);

  const cancelPendingDiff = useCallback(() => {
    if (!pendingDiffRef.current) return;
    pendingDiffRef.current = null;
    setPendingDiff(null);
    appendFlightLog({
      actor: "MUTHUR",
      action: "editor suggestion dismissed",
      result: "NO CHANGE",
      severity: "info",
    });
  }, []);

  useEffect(() => {
    const instance = editorRef.current;
    if (!isLiveEditor(instance)) return;
    try {
      const model = instance.getModel();
      if (!model || model.getValue() === value) return;
      setDocumentTextInternal(value, true);
    } catch {
      // Editor disposed during sync.
    }
  }, [setDocumentTextInternal, value]);

  useEffect(
    () =>
      exposeOperatorWorkbench({
        readActiveEditor: readState,
        readSelectedText: () => readState().selection,
        suggestEdit,
        applyEdit,
        setDocumentText,
        forceDocumentText,
        applyPendingDiff,
        cancelPendingDiff,
        getPendingDiff: () => pendingDiffRef.current,
      }),
    [applyEdit, applyPendingDiff, cancelPendingDiff, forceDocumentText, readState, setDocumentText, suggestEdit],
  );

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      editorDisposablesRef.current.forEach((disposable) => disposable.dispose());
      editorDisposablesRef.current = [];
      editorRef.current = null;
      clearMonacoEditorContext();
    };
  }, []);

  useEffect(() => {
    const markSaved = () => {
      const instance = editorRef.current;
      if (isLiveEditor(instance)) {
        try {
          savedTextRef.current = instance.getValue();
        } catch {
          savedTextRef.current = value;
        }
      } else {
        savedTextRef.current = value;
      }
      setDirty(false);
    };
    window.addEventListener("echo-mirage-operator-file-saved", markSaved);
    return () => window.removeEventListener("echo-mirage-operator-file-saved", markSaved);
  }, [value]);

  const handleMount = useCallback<OnMount>((instance) => {
    editorDisposablesRef.current.forEach((disposable) => disposable.dispose());
    editorDisposablesRef.current = [];
    editorRef.current = instance;

    const updateSelection = () => {
      if (!mountedRef.current || !isLiveEditor(instance)) return;
      try {
        setCursor(instance.getPosition() ?? { lineNumber: 1, column: 1 });
        setSelection(instance.getSelection());
      } catch {
        // Editor disposed between event and handler.
      }
    };
    updateSelection();
    editorDisposablesRef.current = [
      instance.onDidChangeCursorPosition(updateSelection),
      instance.onDidChangeCursorSelection(updateSelection),
    ];
    instance.addCommand(2048 | 49, () => void onSave());
  }, [onSave]);

  return (
    <div
      className="flex min-h-[50vh] flex-1 flex-col overflow-hidden rounded-sm border border-[#1c1c1c] bg-black"
      tabIndex={0}
      onClick={() => {
        const instance = editorRef.current;
        if (isLiveEditor(instance)) {
          try {
            instance.focus();
          } catch {
            // Editor disposed.
          }
        }
      }}
    >
      <div className="flex items-center justify-between border-b border-[#1c1c1c] px-2 py-1 font-mono text-[9px] tracking-[0.04em] text-[#8a8a8a]">
        <span className="flex min-w-0 flex-wrap items-center gap-x-1 gap-y-0.5">
          {onDocumentKindChange ? (
            <OperatorDocTypeMenu
              value={documentKind}
              onChange={onDocumentKindChange}
              trigger="status"
            />
          ) : (
            <span className="uppercase text-emerald-200">{documentKind}</span>
          )}
          <span>
            // LN {cursor.lineNumber}, COL {cursor.column}
            {selection &&
            (selection.selectionStartLineNumber !== selection.positionLineNumber ||
              selection.selectionStartColumn !== selection.positionColumn)
              ? " // SELECTION ACTIVE"
              : ""}
          </span>
        </span>
        <span className="flex items-center gap-2">
          <span className={dirty ? "text-amber-300" : "text-emerald-300"}>
            {dirty ? "DIRTY" : "SAVED"}
          </span>
        </span>
      </div>
      {pendingDiff ? (
        <div className="flex min-h-0 flex-1 flex-col border-b border-amber-500/40">
          <div className="flex items-center justify-between bg-amber-950/20 px-2 py-1 font-mono text-[9px] text-amber-200">
            <span>MUTHUR DIFF // {pendingDiff.action.toUpperCase()} // APPROVAL REQUIRED</span>
            <span className="flex gap-2">
              <button type="button" onClick={() => applyPendingDiff({ approved: true })}>
                APPLY
              </button>
              <button type="button" onClick={cancelPendingDiff}>
                DISMISS
              </button>
            </span>
          </div>
          <DiffEditor
            height="38vh"
            language={language}
            original={pendingDiff.original}
            modified={pendingDiff.proposed}
            theme="vs-dark"
            options={{ readOnly: true, renderSideBySide: true, minimap: { enabled: false } }}
          />
        </div>
      ) : null}
      <Editor
        height={pendingDiff ? "32vh" : "62vh"}
        language={language}
        value={value}
        theme="vs-dark"
        onMount={handleMount}
        onChange={(next) => {
          const text = next ?? "";
          setDirty(text !== savedTextRef.current);
          onChange(text);
        }}
        options={{
          automaticLayout: true,
          fontFamily: "monospace",
          fontSize: 12,
          lineNumbersMinChars: 3,
          minimap: { enabled: false },
          readOnly: false,
          scrollBeyondLastLine: false,
          wordWrap: "off",
          contextmenu: true,
          multiCursorModifier: "ctrlCmd",
          insertSpaces: true,
          tabSize: 2,
          detectIndentation: true,
        }}
      />
    </div>
  );
}
