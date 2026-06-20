import assert from "node:assert/strict";
import { detectComputerUseMission } from "../src/lib/muthur/control/computer-use-intent";
import {
  createPiControlLeaseRequest,
  denyPiControlLease,
  getPiControlLeaseSnapshot,
  grantPiControlLease,
  isPiControlLeaseActive,
  resetPiControlLeaseForTests,
  terminateActiveLease,
  userRetakePiControl,
} from "../src/lib/muthur/control/pi-control-lease-store";

function main() {
  resetPiControlLeaseForTests();

  const mission = detectComputerUseMission("MUTHUR draw me a cat.");
  assert.ok(mission, "expected computer-use mission");
  assert.equal(mission?.task, "Draw Cat");

  const pending = createPiControlLeaseRequest(mission!);
  assert.equal(pending.operator, "pi");
  assert.equal(getPiControlLeaseSnapshot().pendingRequest?.leaseId, pending.leaseId);

  const granted = grantPiControlLease(60_000);
  assert.equal(granted.granted, true);
  assert.ok(isPiControlLeaseActive());
  assert.equal(getPiControlLeaseSnapshot().activeLease?.task, mission?.task);

  const beforeRetakeCount = getPiControlLeaseSnapshot().receipts.filter(
    (r) => r.kind === "authority.return",
  ).length;
  const retake = userRetakePiControl("user_retake");
  assert.equal(retake.success, true);
  assert.equal(retake.receipt.kind, "authority.return");
  assert.equal(retake.receipt.source, "pi");
  assert.equal(retake.receipt.target, "user");
  assert.equal(isPiControlLeaseActive(), false);
  const afterRetakeCount = getPiControlLeaseSnapshot().receipts.filter(
    (r) => r.kind === "authority.return",
  ).length;
  assert.equal(afterRetakeCount, beforeRetakeCount + 1, "retake must emit one return receipt");

  const pending2 = createPiControlLeaseRequest(mission!);
  grantPiControlLease(1_000);
  const terminated = terminateActiveLease("mission_complete");
  assert.ok(terminated);
  assert.equal(terminated?.leaseStatus, "terminated");
  assert.equal(isPiControlLeaseActive(), false);

  denyPiControlLease("operator_denied");
  assert.equal(getPiControlLeaseSnapshot().pendingRequest, null);

  console.log("probe:muthur-control-lease PASS");
}

main();
