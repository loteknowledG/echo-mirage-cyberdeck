import type { ActionName } from "./computer-use-types";

export type ReceiptType =
  | "memory.write"
  | "tool.exec"
  | "capability.register"
  | "capability.revoke"
  | "verify.pass"
  | "verify.fail"
  | "authority.delegate"
  | "authority.return";

export type ReceiptStatus = "success" | "failed" | "blocked";

export type ApprovalMode = "auto" | "operator" | "user" | "muthur";

export type VerificationType = "none" | "content_hash" | "input_output" | "visual" | "logical";

export type ReceiptAuthority = "user" | "muthur" | "pi";

export interface ReceiptBase {
  receiptId: string;
  type: ReceiptType;
  authority: ReceiptAuthority;
  timestamp: string;
  status: ReceiptStatus;
  durationMs?: number;
  error?: string;
  contentHash?: string;
}

export interface ToolExecReceipt extends ReceiptBase {
  type: "tool.exec";
  capabilityId: ActionName;
  inputs: Record<string, unknown>;
  outputs?: unknown;
  delegatedFrom?: string;
}

export interface MemoryWriteReceipt extends ReceiptBase {
  type: "memory.write";
  namespace: string;
  key: string;
  valueHash: string;
  valueSize: number;
}

export interface CapabilityRegisterReceipt extends ReceiptBase {
  type: "capability.register";
  capabilityId: string;
  capabilityName: string;
  receiptType: ReceiptType;
  verificationType: VerificationType;
  approvalMode: ApprovalMode;
}

export interface CapabilityRevokeReceipt extends ReceiptBase {
  type: "capability.revoke";
  capabilityId: string;
  reason: string;
}

export interface VerifyReceipt extends ReceiptBase {
  type: "verify.pass" | "verify.fail";
  claimReceiptId: string;
  verificationType: VerificationType;
  matches: boolean;
  details?: string;
}

export interface AuthorityReceipt extends ReceiptBase {
  type: "authority.delegate" | "authority.return";
  from: ReceiptAuthority;
  to: ReceiptAuthority;
  capabilityId?: string;
  leaseId?: string;
  reason: string;
}

export type MuthurReceipt =
  | ToolExecReceipt
  | MemoryWriteReceipt
  | CapabilityRegisterReceipt
  | CapabilityRevokeReceipt
  | VerifyReceipt
  | AuthorityReceipt;

export interface EnhancedCapabilityMetadata {
  category: CapabilityCategory;
  confirmationPolicy: ConfirmationPolicy;
  environments: EnvironmentSupport;
  description: string;
  owner: ReceiptAuthority;
  receiptType: ReceiptType;
  verificationType: VerificationType;
  approvalMode: ApprovalMode;
  paramSchema?: Record<string, { required: boolean; type: string }>;
}

export type CapabilityCategory = "observation" | "input" | "output" | "control";
export type ConfirmationPolicy = "none" | "user" | "operator";
export type EnvironmentSupport = "browser" | "electron" | "both" | "none";

export interface ReceiptQuery {
  type?: ReceiptType;
  capabilityId?: string;
  authority?: ReceiptAuthority;
  status?: ReceiptStatus;
  sinceTimestamp?: string;
  limit?: number;
}
