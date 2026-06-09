"use client";

import { getMonacoEditorContext } from "@/lib/monaco-editor-context";

export type OperatorEditorPosition = {
  lineNumber: number;
  column: number;
};

export type OperatorEditorRange = {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
};

export type OperatorEditorState = {
  activeFilePath: string | null;
  fileName: string;
  fileExtension: string;
  language: string;
  content: string;
  selection: {
    text: string;
    range: OperatorEditorRange | null;
  };
  cursor: OperatorEditorPosition;
  dirty: boolean;
  readOnly: boolean;
};

export type OperatorEditorEdit =
  | { kind: "insert_at_cursor"; text: string }
  | { kind: "replace_selection"; text: string }
  | { kind: "replace_line_range"; startLine: number; endLine: number; text: string }
  | { kind: "append_section"; text: string }
  | { kind: "replace_content"; text: string };

export type OperatorEditorDiffProposal = {
  id: string;
  action: OperatorEditorEdit["kind"];
  original: string;
  proposed: string;
  createdAt: string;
};

export type OperatorWorkbenchController = {
  readActiveEditor(): OperatorEditorState;
  readSelectedText(): OperatorEditorState["selection"];
  suggestEdit(edit: OperatorEditorEdit): OperatorEditorDiffProposal;
  applyEdit(edit: OperatorEditorEdit): boolean;
  /** Set full document text (e.g. after MUTHUR applied edits to parent state). */
  setDocumentText(text: string): boolean;
  /** Replace editor content even when it already matches (operator pane refresh). */
  forceDocumentText(text: string): boolean;
  applyPendingDiff(approval: { approved: true }): boolean;
  cancelPendingDiff(): void;
  getPendingDiff(): OperatorEditorDiffProposal | null;
};

export type OperatorEditSelectionContext = {
  cursorLine: number;
  cursorColumn: number;
  selectionStartLine: number;
  selectionStartColumn: number;
  selectionEndLine: number;
  selectionEndColumn: number;
};

function offsetForLineColumn(content: string, line: number, column: number): number {
  const lines = content.split("\n");
  const lineIndex = Math.max(1, Math.min(lines.length, Math.floor(line))) - 1;
  let offset = 0;
  for (let i = 0; i < lineIndex; i++) {
    offset += lines[i].length + 1;
  }
  const lineText = lines[lineIndex] ?? "";
  const col = Math.max(1, Math.min(lineText.length + 1, Math.floor(column)));
  return offset + col - 1;
}

/** Apply a MUTHUR edit to plain document text (Monaco-free path for operator pane sync). */
export function applyOperatorEditToText(
  content: string,
  edit: OperatorEditorEdit,
  selection?: Partial<OperatorEditSelectionContext>,
): string {
  if (edit.kind === "replace_content") return edit.text;
  if (edit.kind === "append_section") {
    return `${content}${content.endsWith("\n") || !content ? "" : "\n"}${edit.text}`;
  }

  const cursorLine = selection?.cursorLine ?? 1;
  const cursorColumn = selection?.cursorColumn ?? 1;
  const selectionStartLine = selection?.selectionStartLine ?? cursorLine;
  const selectionStartColumn = selection?.selectionStartColumn ?? cursorColumn;
  const selectionEndLine = selection?.selectionEndLine ?? cursorLine;
  const selectionEndColumn = selection?.selectionEndColumn ?? cursorColumn;

  let start = 0;
  let end = 0;

  if (edit.kind === "replace_line_range") {
    const lines = content.split("\n");
    const startLine = Math.max(1, Math.min(lines.length, Math.floor(edit.startLine)));
    const endLine = Math.max(startLine, Math.min(lines.length, Math.floor(edit.endLine)));
    const before = lines.slice(0, startLine - 1).join("\n");
    const after = lines.slice(endLine).join("\n");
    const prefix = before.length > 0 ? `${before}\n` : "";
    const suffix = after.length > 0 ? `\n${after}` : "";
    return `${prefix}${edit.text}${suffix}`;
  } else if (edit.kind === "replace_selection") {
    start = offsetForLineColumn(content, selectionStartLine, selectionStartColumn);
    end = offsetForLineColumn(content, selectionEndLine, selectionEndColumn);
  } else {
    start = offsetForLineColumn(content, cursorLine, cursorColumn);
    end = start;
  }

  if (start > end) {
    const swap = start;
    start = end;
    end = swap;
  }

  return `${content.slice(0, start)}${edit.text}${content.slice(end)}`;
}

const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  ".bash": "shell",
  ".cjs": "javascript",
  ".css": "css",
  ".csv": "plaintext",
  ".env": "plaintext",
  ".html": "html",
  ".htm": "html",
  ".ini": "ini",
  ".js": "javascript",
  ".json": "json",
  ".jsonc": "json",
  ".jsx": "javascript",
  ".log": "plaintext",
  ".markdown": "markdown",
  ".md": "markdown",
  ".mjs": "javascript",
  ".scss": "scss",
  ".sh": "shell",
  ".toml": "ini",
  ".ts": "typescript",
  ".tsx": "typescript",
  ".txt": "plaintext",
  ".yaml": "yaml",
  ".yml": "yaml",
};

function extensionForFileName(fileName: string): string {
  const normalized = fileName.trim().toLowerCase();
  if (!normalized) return "";
  if (normalized.startsWith(".env")) return ".env";
  const dot = normalized.lastIndexOf(".");
  return dot >= 0 ? normalized.slice(dot) : "";
}

export function detectOperatorEditorLanguage(fileName: string): string {
  const extension = extensionForFileName(fileName);
  if (LANGUAGE_BY_EXTENSION[extension]) return LANGUAGE_BY_EXTENSION[extension];
  if (/^(package|tsconfig|jsconfig|eslint|prettier|components)\.json$/i.test(fileName)) return "json";
  if (/^(dockerfile|makefile)$/i.test(fileName)) return "plaintext";
  return "plaintext";
}

export function operatorEditorFileExtension(fileName: string): string {
  return extensionForFileName(fileName);
}

declare global {
  interface Window {
    echoMirageOperatorWorkbench?: OperatorWorkbenchController;
    echoMirageOperatorDocumentText?: () => string;
  }
}

/** Latest document text for save/export (Monaco wins over stale React state). */
export function readOperatorPaneSaveText(fallback = ""): string {
  if (typeof window === "undefined") return fallback;
  const fromWorkbench = window.echoMirageOperatorWorkbench?.readActiveEditor?.()?.content;
  if (fromWorkbench) return fromWorkbench;
  const ctx = getMonacoEditorContext();
  if (ctx.active && ctx.contentLength > 0) return ctx.content;
  const fromHook = window.echoMirageOperatorDocumentText?.();
  if (typeof fromHook === "string" && fromHook.length > 0) return fromHook;
  return fallback;
}

export function exposeOperatorWorkbench(controller: OperatorWorkbenchController): () => void {
  if (typeof window === "undefined") return () => {};
  window.echoMirageOperatorWorkbench = controller;
  window.dispatchEvent(new CustomEvent("echo-mirage-operator-workbench-ready"));
  return () => {
    if (window.echoMirageOperatorWorkbench === controller) {
      delete window.echoMirageOperatorWorkbench;
    }
  };
}

