import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
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
import { renewSynapseOperatorLease } from "./synapse-control-lease.server";
import { SYNAPSE_PI_REMEDIATION } from "./synapse-config.server";
import { getSynapseMcpClient } from "./synapse-mcp-client.server";
import { getCachedSynapseReadinessDetail, isSynapseReady } from "./synapse-readiness.server";

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

type WindowListEntry = {
  hwnd?: number;
  window_title?: string;
  process_name?: string;
  is_foreground?: boolean;
};

type WindowListResult = {
  windows?: WindowListEntry[];
  human_os_foreground_hwnd?: number | null;
};

type TargetActResult = {
  ok?: boolean;
  status?: string;
  error?: string;
  result?: Record<string, unknown>;
};

function formatHotkey(keys: string[]): string {
  return keys
    .map((key) => {
      const normalized = key.trim().toLowerCase();
      switch (normalized) {
        case "ctrl":
        case "control":
          return "Ctrl";
        case "alt":
          return "Alt";
        case "shift":
          return "Shift";
        case "meta":
        case "win":
        case "windows":
          return "Meta";
        case "enter":
        case "return":
          return "Enter";
        case "esc":
        case "escape":
          return "Escape";
        case "pageup":
        case "page_up":
          return "PageUp";
        case "pagedown":
        case "page_down":
          return "PageDown";
        default:
          if (normalized.length === 1) {
            return normalized.toUpperCase();
          }
          return key.trim();
      }
    })
    .join("+");
}

async function buildStatus(): Promise<PiComputerUseStatus> {
  const platform = resolvePiPlatform();
  const ready = await isSynapseReady();
  const detail = getCachedSynapseReadinessDetail();

  return {
    actor: "pi",
    platform,
    hostPlatform: platform,
    backend: "synapse",
    status: ready ? "READY" : "FAILED",
    computerUse: ready ? "READY" : "FAILED",
    capabilities: ready ? { ...READY_CAPABILITIES } : { ...UNAVAILABLE_CAPABILITIES },
    remediation: ready ? undefined : SYNAPSE_PI_REMEDIATION,
    lastError: ready ? undefined : detail,
  };
}

async function withLease<T>(run: () => Promise<T>): Promise<T> {
  await renewSynapseOperatorLease();
  return run();
}

function successReceipt(
  capability: PiComputerUseReceipt["capability"],
  summary: string,
  startedAt: number,
  data?: Record<string, unknown>,
): PiComputerUseReceipt {
  return createPiComputerUseReceipt({
    backend: "synapse",
    capability,
    status: "success",
    summary,
    durationMs: Date.now() - startedAt,
    data,
  });
}

function failedReceipt(
  capability: PiComputerUseReceipt["capability"],
  summary: string,
  startedAt: number,
  error: string,
  data?: Record<string, unknown>,
): PiComputerUseReceipt {
  return createPiComputerUseReceipt({
    backend: "synapse",
    capability,
    status: "failed",
    summary,
    durationMs: Date.now() - startedAt,
    error,
    data,
  });
}

async function callTargetAct(
  args: Record<string, unknown>,
  capability: PiComputerUseReceipt["capability"],
  summary: string,
): Promise<PiComputerUseReceipt> {
  const startedAt = Date.now();
  try {
    const result = await withLease(() =>
      getSynapseMcpClient().callTool<TargetActResult>("target_act", args),
    );
    if (result.ok === false) {
      return failedReceipt(
        capability,
        summary,
        startedAt,
        result.error || result.status || "target_act refused",
        result.result,
      );
    }
    return successReceipt(capability, summary, startedAt, result.result);
  } catch (error) {
    return failedReceipt(
      capability,
      summary,
      startedAt,
      error instanceof Error ? error.message : "Synapse target_act failed",
    );
  }
}

export class SynapseAdapter implements ComputerUseAdapter {
  readonly backendId = "synapse" as const;
  readonly platform = resolvePiPlatform();

  getStatus(): PiComputerUseStatus {
    const platform = resolvePiPlatform();
    const detail = getCachedSynapseReadinessDetail();
    const ready = detail?.startsWith("synapse_ok") ?? false;

    return {
      actor: "pi",
      platform,
      hostPlatform: platform,
      backend: "synapse",
      status: ready ? "READY" : "FAILED",
      computerUse: ready ? "READY" : "FAILED",
      capabilities: ready ? { ...READY_CAPABILITIES } : { ...UNAVAILABLE_CAPABILITIES },
      remediation: ready ? undefined : SYNAPSE_PI_REMEDIATION,
      lastError: ready ? undefined : detail,
    };
  }

  async screenshot(): Promise<PiComputerUseReceipt> {
    const startedAt = Date.now();
    const screenshotPath = path.join(
      os.tmpdir(),
      `echo-mirage-pi-${Date.now()}.png`,
    );

    try {
      const capture = await withLease(() =>
        getSynapseMcpClient().callTool<{
          width?: number;
          height?: number;
          bytes_written?: number;
        }>("capture_screenshot", {
          path: screenshotPath,
        }),
      );

      const bytes = await fs.readFile(screenshotPath);
      await fs.unlink(screenshotPath).catch(() => undefined);
      const width = Number(capture.width ?? 0);
      const height = Number(capture.height ?? 0);

      return successReceipt(
        "screenshot",
        width && height
          ? `Captured ${width}x${height} screenshot via Synapse`
          : "Captured screenshot via Synapse",
        startedAt,
        {
          mimeType: "image/png",
          base64: bytes.toString("base64"),
          width: width || undefined,
          height: height || undefined,
        },
      );
    } catch (error) {
      await fs.unlink(screenshotPath).catch(() => undefined);
      return failedReceipt(
        "screenshot",
        "Synapse screenshot failed",
        startedAt,
        error instanceof Error ? error.message : "Synapse screenshot failed",
      );
    }
  }

