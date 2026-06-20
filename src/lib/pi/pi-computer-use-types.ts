export type PiPlatform = "windows" | "macos" | "linux" | "unsupported";

export type PiComputerUseBackend = "windows-use" | "pi-computer-use" | "none";

export type PiReceiptAction =
  | "pi.screenshot"
  | "pi.click"
  | "pi.double_click"
  | "pi.type"
  | "pi.hotkey"
  | "pi.scroll"
  | "pi.move";

export type PiReceiptStatus = "success" | "error" | "unavailable";

export type PiComputerUseCommandAction =
  | "screenshot"
  | "click"
  | "double_click"
  | "type"
  | "hotkey"
  | "scroll"
  | "move";

export interface PiComputerUseCommand {
  action: PiComputerUseCommandAction;
  x?: number;
  y?: number;
  text?: string;
  keys?: string[];
  direction?: "up" | "down";
  amount?: number;
  button?: "left" | "right" | "middle";
}

export interface PiReceiptBase {
  receiptId: string;
  actor: "pi";
  action: PiReceiptAction;
  status: PiReceiptStatus;
  timestamp: string;
  durationMs: number;
  error?: string;
}

export interface ScreenshotReceipt extends PiReceiptBase {
  action: "pi.screenshot";
  data?: {
    mimeType: "image/png" | "image/jpeg";
    base64: string;
    width: number;
    height: number;
  };
}

export interface ActionReceipt extends PiReceiptBase {
  action: Exclude<PiReceiptAction, "pi.screenshot">;
  data?: Record<string, unknown>;
}

export type PiComputerUseReceipt = ScreenshotReceipt | ActionReceipt;

export interface ClickRequest {
  x: number;
  y: number;
  button?: "left" | "right" | "middle";
}

export interface TypeRequest {
  text: string;
}

export interface HotkeyRequest {
  keys: string[];
}

export interface MoveRequest {
  x: number;
  y: number;
}

export interface ScrollRequest {
  direction: "up" | "down";
  amount?: number;
}

export interface PiComputerUseCapabilities {
  screenshot: boolean;
  mouse: boolean;
  keyboard: boolean;
  scroll: boolean;
}

export interface PiComputerUseStatus {
  actor: "pi";
  platform: PiPlatform;
  backend: PiComputerUseBackend;
  computerUse: "READY" | "UNAVAILABLE" | "SCAFFOLD";
  capabilities: PiComputerUseCapabilities;
}

export interface PiComputerUseProbeResult {
  platform: PiPlatform;
  backend: PiComputerUseBackend;
  screenshotOk: boolean;
  mouseMoveOk: boolean;
  message: string;
}

export interface ComputerUseAdapter {
  readonly backendId: PiComputerUseBackend;
  readonly platform: PiPlatform;
  getStatus(): PiComputerUseStatus;
  screenshot(): Promise<ScreenshotReceipt>;
  click(input: ClickRequest): Promise<ActionReceipt>;
  doubleClick(input: ClickRequest): Promise<ActionReceipt>;
  type(input: TypeRequest): Promise<ActionReceipt>;
  hotkey(input: HotkeyRequest): Promise<ActionReceipt>;
  moveMouse(input: MoveRequest): Promise<ActionReceipt>;
  scroll(input: ScrollRequest): Promise<ActionReceipt>;
  probe(): Promise<PiComputerUseProbeResult>;
}
