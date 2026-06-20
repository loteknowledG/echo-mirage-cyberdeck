import { createActionReceipt, createScreenshotReceipt } from "../pi-computer-use-receipts";
import type {
  ActionReceipt,
  ClickRequest,
  ComputerUseAdapter,
  HotkeyRequest,
  MoveRequest,
  PiComputerUseProbeResult,
  PiComputerUseStatus,
  ScrollRequest,
  ScreenshotReceipt,
  TypeRequest,
} from "../pi-computer-use-types";
import { formatPiPlatformLabel, resolvePiPlatform } from "../pi-platform-resolver";

const SCAFFOLD_CAPABILITIES = {
  screenshot: false,
  mouse: false,
  keyboard: false,
  scroll: false,
} as const;

function unavailableReceipt(
  action: ActionReceipt["action"],
  start: number,
): ActionReceipt {
  return createActionReceipt({
    action,
    status: "unavailable",
    durationMs: Date.now() - start,
    error: "pi-computer-use macOS backend is scaffolded but not yet implemented",
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
      computerUse: "SCAFFOLD",
      capabilities: { ...SCAFFOLD_CAPABILITIES },
    };
  }

  async screenshot(): Promise<ScreenshotReceipt> {
    const start = Date.now();
    return createScreenshotReceipt({
      status: "unavailable",
      durationMs: Date.now() - start,
      error: "pi-computer-use macOS backend is scaffolded but not yet implemented",
    });
  }

  async click(input: ClickRequest): Promise<ActionReceipt> {
    return unavailableReceipt("pi.click", Date.now());
  }

  async doubleClick(_input: ClickRequest): Promise<ActionReceipt> {
    return unavailableReceipt("pi.double_click", Date.now());
  }

  async type(_input: TypeRequest): Promise<ActionReceipt> {
    return unavailableReceipt("pi.type", Date.now());
  }

  async hotkey(_input: HotkeyRequest): Promise<ActionReceipt> {
    return unavailableReceipt("pi.hotkey", Date.now());
  }

  async moveMouse(_input: MoveRequest): Promise<ActionReceipt> {
    return unavailableReceipt("pi.move", Date.now());
  }

  async scroll(_input: ScrollRequest): Promise<ActionReceipt> {
    return unavailableReceipt("pi.scroll", Date.now());
  }

  async probe(): Promise<PiComputerUseProbeResult> {
    return {
      platform: this.platform,
      backend: this.backendId,
      screenshotOk: false,
      mouseMoveOk: false,
      message: `${formatPiPlatformLabel(this.platform)} / ${this.backendId} scaffold only`,
    };
  }
}

export function createPiComputerUseMacAdapter(): PiComputerUseMacAdapter {
  return new PiComputerUseMacAdapter();
}
