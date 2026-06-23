import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "@mariozechner/pi-ai";
import type { PiComputerUseCommandAction } from "./pi-computer-use-types";

const piComputerUseSchema = Type.Object({
  action: Type.Union([
    Type.Literal("screenshot"),
    Type.Literal("active_window"),
    Type.Literal("click"),
    Type.Literal("double_click"),
    Type.Literal("type"),
    Type.Literal("hotkey"),
    Type.Literal("scroll"),
    Type.Literal("move"),
  ], {
    description:
      "Desktop action via Pi (Synapse preferred, windows-use fallback). Requires active operator control lease.",
  }),
  x: Type.Optional(Type.Number({ description: "Screen X coordinate" })),
  y: Type.Optional(Type.Number({ description: "Screen Y coordinate" })),
  text: Type.Optional(Type.String({ description: "Text to type (action=type)" })),
  keys: Type.Optional(
    Type.Array(Type.String(), { description: 'Hotkey chord, e.g. ["ctrl", "s"]' }),
  ),
  direction: Type.Optional(
    Type.Union([Type.Literal("up"), Type.Literal("down")], {
      description: "Scroll direction",
    }),
  ),
  amount: Type.Optional(Type.Number({ description: "Scroll wheel steps" })),
  button: Type.Optional(
    Type.Union([Type.Literal("left"), Type.Literal("right"), Type.Literal("middle")]),
  ),
});

type PiComputerUseToolParams = {
  action: PiComputerUseCommandAction;
  x?: number;
  y?: number;
  text?: string;
  keys?: string[];
  direction?: "up" | "down";
  amount?: number;
  button?: "left" | "right" | "middle";
};

export function createPiComputerUseTool(): AgentTool<typeof piComputerUseSchema, string> {
  return {
    label: "Pi Computer Use",
    name: "pi_computer_use",
    description:
      "Execute a single desktop action through Pi (Synapse preferred, windows-use fallback): screenshot, active_window, mouse, keyboard, scroll. " +
      "Requires an active Pi control lease granted by the operator. " +
      "Use for Paint/desktop missions: screenshot first, then open apps via hotkey, click, type, etc. " +
      "Returns a JSON receipt with status and summary.",
    parameters: piComputerUseSchema,
    execute: async (_toolCallId, args: PiComputerUseToolParams, signal?: AbortSignal) => {
      if (signal?.aborted) {
        throw new Error("Pi computer use aborted");
      }

      const response = await fetch("/api/pi-computer-use/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(args),
        signal,
      });

      const payload = (await response.json().catch(() => ({}))) as {
        receipt?: Record<string, unknown>;
        error?: string;
      };

      if (!response.ok) {
        const message =
          payload.error ||
          (typeof payload.receipt?.summary === "string" ? payload.receipt.summary : null) ||
          `Pi computer use failed (${response.status})`;
        throw new Error(message);
      }

      const text = JSON.stringify(payload.receipt ?? payload, null, 2);
      return {
        content: [{ type: "text", text }],
        details: text,
      };
    },
  };
}
