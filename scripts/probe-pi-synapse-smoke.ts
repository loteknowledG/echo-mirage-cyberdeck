import {
  createPiControlLeaseRequest,
  grantPiControlLease,
  resetPiControlLeaseForTests,
  userRetakePiControl,
} from "../src/lib/muthur/control/pi-control-lease-store";
import { detectComputerUseMission } from "../src/lib/muthur/control/computer-use-intent";
import { executePiComputerUseCommand } from "../src/lib/pi/pi-computer-use-manager";
import { getPiComputerUseStatus } from "../src/lib/pi/pi-computer-use-status";
import {
  releaseSynapseOperatorLease,
  syncSynapseLeaseWithPiGrant,
} from "../src/lib/pi/synapse/synapse-control-lease.server";
import { probeSynapseDaemonHealth } from "../src/lib/pi/synapse/synapse-readiness.server";

async function main() {
  const health = await probeSynapseDaemonHealth();
  console.log("[smoke] synapse health", health);

  const status = await getPiComputerUseStatus();
  console.log("[smoke] pi status", status.backend, status.status);

  resetPiControlLeaseForTests();
  const mission = detectComputerUseMission("probe pi computer use readiness");
  if (!mission) throw new Error("mission detection failed");
  createPiControlLeaseRequest(mission!);
  grantPiControlLease(60_000);
  await syncSynapseLeaseWithPiGrant(60_000);

  const screenshot = await executePiComputerUseCommand({ action: "screenshot" });
  console.log("[smoke] screenshot", screenshot.status, screenshot.summary, screenshot.error);

  await releaseSynapseOperatorLease();
  userRetakePiControl("smoke_cleanup");
}

main().catch((error) => {
  console.error("probe-pi-synapse-smoke: FAIL", error);
  process.exitCode = 1;
});
