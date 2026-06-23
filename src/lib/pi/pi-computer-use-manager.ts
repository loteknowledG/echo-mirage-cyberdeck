import { assertPiControlLeaseForExecution } from "@/lib/muthur/control/pi-control-lease-gate";
import type {
  ComputerUseAdapter,
  PiComputerUseCommand,
  PiComputerUseProbeResult,
  PiComputerUseReceipt,
  PiPlatform,
} from "./pi-computer-use-types";
import {
  resolvePiComputerUseBackendAsync,
  resolvePiPlatform,
} from "./pi-platform-resolver";

export { getPiComputerUseStatus } from "./pi-computer-use-status";

let cachedAdapter: ComputerUseAdapter | null = null;
let cachedAdapterKey: string | null = null;

export type PiComputerUseExecutionOptions = {
  probeBypass?: boolean;
};

export function clearPiComputerUseAdapterCacheForTests(): void {
  cachedAdapter = null;
  cachedAdapterKey = null;
}

async function loadAdapterForPlatform(platform: PiPlatform): Promise<ComputerUseAdapter> {
  const backend = await resolvePiComputerUseBackendAsync(platform);
  const cacheKey = `${platform}:${backend}`;
  if (cachedAdapter && cachedAdapterKey === cacheKey) {
    return cachedAdapter;
  }

  let adapter: ComputerUseAdapter;
  switch (backend) {
    case "synapse": {
      const { createSynapseAdapter } = await import("./synapse/synapse-adapter");
      adapter = createSynapseAdapter();
      break;
    }
    case "windows-use": {
      const { createWindowsUseAdapter } = await import("./windows/windows-use-adapter");
      adapter = createWindowsUseAdapter();
      break;
    }
    case "pi-computer-use": {
      const { createPiComputerUseMacAdapter } = await import("./macos/pi-computer-use-adapter");
      adapter = createPiComputerUseMacAdapter();
      break;
    }
    default: {
      const { createPiComputerUseMacAdapter } = await import("./macos/pi-computer-use-adapter");
      const unavailable = createPiComputerUseMacAdapter();
      adapter = {
        backendId: "none",
        platform,
        getStatus: () => ({
          actor: "pi",
          platform,
          hostPlatform: platform,
          backend: "none",
          status: "UNAVAILABLE",
          computerUse: "UNAVAILABLE",
          capabilities: {
            screenshot: false,
            activeWindow: false,
            mouse: false,
            keyboard: false,
            scroll: false,
          },
        }),
        screenshot: unavailable.screenshot.bind(unavailable),
        activeWindow: unavailable.activeWindow.bind(unavailable),
        click: unavailable.click.bind(unavailable),
        doubleClick: unavailable.doubleClick.bind(unavailable),
        type: unavailable.type.bind(unavailable),
        hotkey: unavailable.hotkey.bind(unavailable),
        moveMouse: unavailable.moveMouse.bind(unavailable),
        scroll: unavailable.scroll.bind(unavailable),
        probe: async (): Promise<PiComputerUseProbeResult> => ({
          platform,
          backend: "none",
          screenshotOk: false,
          activeWindowOk: false,
          mouseMoveOk: false,
          mouseMoveSkipped: true,
          windowsUseImportOk: false,
          message: `Computer use unavailable on ${platform}`,
        }),
      };
      break;
    }
  }

  cachedAdapter = adapter;
  cachedAdapterKey = cacheKey;
  return adapter;
}

export async function resolvePiComputerUseAdapter(
  platform: PiPlatform = resolvePiPlatform(),
): Promise<ComputerUseAdapter> {
  return loadAdapterForPlatform(platform);
}

async function getPiComputerUseAdapter(): Promise<ComputerUseAdapter> {
  return loadAdapterForPlatform(resolvePiPlatform());
}

async function executePiComputerUseCommandInternal(
  command: PiComputerUseCommand,
): Promise<PiComputerUseReceipt> {
  const adapter = await getPiComputerUseAdapter();

  switch (command.action) {
    case "screenshot":
      return adapter.screenshot();
    case "active_window":
      return adapter.activeWindow();
    case "click":
      return adapter.click({
        x: command.x ?? 0,
        y: command.y ?? 0,
        button: command.button,
      });
    case "double_click":
      return adapter.doubleClick({
        x: command.x ?? 0,
        y: command.y ?? 0,
        button: command.button,
      });
    case "type":
      return adapter.type({
        text: command.text ?? "",
        x: command.x,
        y: command.y,
      });
    case "hotkey":
      return adapter.hotkey({ keys: command.keys ?? [] });
    case "move":
      return adapter.moveMouse({ x: command.x ?? 0, y: command.y ?? 0 });
    case "scroll":
      return adapter.scroll({
        direction: command.direction ?? "down",
        amount: command.amount,
      });
    default: {
      const exhaustive: never = command.action;
      throw new Error(`Unsupported PI computer use action: ${String(exhaustive)}`);
    }
  }
}

/**
 * Lease-guarded Pi execution boundary. No desktop action runs without an active
 * Pi control lease unless an explicit non-production probe bypass is enabled.
 */
export async function executePiComputerUseCommand(
  command: PiComputerUseCommand,
  options?: PiComputerUseExecutionOptions,
): Promise<PiComputerUseReceipt> {
  const gate = assertPiControlLeaseForExecution(command, options);
  if (!gate.allowed) {
    return gate.denialReceipt!;
  }
  return executePiComputerUseCommandInternal(command);
}

/** Readiness probe — does not perform input actions; lease bypass allowed for diagnostics only. */
export async function probePiComputerUse(
  options?: PiComputerUseExecutionOptions,
): Promise<PiComputerUseProbeResult> {
  const platform = resolvePiPlatform();
  const backend = await resolvePiComputerUseBackendAsync(platform);
  const gate = assertPiControlLeaseForExecution({ action: "screenshot" }, options);
  if (!gate.allowed) {
    return {
      platform,
      backend,
      screenshotOk: false,
      activeWindowOk: false,
      mouseMoveOk: false,
      mouseMoveSkipped: true,
      windowsUseImportOk: false,
      message: gate.reason ?? "Pi probe blocked — no active control lease",
      receipt: gate.denialReceipt,
    };
  }

  const adapter = await getPiComputerUseAdapter();
  return adapter.probe();
}
