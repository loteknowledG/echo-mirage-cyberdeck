export type MuthurLoopAction = "respond" | "defer" | "tool";

export interface ToolCall {
  toolName: string;
  args: Record<string, unknown>;
}

export interface ToolResult {
  ok: boolean;
  output?: unknown;
  error?: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  run: (call: ToolCall) => Promise<ToolResult>;
}

export interface ToolRegistry {
  tools: Record<string, ToolDefinition>;
}

export interface ToolLoopStep {
  index: number;
  intent: string;
  action: MuthurLoopAction;
  toolCall: ToolCall | null;
  toolResult: ToolResult | null;
  note: string;
}

export interface MuthurLoopState {
  intent: string;
  steps: ToolLoopStep[];
  finalized: boolean;
  finalResponse: string;
}
