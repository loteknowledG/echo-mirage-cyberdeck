"use client";

import { toast } from "sonner";
import { getMonacoEditorContext } from "@/lib/monaco-editor-context";
import type { OperatorEditorEdit, OperatorWorkbenchController } from "@/lib/operator-workbench";
import { applyOperatorEditToText } from "@/lib/operator-workbench";

export const OPERATOR_APPLY_DOCUMENT_TEXT_EVENT = "echo-mirage-operator-apply-document-text";

export function parseOperatorEditsHeader(headerValue: string | null): OperatorEditorEdit[] {
  if (!headerValue?.trim()) return [];
  try {
    const parsed = JSON.parse(headerValue) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is OperatorEditorEdit =>
        Boolean(item) &&
        typeof item === "object" &&
        typeof (item as OperatorEditorEdit).kind === "string" &&
        typeof (item as OperatorEditorEdit).text === "string",
    );
  } catch {
    return [];
  }
}

export type ApplyMuthurEditsResult = false | "applied";

function requestOperatorEditMode(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("echo-mirage-operator-request-edit-mode"));
}

function readOperatorDocumentText(): string {
  if (typeof window === "undefined") return "";
  const fromHook = window.echoMirageOperatorDocumentText?.();
  if (typeof fromHook === "string") return fromHook;
  const ctx = getMonacoEditorContext();
  if (ctx.contentLength > 0) return ctx.content;
  return "";
}

function waitForOperatorWorkbench(timeoutMs: number): Promise<OperatorWorkbenchController | undefined> {
  if (typeof window === "undefined") return Promise.resolve(undefined);
  if (window.echoMirageOperatorWorkbench) {
    return Promise.resolve(window.echoMirageOperatorWorkbench);
  }

  return new Promise((resolve) => {
    const deadline = Date.now() + timeoutMs;
    let timer = 0;

    const finish = (workbench: OperatorWorkbenchController | undefined) => {
      window.clearInterval(timer);
      window.removeEventListener("echo-mirage-operator-workbench-ready", onReady);
      resolve(workbench);
    };

    const onReady = () => {
      if (window.echoMirageOperatorWorkbench) {
        finish(window.echoMirageOperatorWorkbench);
      }
    };

    const poll = () => {
      if (window.echoMirageOperatorWorkbench) {
        finish(window.echoMirageOperatorWorkbench);
        return;
      }
      if (Date.now() >= deadline) {
        finish(undefined);
      }
    };

    window.addEventListener("echo-mirage-operator-workbench-ready", onReady);
    timer = window.setInterval(poll, 50);
    poll();
  });
}

function waitForEditSurface(timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    const start = Date.now();
    const tick = () => {
      if (Date.now() - start >= timeoutMs) {
        resolve();
        return;
      }
      requestAnimationFrame(tick);
    };
    requestOperatorEditMode();
    requestAnimationFrame(tick);
  });
}

/** Wait until operator document text is available (e.g. after DOCX → markdown open). */
export async function waitForOperatorDocumentReady(
  timeoutMs = 3000,
  minLength = 1,
): Promise<string> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const text = readOperatorDocumentText();
    if (text.length >= minLength) return text;
    await new Promise((resolve) => window.setTimeout(resolve, 50));
  }
  return readOperatorDocumentText();
}

function buildSelectionContext() {
  const ctx = getMonacoEditorContext();
  return {
    cursorLine: ctx.cursorLine ?? 1,
    cursorColumn: ctx.cursorColumn ?? 1,
    selectionStartLine: ctx.selectionStartLine ?? ctx.cursorLine ?? 1,
    selectionStartColumn: ctx.selectionStartColumn ?? ctx.cursorColumn ?? 1,
    selectionEndLine: ctx.selectionEndLine ?? ctx.cursorLine ?? 1,
    selectionEndColumn: ctx.selectionEndColumn ?? ctx.cursorColumn ?? 1,
  };
}

function applyEditsToDocumentText(
  edits: OperatorEditorEdit[],
  baseText: string,
): string {
  let text = baseText;
  const selection = buildSelectionContext();
  for (const edit of edits) {
    if (edit.kind === "replace_content") {
      text = edit.text;
      continue;
    }
    text = applyOperatorEditToText(text, edit, selection);
  }
  return text;
}

function syncOperatorDocumentText(text: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(OPERATOR_APPLY_DOCUMENT_TEXT_EVENT, {
      detail: { text },
    }),
  );
}

/** Apply MUTHUR edits in the operator pane and sync Monaco from canonical document text. */
export async function applyMuthurOperatorEdits(
  edits: OperatorEditorEdit[],
): Promise<ApplyMuthurEditsResult> {
  if (edits.length === 0) return false;

  requestOperatorEditMode();
  await waitForEditSurface(160);

  const current = await waitForOperatorDocumentReady(3000, 0);
  const hasReplaceContent = edits.some((edit) => edit.kind === "replace_content");
  if (!current && !hasReplaceContent) {
    toast.error("Open a markdown or code file in the operator pane first.");
    return false;
  }

  const proposed = applyEditsToDocumentText(edits, current);
  if (proposed === current) {
    toast.error("MUTHUR edit did not change the open document.");
    return false;
  }

  syncOperatorDocumentText(proposed);
  await waitForEditSurface(200);

  const workbench = await waitForOperatorWorkbench(2500);
  if (workbench?.forceDocumentText?.(proposed) || workbench?.setDocumentText?.(proposed)) {
    toast.message("MUTHUR edit applied — Ctrl+Z to undo.", { duration: 4000 });
    return "applied";
  }

  toast.message("MUTHUR edit applied — Ctrl+Z to undo.", { duration: 4000 });
  return "applied";
}
