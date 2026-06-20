export const PI_CONTROL_CAPABILITIES = [
  "mouse",
  "keyboard",
  "screen",
  "scroll",
] as const;

export type PiControlCapability = (typeof PI_CONTROL_CAPABILITIES)[number];

export type PiLeaseStatus = "pending" | "active" | "terminated" | "denied";

export type PiControlLeaseRequest = {
  leaseId: string;
  task: string;
  taskSlug: string;
  operator: "pi";
  capabilities: PiControlCapability[];
  reason: string;
  status: "pending";
  missionText: string;
  requestedAt: string;
};

export type PiControlLease = {
  leaseId: string;
  leaseOwner: "pi";
  leaseReason: string;
  leaseStatus: "active" | "terminated";
  leaseStartedAt: string;
  leaseDurationMs: number | null;
  leaseExpiresAt: string | null;
  task: string;
  capabilities: PiControlCapability[];
  missionText: string;
};

export type PiAuthorityReceipt = {
  receiptId: string;
  kind: "authority.return" | "authority.grant" | "authority.deny";
  source: "pi" | "muthur" | "user";
  target: "pi" | "muthur" | "user";
  reason: string;
  leaseId?: string;
  timestamp: string;
};

export type PiControlLeaseSnapshot = {
  pendingRequest: PiControlLeaseRequest | null;
  activeLease: PiControlLease | null;
  conflictDetected: boolean;
  receipts: PiAuthorityReceipt[];
};

export type ComputerUseMission = {
  task: string;
  taskSlug: string;
  reason: string;
  capabilities: PiControlCapability[];
  missionText: string;
};
