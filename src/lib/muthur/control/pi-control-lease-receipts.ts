import { nanoid } from "nanoid";
import type { PiAuthorityReceipt } from "@/lib/muthur/control/pi-control-lease-types";

export function createPiAuthorityReceipt(input: {
  kind: PiAuthorityReceipt["kind"];
  source: PiAuthorityReceipt["source"];
  target: PiAuthorityReceipt["target"];
  reason: string;
  leaseId?: string;
}): PiAuthorityReceipt {
  return {
    receiptId: `auth-rcpt-${nanoid(10)}`,
    kind: input.kind,
    source: input.source,
    target: input.target,
    reason: input.reason,
    leaseId: input.leaseId,
    timestamp: new Date().toISOString(),
  };
}
