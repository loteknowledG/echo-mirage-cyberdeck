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

type NutModule = typeof import("@nut-tree-fork/nut-js");
type ScreenshotModule = typeof import("node-screenshots");

const READY_CAPABILITIES = {
  screenshot: true,
  mouse: true,
  keyboard: true,
  scroll: true,
} as const;

async function loadNutJs(): Promise<NutModule> {
  return import("@nut-tree-fork/nut-js");
}

async function loadNodeScreenshots(): Promise<ScreenshotModule> {
  return import("node-screenshots");
}

function resolveNutKey(nut: NutModule, keyName: string): NutModule["Key"][keyof NutModule["Key"]] {
  const keyMap: Record<string, string> = {
    ctrl: "LeftControl",
    control: "LeftControl",
    shift: "LeftShift",
    alt: "LeftAlt",
    meta: "LeftWin",
    win: "LeftWin",
    windows: "LeftWin",
    enter: "Return",
    return: "Return",
    tab: "Tab",
    escape: "Escape",
    esc: "Escape",
    backspace: "Backspace",
    delete: "Delete",
    space: "Space",
    up: "Up",
    down: "Down",
    left: "Left",
    right: "Right",
    home: "Home",
    end: "End",
    pageup: "PageUp",
    pagedown: "PageDown",
    f1: "F1",
    f2: "F2",
    f3: "F3",
    f4: "F4",
    f5: "F5",
    f6: "F6",
    f7: "F7",
    f8: "F8",
    f9: "F9",
    f10: "F10",
    f11: "F11",
    f12: "F12",
  };

  const normalized = keyName.toLowerCase().trim();
  const mapped = keyMap[normalized] ?? keyName;
  const key = nut.Key[mapped as keyof typeof nut.Key];
  if (key !== undefined) {
    return key;
  }
  if (mapped.length === 1) {
    const upper = mapped.toUpperCase();
    const single = nut.Key[upper as keyof typeof nut.Key];
    if (single !== undefined) {
      return single;
    }
  }
  throw new Error(`Unknown key: "${keyName}"`);
}

function nutButton(nut: NutModule, button: ClickRequest["button"]) {
  switch (button ?? "left") {
    case "right":
      return nut.Button.RIGHT;
    case "middle":
      return nut.Button.MIDDLE;
    default:
      return nut.Button.LEFT;
  }
}

export class WindowsUseAdapter implements ComputerUseAdapter {
  readonly backendId = "windows-use" as const;
  readonly platform = resolvePiPlatform();

  getStatus(): PiComputerUseStatus {
    return {
      actor: "pi",
      platform: this.platform,
      backend: this.backendId,
      computerUse: "READY",
      capabilities: { ...READY_CAPABILITIES },
    };
  }

  async screenshot(): Promise<ScreenshotReceipt> {
    const start = Date.now();
    try {
      const { Monitor } = await loadNodeScreenshots();
      const monitors = Monitor.all();
      const primary = monitors.find((monitor) => monitor.isPrimary()) ?? monitors[0];
      if (!primary) {
        return createScreenshotReceipt({
          status: "error",
          durationMs: Date.now() - start,
          error: "No monitor found",
        });
      }

      const image = primary.captureImageSync();
      const png = image.toPngSync();
      const scaleFactor = primary.scaleFactor() ?? 1;

      return createScreenshotReceipt({
        status: "success",
        durationMs: Date.now() - start,
        data: {
          mimeType: "image/png",
          base64: png.toString("base64"),
          width: Math.round(image.width / scaleFactor),
          height: Math.round(image.height / scaleFactor),
        },
      });
    } catch (error) {
      return createScreenshotReceipt({
        status: "error",
        durationMs: Date.now() - start,
        error: error instanceof Error ? error.message : "Screenshot failed",
      });
    }
  }

  async click(input: ClickRequest): Promise<ActionReceipt> {
    const start = Date.now();
    try {
      const nut = await loadNutJs();
      const point = new nut.Point(input.x, input.y);
      await nut.mouse.move(nut.straightTo(point));
      await nut.mouse.click(nutButton(nut, input.button));
      return createActionReceipt({
        action: "pi.click",
        status: "success",
        durationMs: Date.now() - start,
        data: { x: input.x, y: input.y, button: input.button ?? "left" },
      });
    } catch (error) {
      return createActionReceipt({
        action: "pi.click",
        status: "error",
        durationMs: Date.now() - start,
        error: error instanceof Error ? error.message : "Click failed",
      });
    }
  }

