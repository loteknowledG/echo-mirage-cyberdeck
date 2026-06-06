"use client";

import { toast } from "sonner";
import type { OperatorEditorEdit, OperatorWorkbenchController } from "@/lib/operator-workbench";

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

async function resolveOperatorWorkbench(): Promise<OperatorWorkbenchController | undefined> {
  if (window.echoMirageOperatorWorkbench) return window.echoMirageOperatorWorkbench;
  requestOperatorEditMode();
  return waitForOperatorWorkbench(2000);
}

/** Apply the latest MUTHUR edit directly in the active Monaco operator workbench. */
export async function applyMuthurOperatorEdits(
  edits: OperatorEditorEdit[],
): Promise<ApplyMuthurEditsResult> {
  if (edits.length === 0) return false;

  const workbench = await resolveOperatorWorkbench();
  if (!workbench) {
    toast.error("Open a markdown or code file in the operator pane first.");
    return false;
  }

  const edit = edits[edits.length - 1];
  try {
    const applied = workbench.applyEdit(edit);
    if (applied) {
      toast.message("MUTHUR edit applied — Ctrl+Z to undo.", { duration: 4000 });
      return "applied";
    }
    toast.error("Could not apply MUTHUR edit in the operator editor.");
    return false;
  } catch {
    toast.error("Could not apply MUTHUR edit in the operator editor.");
    return false;
  }
}
