import { CAPABILITY_REGISTRY } from "./capability-registry";
import { getCurrentOwner, getCurrentLease, getMUTHURMode, getEventLog } from "./control-lease";
import { requiresConfirmation } from "./capability-registry";
import { getActiveMarkerCount } from "./indicate-layer";
import type { ActionName } from "./computer-use-types";

export interface ComputerUseStatus {
  owner: string;
  scope: string;
  mode: string;
  isUserInControl: boolean;
  isRevocable: boolean;
  leaseGrantedAt: string;
  leaseExpiresAt: string | null;
  capabilities: {
    supported: string[];
    unsupported: string[];
    requiresConfirmation: string[];
  };
  pointerLayer: {
    available: boolean;
    activeMarkers: number;
  };
  electronBridge: {
    available: boolean;
  };
  recentEvents: {
    event: string;
    timestamp: string;
    reason?: string;
  }[];
}

export function getComputerUseStatus(): ComputerUseStatus {
  const lease = getCurrentLease();
  const owner = getCurrentOwner();
  const mode = getMUTHURMode();

  const supported: string[] = [];
  const unsupported: string[] = [];
  const confirmationRequired: string[] = [];

  for (const [name, meta] of Object.entries(CAPABILITY_REGISTRY)) {
    if (name === "unknown") continue;
    if (meta.environments === "none") {
      unsupported.push(name);
    } else {
      supported.push(name);
    }
    if (requiresConfirmation(name as ActionName)) {
      confirmationRequired.push(name);
    }
  }

  const recentEvents = getEventLog().slice(-10).map((e) => ({
    event: e.event,
    timestamp: e.timestamp,
    reason: e.reason,
  }));

  return {
    owner,
    scope: lease.scope,
    mode,
    isUserInControl: owner === "USER",
    isRevocable: lease.revocable,
    leaseGrantedAt: lease.grantedAt,
    leaseExpiresAt: lease.expiresAt,
    capabilities: {
      supported,
      unsupported,
      requiresConfirmation: confirmationRequired,
    },
    pointerLayer: {
      available: true,
      activeMarkers: getActiveMarkerCount(),
    },
    electronBridge: {
      available: false,
    },
    recentEvents,
  };
}

export function getCapabilities(): {
  supported: string[];
  unsupported: string[];
  byCategory: Record<string, string[]>;
} {
  const supported: string[] = [];
  const unsupported: string[] = [];
  const byCategory: Record<string, string[]> = {};

  for (const [name, meta] of Object.entries(CAPABILITY_REGISTRY)) {
    if (name === "unknown") continue;
    if (!byCategory[meta.category]) {
      byCategory[meta.category] = [];
    }
    byCategory[meta.category].push(name);
    if (meta.environments === "none") {
      unsupported.push(name);
    } else {
      supported.push(name);
    }
  }

  return { supported, unsupported, byCategory };
}

export function getSupportedActions(): string[] {
  const { supported } = getCapabilities();
  return supported;
}

export function getUnsupportedActions(): string[] {
  const { unsupported } = getCapabilities();
  return unsupported;
}

export function getOwnershipState(): {
  owner: string;
  scope: string;
  isUserInControl: boolean;
  isRevocable: boolean;
  grantedAt: string;
  expiresAt: string | null;
  reason: string;
} {
  const lease = getCurrentLease();
  const owner = getCurrentOwner();
  return {
    owner,
    scope: lease.scope,
    isUserInControl: owner === "USER",
    isRevocable: lease.revocable,
    grantedAt: lease.grantedAt,
    expiresAt: lease.expiresAt,
    reason: lease.reason,
  };
}

export function getCurrentMode(): string {
  return getMUTHURMode();
}

export function getConfirmationRequirements(): {
  actions: string[];
  total: number;
} {
  const actions: string[] = [];
  for (const [name] of Object.entries(CAPABILITY_REGISTRY)) {
    if (name === "unknown") continue;
    if (requiresConfirmation(name as ActionName)) {
      actions.push(name);
    }
  }
  return { actions, total: actions.length };
}

export function formatStatusText(): string {
  const status = getComputerUseStatus();
  const confirmReq = getConfirmationRequirements();

  const lines: string[] = [
    "Current computer-use status:",
    `- owner: ${status.owner}`,
    `- mode: ${status.mode}`,
    `- scope: ${status.scope}`,
    `- user in control: ${status.isUserInControl}`,
    `- lease revocable: ${status.isRevocable}`,
    "",
    "Supported actions:",
    ...status.capabilities.supported.map((a) => `  - ${a}`),
    "",
    "Unsupported actions:",
    ...status.capabilities.unsupported.map((a) => `  - ${a}`),
    "",
    "Confirmation required:",
    ...confirmReq.actions.map((a) => `  - ${a}`),
    "",
    "Pointer layer: available",
    `Active markers: ${status.pointerLayer.activeMarkers}`,
    "",
    "Electron bridge: unavailable",
  ];

  return lines.join("\n");
}
