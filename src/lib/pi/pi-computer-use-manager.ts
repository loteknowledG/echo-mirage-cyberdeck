import type {
  ComputerUseAdapter,
  PiComputerUseCommand,
  PiComputerUseProbeResult,
  PiComputerUseReceipt,
  PiPlatform,
} from "./pi-computer-use-types";
import { resolvePiComputerUseBackend, resolvePiPlatform } from "./pi-platform-resolver";
import { getPiComputerUseStatus } from "./pi-computer-use-status";

export { getPiComputerUseStatus } from "./pi-computer-use-status";

let cachedAdapter: ComputerUseAdapter | null = null;

async function loadAdapterForPlatform(platform: PiPlatform): Promise<ComputerUseAdapter> {
  const backend = resolvePiComputerUseBackend(platform);
  switch (backend) {
    case "windows-use": {
      const { createWindowsUseAdapter } = await import("./windows/windows-use-adapter");
      return createWindowsUseAdapter();
    }
    case "pi-computer-use": {
      const { createPiComputerUseMacAdapter } = await import("./macos/pi-computer-use-adapter");
      return createPiComputerUseMacAdapter();
    }
    default: {
      const { createPiComputerUseMacAdapter } = await import("./macos/pi-computer-use-adapter");
      const unavailable = createPiComputerUseMacAdapter();
      return {
        backendId: "none",
        platform,
        getStatus: () => ({
          actor: "pi",
          platform,
          backend: "none",
          computerUse: "UNAVAILABLE",
          capabilities: {
            screenshot: false,
            mouse: false,
            keyboard: false,
            scroll: false,
          },
        }),
        screenshot: unavailable.screenshot.bind(unavailable),
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
          mouseMoveOk: false,
          message: `Computer use unavailable on ${platform}`,
        }),
      };
    }
  }
}

export async function resolvePiComputerUseAdapter(
  platform: PiPlatform = resolvePiPlatform(),
): Promise<ComputerUseAdapter> {
  return loadAdapterForPlatform(platform);
}

export async function getPiComputerUseAdapter(): Promise<ComputerUseAdapter> {
  if (!cachedAdapter) {
    cachedAdapter = await loadAdapterForPlatform(resolvePiPlatform());
  }
  return cachedAdapter;
}

/**
 * Explicit invocation only — PI computer use never runs autonomously.
 */
export async function executePiComputerUseCommand(
  command: PiComputerUseCommand,
): Promise<PiComputerUseReceipt> {
  const adapter = await getPiComputerUseAdapter();

  switch (command.action) {
    case "screenshot":
      return adapter.screenshot();
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
      return adapter.type({ text: command.text ?? "" });
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

export async function probePiComputerUse(): Promise<PiComputerUseProbeResult> {
  const adapter = await getPiComputerUseAdapter();
  return adapter.probe();
}
