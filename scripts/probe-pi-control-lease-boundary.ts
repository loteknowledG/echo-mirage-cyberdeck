import assert from "node:assert/strict";
import { detectComputerUseMission } from "../src/lib/muthur/control/computer-use-intent";
import {
  createPiControlLeaseRequest,
  getPiControlLeaseSnapshot,
  grantPiControlLease,
  isPiControlLeaseActive,
  markPiControlConflict,
  resetPiControlLeaseForTests,
  userRetakePiControl,
} from "../src/lib/muthur/control/pi-control-lease-store";
import { executePiComputerUseCommand } from "../src/lib/pi/pi-computer-use-manager";
import { getPiComputerUseStatus } from "../src/lib/pi/pi-computer-use-status";
import { resolvePiPlatform } from "../src/lib/pi/pi-platform-resolver";

async function main() {
  resetPiControlLeaseForTests();

  const platform = resolvePiPlatform();
  if (platform !== "windows") {
    console.log("probe:pi-control-lease-boundary: PASS (non-Windows skip)");
    return;
  }

  const status = getPiComputerUseStatus();
  if (status.status !== "READY") {
    console.log(`probe:pi-control-lease-boundary: SKIP (status=${status.status})`);
    return;
  }

  const mission = detectComputerUseMission("MUTHUR draw me a cat.");
  assert.ok(mission, "expected mission");

  const denied = await executePiComputerUseCommand({ action: "screenshot" });
  assert.equal(denied.status, "blocked");
  assert.match(denied.summary, /denied/i);
  assert.ok(getPiControlLeaseSnapshot().receipts.some((r) => r.kind === "authority.deny"));
  console.log("[boundary] denied without lease");

  createPiControlLeaseRequest(mission!);
  const granted = grantPiControlLease(60_000);
  assert.equal(granted.granted, true);
  assert.equal(isPiControlLeaseActive(), true);
  console.log("[boundary] lease granted");

  const screenshot = await executePiComputerUseCommand({ action: "screenshot" });
  assert.equal(screenshot.status, "success");
  console.log("[boundary] execute under lease ok");

  markPiControlConflict();
  assert.equal(getPiControlLeaseSnapshot().conflictDetected, true);
  console.log("[boundary] conflict marked");

  const retake = userRetakePiControl("user_retake");
  assert.equal(retake.success, true);
  assert.equal(isPiControlLeaseActive(), false);
  const returnReceipts = getPiControlLeaseSnapshot().receipts.filter(
    (r) => r.kind === "authority.return",
  );
  assert.equal(returnReceipts.length, 1, "expected single authority.return receipt on retake");
  console.log("[boundary] retake ok");

  const deniedAfterRetake = await executePiComputerUseCommand({ action: "active_window" });
  assert.equal(deniedAfterRetake.status, "blocked");
  console.log("[boundary] denied after retake");

  console.log("probe:pi-control-lease-boundary: PASS");
}

main().catch((error) => {
  console.error("probe:pi-control-lease-boundary: FAIL", error);
  process.exitCode = 1;
});
