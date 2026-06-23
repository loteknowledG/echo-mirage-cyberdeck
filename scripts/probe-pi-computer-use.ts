import assert from "node:assert/strict";
import { detectComputerUseMission } from "../src/lib/muthur/control/computer-use-intent";
import {
  createPiControlLeaseRequest,
  grantPiControlLease,
  isPiControlLeaseActive,
  resetPiControlLeaseForTests,
  userRetakePiControl,
} from "../src/lib/muthur/control/pi-control-lease-store";
import {
  executePiComputerUseCommand,
  probePiComputerUse,
  resolvePiComputerUseAdapter,
} from "../src/lib/pi/pi-computer-use-manager";
import { getPiComputerUseStatus } from "../src/lib/pi/pi-computer-use-status";
import { formatPiPlatformLabel, resolvePiPlatform } from "../src/lib/pi/pi-platform-resolver";
import { resolvePiComputerUseBackendAsync } from "../src/lib/pi/pi-platform-resolver.server";
import {
  releaseSynapseOperatorLease,
  syncSynapseLeaseWithPiGrant,
} from "../src/lib/pi/synapse/synapse-control-lease.server";

async function main() {
  resetPiControlLeaseForTests();

  const platform = resolvePiPlatform();
  const backend = await resolvePiComputerUseBackendAsync(platform);

  console.log(`[probe] platform=${platform} (${formatPiPlatformLabel(platform)})`);
  console.log(`[probe] backend=${backend}`);

  const adapter = await resolvePiComputerUseAdapter(platform);
  assert.equal(adapter.backendId, backend === "none" ? "none" : backend);

  const status = await getPiComputerUseStatus();
  assert.equal(status.actor, "pi");
  assert.equal(status.platform, platform);
  assert.equal(status.backend, backend);

  if (platform !== "windows") {
    console.log(`[probe] non-Windows platform — skipping live desktop actions`);
    console.log(`[probe] status=${status.status}`);
    console.log("probe-pi-computer-use: PASS");
    return;
  }

  assert.equal(status.status, "READY");
  assert.ok(status.capabilities.screenshot);
  assert.ok(status.capabilities.activeWindow);
  assert.ok(status.capabilities.mouse);
  assert.ok(status.capabilities.keyboard);
  assert.ok(status.capabilities.scroll);

  const denied = await executePiComputerUseCommand({ action: "screenshot" });
  assert.equal(denied.status, "blocked");
  console.log("[probe] execution denied without lease");

  const mission = detectComputerUseMission("probe pi computer use readiness");
  createPiControlLeaseRequest(mission!);
  const granted = grantPiControlLease(60_000);
  assert.equal(granted.granted, true);
  assert.ok(isPiControlLeaseActive());
  if (backend === "synapse") {
    await syncSynapseLeaseWithPiGrant(60_000);
  }

  const screenshot = await executePiComputerUseCommand({ action: "screenshot" });
  assert.equal(screenshot.capability, "screenshot");
  assert.equal(screenshot.status, "success");
  assert.ok(screenshot.data?.base64);
  assert.ok((screenshot.data?.width as number | undefined ?? 0) > 0);
  assert.ok((screenshot.data?.height as number | undefined ?? 0) > 0);
  console.log(
    `[probe] screenshot ok ${screenshot.data?.width}x${screenshot.data?.height} (${screenshot.durationMs}ms)`,
  );

  const activeWindow = await executePiComputerUseCommand({ action: "active_window" });
  assert.equal(activeWindow.capability, "active_window");
  assert.equal(activeWindow.status, "success");
  console.log(`[probe] active window ok — ${activeWindow.summary}`);

  const probe = await probePiComputerUse();
  assert.equal(probe.platform, "windows");
  assert.ok(probe.backend === "synapse" || probe.backend === "windows-use");
  assert.equal(probe.screenshotOk, true);
  assert.equal(probe.activeWindowOk, true);
  assert.equal(probe.mouseMoveSkipped, true);
  console.log(`[probe] ${probe.message}`);

  userRetakePiControl("probe_cleanup");
  if (backend === "synapse") {
    await releaseSynapseOperatorLease();
  }
  assert.equal(isPiControlLeaseActive(), false);

  console.log("probe-pi-computer-use: PASS");
}

main().catch((error) => {
  console.error("probe-pi-computer-use: FAIL", error);
  process.exitCode = 1;
});
