import type { ActionName } from "./computer-use-types";
import type {
  EnhancedCapabilityMetadata,
  CapabilityCategory,
  ConfirmationPolicy,
  EnvironmentSupport,
  ReceiptType,
  VerificationType,
  ApprovalMode,
  ReceiptAuthority,
} from "./receipt-types";

export type {
  CapabilityCategory,
  ConfirmationPolicy,
  EnvironmentSupport,
  ReceiptType,
  VerificationType,
  ApprovalMode,
  ReceiptAuthority,
};

export type CapabilityRegistry = Record<ActionName, EnhancedCapabilityMetadata>;

export const CAPABILITY_REGISTRY: CapabilityRegistry = {
  get_active_window: {
    category: "observation",
    confirmationPolicy: "none",
    environments: "both",
    description: "Retrieve the currently focused window title and URL",
    owner: "muthur",
    receiptType: "tool.exec",
    verificationType: "logical",
    approvalMode: "auto",
  },
  list_open_windows: {
    category: "observation",
    confirmationPolicy: "none",
    environments: "electron",
    description: "Enumerate all open Electron windows",
    owner: "muthur",
    receiptType: "tool.exec",
    verificationType: "logical",
    approvalMode: "auto",
  },
  capture_screen: {
    category: "observation",
    confirmationPolicy: "none",
    environments: "none",
    description: "Capture a screenshot of the current screen (not implemented)",
    owner: "muthur",
    receiptType: "tool.exec",
    verificationType: "visual",
    approvalMode: "operator",
  },
  focus_window: {
    category: "input",
    confirmationPolicy: "operator",
    environments: "none",
    description: "Focus a window by title or app name (not implemented)",
    owner: "muthur",
    receiptType: "tool.exec",
    verificationType: "logical",
    approvalMode: "operator",
    paramSchema: {
      titleOrAppName: { required: true, type: "string" },
    },
  },
  paste_text: {
    category: "input",
    confirmationPolicy: "user",
    environments: "electron",
    description: "Write text to the system clipboard",
    owner: "muthur",
    receiptType: "tool.exec",
    verificationType: "input_output",
    approvalMode: "user",
    paramSchema: {
      text: { required: true, type: "string" },
    },
  },
  hotkey: {
    category: "input",
    confirmationPolicy: "user",
    environments: "electron",
    description: "Simulate a keyboard hotkey (limited allowlist)",
    owner: "muthur",
    receiptType: "tool.exec",
    verificationType: "input_output",
    approvalMode: "user",
    paramSchema: {
      keys: { required: true, type: "string" },
    },
  },
  verify_text_visible: {
    category: "observation",
    confirmationPolicy: "none",
    environments: "none",
    description: "Verify text is visible on screen via OCR (not implemented)",
    owner: "muthur",
    receiptType: "tool.exec",
    verificationType: "visual",
    approvalMode: "auto",
    paramSchema: {
      text: { required: true, type: "string" },
    },
  },
  verify_window_active: {
    category: "observation",
    confirmationPolicy: "none",
    environments: "none",
    description: "Verify a specific window is currently focused (not implemented)",
    owner: "muthur",
    receiptType: "tool.exec",
    verificationType: "logical",
    approvalMode: "auto",
    paramSchema: {
      titleOrAppName: { required: true, type: "string" },
    },
  },
  stop_execution: {
    category: "control",
    confirmationPolicy: "none",
    environments: "both",
    description: "Halt the current computer-use execution",
    owner: "user",
    receiptType: "tool.exec",
    verificationType: "none",
    approvalMode: "auto",
  },
  indicate_point: {
    category: "output",
    confirmationPolicy: "none",
    environments: "both",
    description: "Render a pointer ring at a screen position (MUTHUR pointer hand)",
    owner: "muthur",
    receiptType: "tool.exec",
    verificationType: "visual",
    approvalMode: "auto",
    paramSchema: {
      position: { required: true, type: "object" },
      label: { required: false, type: "string" },
      style: { required: false, type: "string" },
      color: { required: false, type: "string" },
      ttlMs: { required: false, type: "number" },
      width: { required: false, type: "number" },
      height: { required: false, type: "number" },
    },
  },
  indicate_highlight: {
    category: "output",
    confirmationPolicy: "none",
    environments: "both",
    description: "Render a highlight glow at a screen position (MUTHUR pointer hand)",
    owner: "muthur",
    receiptType: "tool.exec",
    verificationType: "visual",
    approvalMode: "auto",
    paramSchema: {
      position: { required: true, type: "object" },
      label: { required: false, type: "string" },
      style: { required: false, type: "string" },
      color: { required: false, type: "string" },
      ttlMs: { required: false, type: "number" },
      width: { required: false, type: "number" },
      height: { required: false, type: "number" },
    },
  },
  clear_indicators: {
    category: "output",
    confirmationPolicy: "none",
    environments: "both",
    description: "Remove all active MUTHUR pointer/highlight overlays",
    owner: "muthur",
    receiptType: "tool.exec",
    verificationType: "none",
    approvalMode: "auto",
  },
  unknown: {
    category: "control",
    confirmationPolicy: "none",
    environments: "none",
    description: "Unknown or unrecognized action",
    owner: "muthur",
    receiptType: "tool.exec",
    verificationType: "none",
    approvalMode: "auto",
  },
} as const;

export function getCapability(
  actionName: ActionName
): EnhancedCapabilityMetadata | undefined {
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

export function getActionScope(
  actionName: ActionName
): "observation" | "input" | "output" | "control" | "full" {
  const cap = CAPABILITY_REGISTRY[actionName];
  if (!cap) return "control";
  if (cap.category === "observation") return "observation";
  if (cap.category === "input") return "input";
  if (cap.category === "output") return "output";
  return "control";
}

export function getApprovalMode(actionName: ActionName): ApprovalMode {
  return CAPABILITY_REGISTRY[actionName]?.approvalMode ?? "auto";
}

export function getReceiptType(actionName: ActionName): ReceiptType {
  return CAPABILITY_REGISTRY[actionName]?.receiptType ?? "tool.exec";
}

export function getVerificationType(actionName: ActionName): VerificationType {
  return CAPABILITY_REGISTRY[actionName]?.verificationType ?? "none";
}

export function getCapabilityOwner(actionName: ActionName): ReceiptAuthority {
  return CAPABILITY_REGISTRY[actionName]?.owner ?? "muthur";
}

export function getActionsByApprovalMode(mode: ApprovalMode): ActionName[] {
  return Object.entries(CAPABILITY_REGISTRY)
    .filter(([, meta]) => meta.approvalMode === mode)
    .map(([name]) => name as ActionName);
}

export function getCapabilityManifest(): Array<{
  name: ActionName;
  category: CapabilityCategory;
  receiptType: ReceiptType;
  verificationType: VerificationType;
  approvalMode: ApprovalMode;
  owner: ReceiptAuthority;
  description: string;
}> {
  return Object.entries(CAPABILITY_REGISTRY)
    .filter(([name]) => name !== "unknown")
    .map(([name, meta]) => ({
      name: name as ActionName,
      category: meta.category,
      receiptType: meta.receiptType,
      verificationType: meta.verificationType,
      approvalMode: meta.approvalMode,
      owner: meta.owner,
      description: meta.description,
    }));
}
