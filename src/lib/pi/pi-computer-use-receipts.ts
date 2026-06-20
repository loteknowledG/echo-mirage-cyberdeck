import { nanoid } from "nanoid";
import type {
  ActionReceipt,
  PiReceiptAction,
  PiReceiptStatus,
  ScreenshotReceipt,
} from "./pi-computer-use-types";

export function createPiReceiptId(): string {
  return `pi-rcpt-${nanoid(12)}`;
}

export function createScreenshotReceipt(input: {
  status: PiReceiptStatus;
  durationMs: number;
  error?: string;
  data?: ScreenshotReceipt["data"];
}): ScreenshotReceipt {
  return {
    receiptId: createPiReceiptId(),
    actor: "pi",
    action: "pi.screenshot",
    status: input.status,
    timestamp: new Date().toISOString(),
    durationMs: input.durationMs,
    error: input.error,
    data: input.data,
  };
}

export function createActionReceipt(input: {
  action: Exclude<PiReceiptAction, "pi.screenshot">;
  status: PiReceiptStatus;
  durationMs: number;
  error?: string;
  data?: Record<string, unknown>;
}): ActionReceipt {
  return {
    receiptId: createPiReceiptId(),
    actor: "pi",
    action: input.action,
    status: input.status,
    timestamp: new Date().toISOString(),
    durationMs: input.durationMs,
    error: input.error,
    data: input.data,
  };
}
