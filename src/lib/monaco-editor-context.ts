"use client";

export type MonacoEditorContext = {
  active: boolean;
  filePath: string | null;
  fileName: string | null;
  fileExtension: string | null;
  language: string | null;
  content: string;
  contentLength: number;
  selectionText: string | null;
  cursorLine: number | null;
  cursorColumn: number | null;
  selectionStartLine: number | null;
  selectionStartColumn: number | null;
  selectionEndLine: number | null;
  selectionEndColumn: number | null;
  dirty: boolean;
  readOnly: boolean;
  lastUpdated: number;
};

const DEFAULT_CONTEXT: MonacoEditorContext = {
  active: false,
  filePath: null,
  fileName: null,
  fileExtension: null,
  language: null,
  content: "",
  contentLength: 0,
  selectionText: null,
  cursorLine: null,
  cursorColumn: null,
  selectionStartLine: null,
  selectionStartColumn: null,
  selectionEndLine: null,
  selectionEndColumn: null,
  dirty: false,
  readOnly: false,
  lastUpdated: 0,
};

let currentContext: MonacoEditorContext = { ...DEFAULT_CONTEXT };

const listeners = new Set<(ctx: MonacoEditorContext) => void>();

export function getMonacoEditorContext(): MonacoEditorContext {
  return currentContext;
}

export function setMonacoEditorContext(update: Partial<MonacoEditorContext>): void {
  currentContext = { ...currentContext, ...update, lastUpdated: Date.now() };
  listeners.forEach((fn) => fn(currentContext));
}

export function subscribeMonacoEditorContext(
  listener: (ctx: MonacoEditorContext) => void,
): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function clearMonacoEditorContext(): void {
  currentContext = { ...DEFAULT_CONTEXT, lastUpdated: Date.now() };
  listeners.forEach((fn) => fn(currentContext));
}

declare global {
  interface Window {
    echoMirageMonacoEditorContext?: {
      get: () => MonacoEditorContext;
      subscribe: (fn: (ctx: MonacoEditorContext) => void) => () => void;
    };
  }
}

if (typeof window !== "undefined") {
  window.echoMirageMonacoEditorContext = {
    get: getMonacoEditorContext,
    subscribe: subscribeMonacoEditorContext,
  };
  window.dispatchEvent(new CustomEvent("echo-mirage-editor-context-ready"));
}