import assert from "node:assert/strict";
import {
  executePiComputerUseCommand,
  probePiComputerUse,
  resolvePiComputerUseAdapter,
} from "../src/lib/pi/pi-computer-use-manager";
import { getPiComputerUseStatus } from "../src/lib/pi/pi-computer-use-status";
import {
  formatPiPlatformLabel,
  resolvePiComputerUseBackend,
  resolvePiPlatform,
} from "../src/lib/pi/pi-platform-resolver";

async function main() {
  const platform = resolvePiPlatform();
  const backend = resolvePiComputerUseBackend(platform);

  console.log(`[probe] platform=${platform} (${formatPiPlatformLabel(platform)})`);
  console.log(`[probe] backend=${backend}`);

  const adapter = await resolvePiComputerUseAdapter(platform);
  assert.equal(adapter.backendId, backend === "none" ? "none" : backend);

  const status = getPiComputerUseStatus();
  assert.equal(status.actor, "pi");
  assert.equal(status.platform, platform);
  assert.equal(status.backend, backend);

  if (platform !== "windows") {
    console.log(`[probe] non-Windows platform — skipping live desktop actions`);
    console.log(`[probe] computerUse=${status.computerUse}`);
    console.log("probe-pi-computer-use: PASS");
    return;
  }

  assert.equal(status.computerUse, "READY");
  assert.ok(status.capabilities.screenshot);
  assert.ok(status.capabilities.mouse);
  assert.ok(status.capabilities.keyboard);
  assert.ok(status.capabilities.scroll);

  const screenshot = await executePiComputerUseCommand({ action: "screenshot" });
  assert.equal(screenshot.action, "pi.screenshot");
  assert.equal(screenshot.status, "success");
  assert.ok(screenshot.data?.base64);
  assert.ok((screenshot.data?.width ?? 0) > 0);
  assert.ok((screenshot.data?.height ?? 0) > 0);
  console.log(
    `[probe] screenshot ok ${screenshot.data?.width}x${screenshot.data?.height} (${screenshot.durationMs}ms)`,
  );

  const probe = await probePiComputerUse();
  assert.equal(probe.platform, "windows");
  assert.equal(probe.backend, "windows-use");
  assert.equal(probe.screenshotOk, true);
  assert.equal(probe.mouseMoveOk, true);
  console.log(`[probe] ${probe.message}`);

  console.log("probe-pi-computer-use: PASS");
}

main().catch((error) => {
  console.error("probe-pi-computer-use: FAIL", error);
  process.exitCode = 1;
});
