import { nanoid } from "nanoid";
import type {
  PiComputerUseCapabilityName,
  PiComputerUseReceipt,
  PiComputerUseReceiptStatus,
} from "./pi-computer-use-types";

export function createPiReceiptId(): string {
  return `pi-rcpt-${nanoid(12)}`;
}

export function createPiComputerUseReceipt(input: {
  backend: PiComputerUseReceipt["backend"];
  capability: PiComputerUseCapabilityName;
  status: PiComputerUseReceiptStatus;
  summary: string;
  durationMs?: number;
  error?: string;
  data?: Record<string, unknown>;
}): PiComputerUseReceipt {
  return {
    id: createPiReceiptId(),
    actor: "pi",
    backend: input.backend,
    capability: input.capability,
    status: input.status,
    createdAt: new Date().toISOString(),
    durationMs: input.durationMs,
    summary: input.summary,
    error: input.error,
    data: input.data,
  };
}

/** @deprecated Use createPiComputerUseReceipt */
export function createScreenshotReceipt(input: {
  status: "success" | "error" | "unavailable";
  durationMs: number;
  error?: string;
  data?: Record<string, unknown>;
}): PiComputerUseReceipt {
  return createPiComputerUseReceipt({
    backend: "windows-use",
    capability: "screenshot",
    status: input.status === "success" ? "success" : "failed",
    summary:
      input.status === "success"
        ? "Screenshot captured"
        : input.error ?? "Screenshot failed",
    durationMs: input.durationMs,
    error: input.error,
    data: input.data,
  });
}

/** @deprecated Use createPiComputerUseReceipt */
export function createActionReceipt(input: {
  action: string;
  status: "success" | "error" | "unavailable";
  durationMs: number;
  error?: string;
  data?: Record<string, unknown>;
}): PiComputerUseReceipt {
  const capabilityMap: Record<string, PiComputerUseCapabilityName> = {
    "pi.click": "mouse_click",
    "pi.double_click": "double_click",
    "pi.type": "type_text",
    "pi.hotkey": "hotkey",
    "pi.scroll": "scroll",
    "pi.move": "mouse_move",
    "pi.active_window": "active_window",
  };
  return createPiComputerUseReceipt({
    backend: "windows-use",
    capability: capabilityMap[input.action] ?? "mouse_move",
    status: input.status === "success" ? "success" : "failed",
    summary: input.error ?? `${input.action} ${input.status}`,
    durationMs: input.durationMs,
    error: input.error,
    data: input.data,
  });
}
