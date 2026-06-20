export type PiPlatform = "windows" | "macos" | "linux" | "unsupported";

export type PiComputerUseBackend = "windows-use" | "pi-computer-use" | "none";

export type PiComputerUseCapabilityName =
  | "screenshot"
  | "mouse_move"
  | "mouse_click"
  | "double_click"
  | "type_text"
  | "hotkey"
  | "scroll"
  | "active_window";

export type PiComputerUseReceiptStatus = "success" | "failed" | "blocked";

export type PiComputerUseCommandAction =
  | "screenshot"
  | "click"
  | "double_click"
  | "type"
  | "hotkey"
  | "scroll"
  | "move"
  | "active_window";

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

export interface PiComputerUseReceipt {
  id: string;
  actor: "pi";
  backend: "windows-use" | "pi-computer-use" | "none";
  capability: PiComputerUseCapabilityName;
  status: PiComputerUseReceiptStatus;
  createdAt: string;
  durationMs?: number;
  summary: string;
  error?: string;
  data?: Record<string, unknown>;
}

export interface ClickRequest {
  x: number;
  y: number;
  button?: "left" | "right" | "middle";
}

export interface TypeRequest {
  text: string;
  x?: number;
  y?: number;
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
  activeWindow: boolean;
  mouse: boolean;
  keyboard: boolean;
  scroll: boolean;
}

export type PiComputerUseReadiness =
  | "READY"
  | "NOT_INSTALLED"
  | "FAILED"
  | "SCAFFOLD"
  | "UNAVAILABLE";

export interface PiComputerUseStatus {
  actor: "pi";
  /** Node host where Pi computer-use executes (process.platform). */
  platform: PiPlatform;
  hostPlatform: PiPlatform;
  backend: PiComputerUseBackend;
  status: PiComputerUseReadiness;
  /** @deprecated Use `status` — kept for existing callers */
  computerUse: PiComputerUseReadiness;
  capabilities: PiComputerUseCapabilities;
  remediation?: string;
  lastError?: string;
}

export interface PiComputerUseProbeResult {
  platform: PiPlatform;
  backend: PiComputerUseBackend;
  screenshotOk: boolean;
  activeWindowOk: boolean;
  mouseMoveOk: boolean;
  mouseMoveSkipped: boolean;
  windowsUseImportOk: boolean;
  message: string;
  receipt?: PiComputerUseReceipt;
}

export interface ComputerUseAdapter {
  readonly backendId: PiComputerUseBackend;
  readonly platform: PiPlatform;
  getStatus(): PiComputerUseStatus;
  screenshot(): Promise<PiComputerUseReceipt>;
  activeWindow(): Promise<PiComputerUseReceipt>;
  click(input: ClickRequest): Promise<PiComputerUseReceipt>;
  doubleClick(input: ClickRequest): Promise<PiComputerUseReceipt>;
  type(input: TypeRequest): Promise<PiComputerUseReceipt>;
  hotkey(input: HotkeyRequest): Promise<PiComputerUseReceipt>;
  moveMouse(input: MoveRequest): Promise<PiComputerUseReceipt>;
  scroll(input: ScrollRequest): Promise<PiComputerUseReceipt>;
  probe(): Promise<PiComputerUseProbeResult>;
}
