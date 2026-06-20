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

const SCAFFOLD_CAPABILITIES = {
  screenshot: false,
  activeWindow: false,
  mouse: false,
  keyboard: false,
  scroll: false,
} as const;

const SCAFFOLD_ERROR = "pi-computer-use macOS backend is scaffolded but not yet implemented";

function blockedReceipt(
  capability: PiComputerUseReceipt["capability"],
  start: number,
): PiComputerUseReceipt {
  return createPiComputerUseReceipt({
    backend: "pi-computer-use",
    capability,
    status: "blocked",
    summary: SCAFFOLD_ERROR,
    durationMs: Date.now() - start,
    error: SCAFFOLD_ERROR,
  });
}

export class PiComputerUseMacAdapter implements ComputerUseAdapter {
  readonly backendId = "pi-computer-use" as const;
  readonly platform = resolvePiPlatform();

  getStatus(): PiComputerUseStatus {
    return {
      actor: "pi",
      platform: this.platform,
      backend: this.backendId,
      status: "SCAFFOLD",
      computerUse: "SCAFFOLD",
      capabilities: { ...SCAFFOLD_CAPABILITIES },
    };
  }

  async screenshot(): Promise<PiComputerUseReceipt> {
    return blockedReceipt("screenshot", Date.now());
  }

  async activeWindow(): Promise<PiComputerUseReceipt> {
    return blockedReceipt("active_window", Date.now());
  }

  async click(_input: ClickRequest): Promise<PiComputerUseReceipt> {
    return blockedReceipt("mouse_click", Date.now());
  }

  async doubleClick(_input: ClickRequest): Promise<PiComputerUseReceipt> {
    return blockedReceipt("double_click", Date.now());
  }

  async type(_input: TypeRequest): Promise<PiComputerUseReceipt> {
    return blockedReceipt("type_text", Date.now());
  }

  async hotkey(_input: HotkeyRequest): Promise<PiComputerUseReceipt> {
    return blockedReceipt("hotkey", Date.now());
  }

  async moveMouse(_input: MoveRequest): Promise<PiComputerUseReceipt> {
    return blockedReceipt("mouse_move", Date.now());
  }

  async scroll(_input: ScrollRequest): Promise<PiComputerUseReceipt> {
    return blockedReceipt("scroll", Date.now());
  }

  async probe(): Promise<PiComputerUseProbeResult> {
    return {
      platform: this.platform,
      backend: this.backendId,
      screenshotOk: false,
      activeWindowOk: false,
      mouseMoveOk: false,
      mouseMoveSkipped: true,
      windowsUseImportOk: false,
      message: `${formatPiPlatformLabel(this.platform)} / ${this.backendId} scaffold only`,
    };
  }
}

export function createPiComputerUseMacAdapter(): PiComputerUseMacAdapter {
  return new PiComputerUseMacAdapter();
}
