"use client";

export const MUTHUR_AUTO_APPROVE_EDITS_STORAGE_KEY = "echo-mirage-muthur-auto-approve-edits-v1";

export function loadMuthurAutoApproveEdits(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const stored = window.localStorage.getItem(MUTHUR_AUTO_APPROVE_EDITS_STORAGE_KEY);
    if (stored === null) return true;
    return stored === "1";
  } catch {
    return true;
  }
}

export function saveMuthurAutoApproveEdits(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MUTHUR_AUTO_APPROVE_EDITS_STORAGE_KEY, enabled ? "1" : "0");
  } catch {
    /* ignore */
  }
}
