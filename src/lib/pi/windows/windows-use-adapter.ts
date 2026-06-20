import { createPiComputerUseReceipt } from "../pi-computer-use-receipts";
import type {
  ClickRequest,
  ComputerUseAdapter,
  HotkeyRequest,
  MoveRequest,
  PiComputerUseProbeResult,
  PiComputerUseReceipt,
  PiComputerUseStatus,
  ScrollRequest,
  TypeRequest,
} from "../pi-computer-use-types";
import { formatPiPlatformLabel, resolvePiPlatform } from "../pi-platform-resolver";
import {
  checkWindowsUseBackend,
  invokeWindowsUseBridge,
  isWindowsUseBridgeAvailable,
  PI_WINDOWS_USE_REMEDIATION,
} from "./windows-use-python-bridge.server";

const READY_CAPABILITIES = {
  screenshot: true,
  activeWindow: true,
  mouse: true,
  keyboard: true,
  scroll: true,
} as const;

const UNAVAILABLE_CAPABILITIES = {
  screenshot: false,
  activeWindow: false,
  mouse: false,
  keyboard: false,
  scroll: false,
} as const;

function buildReadinessStatus(): PiComputerUseStatus["status"] {
  if (process.platform !== "win32") {
    return "UNAVAILABLE";
  }
  if (!isWindowsUseBridgeAvailable()) {
    return "NOT_INSTALLED";
  }
  const check = checkWindowsUseBackend();
  if (check.ok) {
    return "READY";
  }
  return "FAILED";
}

function buildStatus(): PiComputerUseStatus {
  const platform = resolvePiPlatform();
  const readiness = buildReadinessStatus();
  const check =
    readiness === "READY" || readiness === "FAILED"
      ? checkWindowsUseBackend()
      : null;

  return {
    actor: "pi",
    platform,
    backend: "windows-use",
    status: readiness,
    computerUse: readiness,
    capabilities:
      readiness === "READY" ? { ...READY_CAPABILITIES } : { ...UNAVAILABLE_CAPABILITIES },
    remediation:
      readiness === "NOT_INSTALLED" || readiness === "FAILED"
        ? PI_WINDOWS_USE_REMEDIATION
        : undefined,
    lastError:
      readiness === "FAILED" ? check?.receipt.error ?? check?.spawnError : undefined,
  };
}

export class WindowsUseAdapter implements ComputerUseAdapter {
  readonly backendId = "windows-use" as const;
  readonly platform = resolvePiPlatform();

  getStatus(): PiComputerUseStatus {
    return buildStatus();
  }

  async screenshot(): Promise<PiComputerUseReceipt> {
    return invokeWindowsUseBridge({ capability: "screenshot" }).receipt;
  }

  async activeWindow(): Promise<PiComputerUseReceipt> {
    return invokeWindowsUseBridge({ capability: "active_window" }).receipt;
  }

  async click(input: ClickRequest): Promise<PiComputerUseReceipt> {
    return invokeWindowsUseBridge({
      capability: "mouse_click",
      params: { x: input.x, y: input.y, button: input.button ?? "left" },
    }).receipt;
  }

  async doubleClick(input: ClickRequest): Promise<PiComputerUseReceipt> {
    return invokeWindowsUseBridge({
      capability: "double_click",
      params: { x: input.x, y: input.y, button: input.button ?? "left" },
    }).receipt;
  }

  async type(input: TypeRequest): Promise<PiComputerUseReceipt> {
    const params: Record<string, unknown> = { text: input.text };
    if (input.x !== undefined && input.y !== undefined) {
      params.x = input.x;
      params.y = input.y;
    }
    return invokeWindowsUseBridge({ capability: "type_text", params }).receipt;
  }

  async hotkey(input: HotkeyRequest): Promise<PiComputerUseReceipt> {
    return invokeWindowsUseBridge({
      capability: "hotkey",
      params: { keys: input.keys },
    }).receipt;
  }

  async moveMouse(input: MoveRequest): Promise<PiComputerUseReceipt> {
    return invokeWindowsUseBridge({
      capability: "mouse_move",
      params: { x: input.x, y: input.y },
    }).receipt;
  }

  async scroll(input: ScrollRequest): Promise<PiComputerUseReceipt> {
    return invokeWindowsUseBridge({
      capability: "scroll",
      params: {
        direction: input.direction,
        amount: input.amount ?? 3,
      },
    }).receipt;
  }

  async probe(): Promise<PiComputerUseProbeResult> {
    const screenshot = await this.screenshot();
    const activeWindow = await this.activeWindow();

    return {
      platform: this.platform,
      backend: this.backendId,
      screenshotOk: screenshot.status === "success",
      activeWindowOk: activeWindow.status === "success",
      mouseMoveOk: false,
      mouseMoveSkipped: true,
      windowsUseImportOk: screenshot.status !== "blocked",
      message: `${formatPiPlatformLabel(this.platform)} / ${this.backendId} probe complete (mouse move skipped)`,
      receipt: screenshot,
    };
  }
}

export function createWindowsUseAdapter(): WindowsUseAdapter {
  return new WindowsUseAdapter();
}

export function createBlockedWindowsUseReceipt(
  capability: PiComputerUseReceipt["capability"],
  summary: string,
  error: string,
): PiComputerUseReceipt {
  return createPiComputerUseReceipt({
    backend: "windows-use",
    capability,
    status: "blocked",
    summary,
    error,
  });
}
