import type { PiComputerUseCommand } from "@/lib/pi/pi-computer-use-types";
import { createPiComputerUseReceipt } from "@/lib/pi/pi-computer-use-receipts";
import { createPiAuthorityReceipt } from "@/lib/muthur/control/pi-control-lease-receipts";
import {
  getPiControlLeaseSnapshot,
  isPiControlLeaseActive,
  pushPiAuthorityReceipt,
} from "@/lib/muthur/control/pi-control-lease-store";
import type { PiAuthorityReceipt } from "@/lib/muthur/control/pi-control-lease-types";
import type { PiComputerUseReceipt } from "@/lib/pi/pi-computer-use-types";
import { resolvePiPlatform } from "@/lib/pi/pi-platform-resolver";
import { resolvePiComputerUseBackend } from "@/lib/pi/pi-platform-resolver.server";
import { isPiProbeLeaseBypassEnabled } from "@/lib/muthur/control/pi-control-lease-probe";
import { isPiControlLeaseGatingEnabled } from "@/lib/muthur/control/pi-control-lease-gating";

export type PiExecutionGateOptions = {
  /** Test/probe scripts only — never enabled in production. */
  probeBypass?: boolean;
};

export type PiExecutionGateResult = {
  allowed: boolean;
  denialReceipt?: PiComputerUseReceipt;
  authorityReceipt?: PiAuthorityReceipt;
  reason?: string;
};

function commandToCapability(action: PiComputerUseCommand["action"]) {
  switch (action) {
    case "screenshot":
      return "screenshot" as const;
    case "active_window":
      return "active_window" as const;
    case "click":
      return "mouse_click" as const;
    case "double_click":
      return "double_click" as const;
    case "type":
      return "type_text" as const;
    case "hotkey":
      return "hotkey" as const;
    case "move":
      return "mouse_move" as const;
    case "scroll":
      return "scroll" as const;
    default: {
      const exhaustive: never = action;
      return exhaustive;
    }
  }
}

export function assertPiControlLeaseForExecution(
  command: PiComputerUseCommand,
  options?: PiExecutionGateOptions,
): PiExecutionGateResult {
  if (!isPiControlLeaseGatingEnabled()) {
    return { allowed: true };
  }

  if (options?.probeBypass && isPiProbeLeaseBypassEnabled()) {
    return { allowed: true };
  }

  if (isPiControlLeaseActive()) {
    return { allowed: true };
  }

  const snapshot = getPiControlLeaseSnapshot();
  const leaseId = snapshot.activeLease?.leaseId ?? snapshot.pendingRequest?.leaseId;
  const reason = snapshot.pendingRequest
    ? "Pi control lease pending operator approval"
    : "Pi control lease inactive — operator grant required";

  const authorityReceipt = createPiAuthorityReceipt({
    kind: "authority.deny",
    source: "pi",
    target: "muthur",
    reason: `execution_denied:${reason}`,
    leaseId,
  });
  pushPiAuthorityReceipt(authorityReceipt);

  const denialReceipt = createPiComputerUseReceipt({
    backend: resolvePiComputerUseBackend(resolvePiPlatform()),
    capability: commandToCapability(command.action),
    status: "blocked",
    summary: "Pi computer-use execution denied — no active control lease",
    durationMs: 0,
    error: reason,
    data: {
      gate: "pi_control_lease",
      leaseId,
    },
  });

  return {
    allowed: false,
    denialReceipt,
    authorityReceipt,
    reason,
  };
}