  async activeWindow(): Promise<PiComputerUseReceipt> {
    const startedAt = Date.now();
    try {
      const result = await getSynapseMcpClient().callTool<WindowListResult>(
        "window_list",
        {},
      );
      const foreground =
        result.windows?.find((entry) => entry.is_foreground) ??
        result.windows?.find(
          (entry) => entry.hwnd === result.human_os_foreground_hwnd,
        );
      if (!foreground) {
        return failedReceipt(
          "active_window",
          "No foreground window reported by Synapse",
          startedAt,
          "window_list returned no foreground window",
        );
      }

      return successReceipt(
        "active_window",
        foreground.window_title || "Foreground window",
        startedAt,
        {
          name: foreground.window_title,
          handle: foreground.hwnd,
          processName: foreground.process_name,
        },
      );
    } catch (error) {
      return failedReceipt(
        "active_window",
        "Synapse active window lookup failed",
        startedAt,
        error instanceof Error ? error.message : "Synapse window_list failed",
      );
    }
  }

  async click(input: ClickRequest): Promise<PiComputerUseReceipt> {
    return callTargetAct(
      {
        verb: "click",
        x: input.x,
        y: input.y,
        coordinate_space: "screen",
        button: input.button ?? "left",
        clicks: 1,
      },
      "mouse_click",
      `Clicked (${input.x}, ${input.y}) via Synapse`,
    );
  }

  async doubleClick(input: ClickRequest): Promise<PiComputerUseReceipt> {
    return callTargetAct(
      {
        verb: "click",
        x: input.x,
        y: input.y,
        coordinate_space: "screen",
        button: input.button ?? "left",
        clicks: 2,
      },
      "double_click",
      `Double-clicked (${input.x}, ${input.y}) via Synapse`,
    );
  }

  async type(input: TypeRequest): Promise<PiComputerUseReceipt> {
    const args: Record<string, unknown> = {
      verb: "type",
      text: input.text,
      coordinate_space: "screen",
    };
    if (input.x !== undefined && input.y !== undefined) {
      args.x = input.x;
      args.y = input.y;
    }
    return callTargetAct(args, "type_text", `Typed ${input.text.length} chars via Synapse`);
  }

  async hotkey(input: HotkeyRequest): Promise<PiComputerUseReceipt> {
    return callTargetAct(
      {
        verb: "key",
        key: formatHotkey(input.keys),
      },
      "hotkey",
      `Pressed ${formatHotkey(input.keys)} via Synapse`,
    );
  }

  async moveMouse(input: MoveRequest): Promise<PiComputerUseReceipt> {
    const startedAt = Date.now();
    return failedReceipt(
      "mouse_move",
      "Synapse does not expose pure mouse move",
      startedAt,
      `Use click at (${input.x}, ${input.y}) instead of move`,
    );
  }

  async scroll(input: ScrollRequest): Promise<PiComputerUseReceipt> {
    const startedAt = Date.now();
    const key = input.direction === "up" ? "PageUp" : "PageDown";
    const amount = Math.max(1, input.amount ?? 3);

    try {
      for (let index = 0; index < amount; index += 1) {
        const result = await withLease(() =>
          getSynapseMcpClient().callTool<TargetActResult>("target_act", {
            verb: "key",
            key,
          }),
        );
        if (result.ok === false) {
          return failedReceipt(
            "scroll",
            `Synapse scroll ${input.direction} failed`,
            startedAt,
            result.error || result.status || "target_act key refused",
            result.result,
          );
        }
      }
      return successReceipt(
        "scroll",
        `Scrolled ${input.direction} x${amount} via Synapse`,
        startedAt,
        { direction: input.direction, amount },
      );
    } catch (error) {
      return failedReceipt(
        "scroll",
        `Synapse scroll ${input.direction} failed`,
        startedAt,
        error instanceof Error ? error.message : "Synapse scroll failed",
      );
    }
  }

  async probe(): Promise<PiComputerUseProbeResult> {
    const status = await buildStatus();
    if (status.status !== "READY") {
      return {
        platform: this.platform,
        backend: this.backendId,
        screenshotOk: false,
        activeWindowOk: false,
        mouseMoveOk: false,
        mouseMoveSkipped: true,
        windowsUseImportOk: false,
        message: status.lastError || "Synapse daemon not ready",
      };
    }

    const screenshot = await this.screenshot();
    const activeWindow = await this.activeWindow();

    return {
      platform: this.platform,
      backend: this.backendId,
      screenshotOk: screenshot.status === "success",
      activeWindowOk: activeWindow.status === "success",
      mouseMoveOk: false,
      mouseMoveSkipped: true,
      windowsUseImportOk: true,
      message: `${formatPiPlatformLabel(this.platform)} / synapse probe complete (mouse move skipped)`,
      receipt: screenshot,
    };
  }
}

export function createSynapseAdapter(): SynapseAdapter {
  return new SynapseAdapter();
}

export async function getSynapseAdapterStatus(): Promise<PiComputerUseStatus> {
  return buildStatus();
}
