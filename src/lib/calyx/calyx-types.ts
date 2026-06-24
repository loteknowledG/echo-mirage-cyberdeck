export type CalyxRuntimeStatus = "READY" | "NOT_INSTALLED" | "FAILED" | "DISABLED";

export type CalyxStatus = {
  enabled: boolean;
  status: CalyxRuntimeStatus;
  vault: string;
  calyxHome: string;
  binaryPath: string;
  toolCount?: number;
  version?: string;
  remediation?: string;
  lastError?: string;
};
