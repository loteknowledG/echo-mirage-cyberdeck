import { CAPABILITY_REGISTRY } from "./capability-registry";
import { getCurrentOwner, getCurrentLease, getMUTHURMode, getEventLog } from "./control-lease";
import { requiresConfirmation } from "./capability-registry";
import { getMarkers } from "./indicate-layer";
import { getWorkflowState, getCurrentStep, getNextStep } from "./guided-workflow";
import { getPresenceState } from "./cursor-presence";
import type { ActionName } from "./computer-use-types";

export interface MarkerInfo {
  id: string;
  style: string;
  position: { x: number; y: number };
  label: string | null;
  width: number;
  height: number;
  bounds: { left: number; top: number; right: number; bottom: number } | null;
  hasRegion: boolean;
}

export function getActiveGuidedMarker(): MarkerInfo | null {
  const markers = getMarkers();
  if (markers.length === 0) return null;
  const m = markers[markers.length - 1];
  const hasRegion = (m.width ?? 0) > 0 && (m.height ?? 0) > 0;
  return {
    id: m.id,
    style: m.style ?? "ring",
    position: { x: m.position.x, y: m.position.y },
    label: m.label ?? null,
    width: m.width ?? 0,
    height: m.height ?? 0,
    bounds: hasRegion
      ? {
          left: m.position.x - (m.width! / 2),
          top: m.position.y - (m.height! / 2),
          right: m.position.x + (m.width! / 2),
          bottom: m.position.y + (m.height! / 2),
        }
      : null,
    hasRegion,
  };
}

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
    markers: {
      id: string;
      style: string;
      position: { x: number; y: number };
      label: string | null;
      width: number;
      height: number;
    }[];
  };
  guidedWorkflow: {
    active: boolean;
    currentStep: string | null;
    nextStep: string | null;
    acknowledged: boolean;
    totalSteps: number;
    completedSteps: number;
  };
  guidedMarker: MarkerInfo | null;
  cursorPresence: {
    x: number;
    y: number;
    insideRegion: string | null;
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
    pointerLayer: (() => {
      const raw = getMarkers();
      return {
        available: true,
        activeMarkers: raw.length,
        markers: raw.map((m) => ({
          id: m.id,
          style: m.style ?? "ring",
          position: { x: m.position.x, y: m.position.y },
          label: m.label ?? null,
          width: m.width ?? 0,
          height: m.height ?? 0,
        })),
      };
    })(),
    guidedWorkflow: (() => {
      const wf = getWorkflowState();
      const current = getCurrentStep();
      const next = getNextStep();
      return {
        active: wf.active,
        currentStep: current?.label ?? null,
        nextStep: next?.label ?? null,
        acknowledged: wf.acknowledged,
        totalSteps: wf.steps.length,
        completedSteps: Math.max(0, wf.currentStepIndex),
      };
    })(),
    guidedMarker: (() => {
      const marker = getActiveGuidedMarker();
      return marker;
    })(),
    cursorPresence: (() => {
      const ps = getPresenceState();
      return { x: ps.x, y: ps.y, insideRegion: ps.insideRegion };
    })(),
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
    ...status.pointerLayer.markers.map((m) =>
      `  marker: id=${m.id} style=${m.style} pos=(${m.position.x}, ${m.position.y}) label=${m.label ?? "(none)"} bounds=${m.width}x${m.height}`,
    ),
    "",
    "Guided workflow:",
    `  active: ${status.guidedWorkflow.active}`,
    `  current step: ${status.guidedWorkflow.currentStep ?? "none"}`,
    `  next step: ${status.guidedWorkflow.nextStep ?? "none"}`,
    `  acknowledged: ${status.guidedWorkflow.acknowledged}`,
    "",
    status.guidedMarker
      ? (`Guided marker: id=${status.guidedMarker.id} label=${status.guidedMarker.label ?? "(none)"} bounds=${status.guidedMarker.width}x${status.guidedMarker.height} region=${status.guidedMarker.hasRegion}` as string)
      : "Guided marker: none",
    "",
    "Cursor presence:",
    `  position: (${status.cursorPresence.x}, ${status.cursorPresence.y})`,
    `  inside region: ${status.cursorPresence.insideRegion ?? "none"}`,
    "",
    "Electron bridge: unavailable",
  ];

  return lines.join("\n");
}
