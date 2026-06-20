import { Type, type Tool, type ToolCall } from "@mariozechner/pi-ai";
import { executePiComputerUseCommand } from "@/lib/pi/pi-computer-use-manager";
import { getPiComputerUseStatus } from "@/lib/pi/pi-computer-use-status";
import type { PiComputerUseCommand, PiComputerUseCommandAction } from "@/lib/pi/pi-computer-use-types";

const piComputerUseParameters = Type.Object({
  action: Type.Union([
    Type.Literal("screenshot"),
    Type.Literal("active_window"),
    Type.Literal("click"),
    Type.Literal("double_click"),
    Type.Literal("type"),
    Type.Literal("hotkey"),
    Type.Literal("scroll"),
    Type.Literal("move"),
  ]),
  x: Type.Optional(Type.Number()),
  y: Type.Optional(Type.Number()),
  text: Type.Optional(Type.String()),
  keys: Type.Optional(Type.Array(Type.String())),
  direction: Type.Optional(Type.Union([Type.Literal("up"), Type.Literal("down")])),
  amount: Type.Optional(Type.Number()),
  button: Type.Optional(
    Type.Union([Type.Literal("left"), Type.Literal("right"), Type.Literal("middle")]),
  ),
});

export const PI_COMPUTER_USE_CHAT_TOOL: Tool<typeof piComputerUseParameters> = {
  name: "pi_computer_use",
  description:
    "Execute one desktop action via Pi windows-use (screenshot, active_window, click, type, hotkey, scroll, move). " +
    "Requires active operator control lease. Take screenshot first, then act step by step.",
  parameters: piComputerUseParameters,
};

export function getPiComputerUseChatTools(): Tool[] {
  return [PI_COMPUTER_USE_CHAT_TOOL];
}

function isPiComputerUseCommandAction(value: unknown): value is PiComputerUseCommandAction {
  return (
    value === "screenshot" ||
    value === "active_window" ||
    value === "click" ||
    value === "double_click" ||
    value === "type" ||
    value === "hotkey" ||
    value === "scroll" ||
    value === "move"
  );
}

function toPiComputerUseCommand(args: Record<string, unknown>): PiComputerUseCommand | null {
  if (!isPiComputerUseCommandAction(args.action)) return null;
  return {
    action: args.action,
    x: typeof args.x === "number" ? args.x : undefined,
    y: typeof args.y === "number" ? args.y : undefined,
    text: typeof args.text === "string" ? args.text : undefined,
    keys: Array.isArray(args.keys) ? args.keys.filter((k): k is string => typeof k === "string") : undefined,
    direction: args.direction === "up" || args.direction === "down" ? args.direction : undefined,
    amount: typeof args.amount === "number" ? args.amount : undefined,
    button:
      args.button === "left" || args.button === "right" || args.button === "middle"
        ? args.button
        : undefined,
  };
}

export async function executePiComputerUseChatTool(
  toolCall: ToolCall,
): Promise<{ text: string; isError: boolean }> {
  if (toolCall.name !== "pi_computer_use") {
    return { text: `[TOOL ERROR] Unknown tool: ${toolCall.name}`, isError: true };
  }

  const status = getPiComputerUseStatus();
  if (status.status !== "READY") {
    return {
      text:
        `[BLOCKED] Pi computer use is ${status.status} on host ${status.hostPlatform} ` +
        `(backend: ${status.backend}). ${status.remediation ?? "Run on Windows with .venv-pi installed."}`,
      isError: true,
    };
  }

  const command = toPiComputerUseCommand(toolCall.arguments ?? {});
  if (!command) {
    return { text: "[TOOL ERROR] Invalid pi_computer_use arguments", isError: true };
  }

  const receipt = await executePiComputerUseCommand(command);
  const payload = JSON.stringify(receipt, null, 2);
  if (receipt.status === "blocked" || receipt.status === "failed") {
    return { text: payload, isError: true };
  }
  return { text: payload, isError: false };
}

export function assistantMessageToText(
  content: Array<{ type: string; text?: string }>,
): string {
  return content
    .filter((part) => part.type === "text" && typeof part.text === "string")
    .map((part) => part.text as string)
    .join("");
}

export function extractToolCalls(
  content: Array<{ type: string; id?: string; name?: string; arguments?: Record<string, unknown> }>,
): ToolCall[] {
  return content
    .filter((part) => part.type === "toolCall" && part.id && part.name)
    .map((part) => ({
      type: "toolCall" as const,
      id: part.id as string,
      name: part.name as string,
      arguments: part.arguments ?? {},
    }));
}