  async doubleClick(input: ClickRequest): Promise<ActionReceipt> {
    const start = Date.now();
    try {
      const nut = await loadNutJs();
      const point = new nut.Point(input.x, input.y);
      await nut.mouse.move(nut.straightTo(point));
      await nut.mouse.doubleClick(nutButton(nut, input.button));
      return createActionReceipt({
        action: "pi.double_click",
        status: "success",
        durationMs: Date.now() - start,
        data: { x: input.x, y: input.y, button: input.button ?? "left" },
      });
    } catch (error) {
      return createActionReceipt({
        action: "pi.double_click",
        status: "error",
        durationMs: Date.now() - start,
        error: error instanceof Error ? error.message : "Double click failed",
      });
    }
  }

  async type(input: TypeRequest): Promise<ActionReceipt> {
    const start = Date.now();
    try {
      const nut = await loadNutJs();
      await nut.keyboard.type(input.text);
      return createActionReceipt({
        action: "pi.type",
        status: "success",
        durationMs: Date.now() - start,
        data: { length: input.text.length },
      });
    } catch (error) {
      return createActionReceipt({
        action: "pi.type",
        status: "error",
        durationMs: Date.now() - start,
        error: error instanceof Error ? error.message : "Type failed",
      });
    }
  }

  async hotkey(input: HotkeyRequest): Promise<ActionReceipt> {
    const start = Date.now();
    try {
      const nut = await loadNutJs();
      const resolved = input.keys.map((key) => resolveNutKey(nut, key));
      await nut.keyboard.pressKey(...resolved);
      await nut.keyboard.releaseKey(...resolved);
      return createActionReceipt({
        action: "pi.hotkey",
        status: "success",
        durationMs: Date.now() - start,
        data: { keys: input.keys },
      });
    } catch (error) {
      return createActionReceipt({
        action: "pi.hotkey",
        status: "error",
        durationMs: Date.now() - start,
        error: error instanceof Error ? error.message : "Hotkey failed",
      });
    }
  }

  async moveMouse(input: MoveRequest): Promise<ActionReceipt> {
    const start = Date.now();
    try {
      const nut = await loadNutJs();
      const point = new nut.Point(input.x, input.y);
      await nut.mouse.move(nut.straightTo(point));
      return createActionReceipt({
        action: "pi.move",
        status: "success",
        durationMs: Date.now() - start,
        data: { x: input.x, y: input.y },
      });
    } catch (error) {
      return createActionReceipt({
        action: "pi.move",
        status: "error",
        durationMs: Date.now() - start,
        error: error instanceof Error ? error.message : "Mouse move failed",
      });
    }
  }

  async scroll(input: ScrollRequest): Promise<ActionReceipt> {
    const start = Date.now();
    const amount = Math.max(1, input.amount ?? 3);
    try {
      const nut = await loadNutJs();
      for (let step = 0; step < amount; step += 1) {
        if (input.direction === "down") {
          await nut.mouse.scrollDown(1);
        } else {
          await nut.mouse.scrollUp(1);
        }
      }
      return createActionReceipt({
        action: "pi.scroll",
        status: "success",
        durationMs: Date.now() - start,
        data: { direction: input.direction, amount },
      });
    } catch (error) {
      return createActionReceipt({
        action: "pi.scroll",
        status: "error",
        durationMs: Date.now() - start,
        error: error instanceof Error ? error.message : "Scroll failed",
      });
    }
  }

  async probe(): Promise<PiComputerUseProbeResult> {
    const screenshot = await this.screenshot();
    const nut = await loadNutJs();
    const current = await nut.mouse.getPosition();
    const move = await this.moveMouse({
      x: current.x + 1,
      y: current.y,
    });
    await this.moveMouse({ x: current.x, y: current.y });

    return {
      platform: this.platform,
      backend: this.backendId,
      screenshotOk: screenshot.status === "success",
      mouseMoveOk: move.status === "success",
      message: `${formatPiPlatformLabel(this.platform)} / ${this.backendId} probe complete`,
    };
  }
}

export function createWindowsUseAdapter(): WindowsUseAdapter {
  return new WindowsUseAdapter();
}
