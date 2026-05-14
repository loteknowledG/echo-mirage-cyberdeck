import type { ActionName } from "./computer-use-types";

export type CapabilityCategory = "observation" | "input" | "output" | "control";
export type ConfirmationPolicy = "none" | "user" | "operator";
export type EnvironmentSupport = "browser" | "electron" | "both" | "none";

export interface CapabilityMetadata {
  category: CapabilityCategory;
  confirmationPolicy: ConfirmationPolicy;
  environments: EnvironmentSupport;
  description: string;
  paramSchema?: Record<string, { required: boolean; type: string }>;
}

export type CapabilityRegistry = Record<ActionName, CapabilityMetadata>;

export const CAPABILITY_REGISTRY: CapabilityRegistry = {
  get_active_window: {
    category: "observation",
    confirmationPolicy: "none",
    environments: "both",
    description: "Retrieve the currently focused window title and URL",
  },
  list_open_windows: {
    category: "observation",
    confirmationPolicy: "none",
    environments: "electron",
    description: "Enumerate all open Electron windows",
  },
  capture_screen: {
    category: "observation",
    confirmationPolicy: "none",
    environments: "none",
    description: "Capture a screenshot of the current screen (not implemented)",
  },
  focus_window: {
    category: "input",
    confirmationPolicy: "operator",
    environments: "none",
    description: "Focus a window by title or app name (not implemented)",
    paramSchema: {
      titleOrAppName: { required: true, type: "string" },
    },
  },
  paste_text: {
    category: "input",
    confirmationPolicy: "user",
    environments: "electron",
    description: "Write text to the system clipboard",
    paramSchema: {
      text: { required: true, type: "string" },
    },
  },
  hotkey: {
    category: "input",
    confirmationPolicy: "user",
    environments: "electron",
    description: "Simulate a keyboard hotkey (limited allowlist)",
    paramSchema: {
      keys: { required: true, type: "string" },
    },
  },
  verify_text_visible: {
    category: "observation",
    confirmationPolicy: "none",
    environments: "none",
    description: "Verify text is visible on screen via OCR (not implemented)",
    paramSchema: {
      text: { required: true, type: "string" },
    },
  },
  verify_window_active: {
    category: "observation",
    confirmationPolicy: "none",
    environments: "none",
    description: "Verify a specific window is currently focused (not implemented)",
    paramSchema: {
      titleOrAppName: { required: true, type: "string" },
    },
  },
  stop_execution: {
    category: "control",
    confirmationPolicy: "none",
    environments: "both",
    description: "Halt the current computer-use execution",
  },
  unknown: {
    category: "control",
    confirmationPolicy: "none",
    environments: "none",
    description: "Unknown or unrecognized action",
  },
} as const;

export function getCapability(
  actionName: ActionName
): CapabilityMetadata | undefined {
  return CAPABILITY_REGISTRY[actionName];
}

export function requiresConfirmation(actionName: ActionName): boolean {
  const cap = CAPABILITY_REGISTRY[actionName];
  return cap?.confirmationPolicy !== "none";
}

export function isAvailableInEnvironment(
  actionName: ActionName,
  environment: "browser" | "electron"
): boolean {
  const cap = CAPABILITY_REGISTRY[actionName];
  if (!cap) return false;
  if (cap.environments === "none") return false;
  if (cap.environments === "both") return true;
  return cap.environments === environment;
}

export function getActionsByCategory(
  category: CapabilityCategory
): ActionName[] {
  return Object.entries(CAPABILITY_REGISTRY)
    .filter(([, meta]) => meta.category === category)
    .map(([name]) => name as ActionName);
}

export function getConfirmationPolicy(
  actionName: ActionName
): ConfirmationPolicy {
  return CAPABILITY_REGISTRY[actionName]?.confirmationPolicy ?? "none";
}