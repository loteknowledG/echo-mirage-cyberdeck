"use client";

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
  applyPendingDiff(approval: { approved: true }): boolean;
  cancelPendingDiff(): void;
  getPendingDiff(): OperatorEditorDiffProposal | null;
};

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
  }
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

