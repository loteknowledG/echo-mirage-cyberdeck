"use client";

export const WORKSPACE_STATE_STORAGE_KEY = "echo-mirage-workspace-v1";

export type WorkspaceState = {
  activeModuleId: string | null;
  customTabs: unknown[];
  activeCustomTabId: string | null;
};

export function loadWorkspaceState(): WorkspaceState | null {
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(WORKSPACE_STATE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<WorkspaceState> | null;
    if (!parsed || typeof parsed !== "object") return null;
    return {
      activeModuleId: typeof parsed.activeModuleId === "string" ? parsed.activeModuleId : null,
      customTabs: Array.isArray(parsed.customTabs) ? parsed.customTabs : [],
      activeCustomTabId: typeof parsed.activeCustomTabId === "string" ? parsed.activeCustomTabId : null,
    };
  } catch {
    return null;
  }
}

export function saveWorkspaceState(state: WorkspaceState): void {
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(WORKSPACE_STATE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}
