import type { CustomTab, ServerId } from "@/features/cyberdeck/workspace/custom-tab-model";

export const UI_STATE_STORAGE_KEY = "echo-mirage-ui-state-v1";

export type CyberdeckUiState = {
  server: ServerId;
  navRailContext: "gateway" | "tabs";
  serverKeyboardHighlightId: ServerId | null;
  operatorSurfaceMode?: "workspace" | "browser";
  operatorBrowserUrl?: string;
  customTabs?: CustomTab[];
  activeCustomTabId?: string | null;
};
