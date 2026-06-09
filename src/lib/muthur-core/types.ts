import type { OperatorEditorEdit } from "@/lib/operator-workbench";

export type MuthurOperatorConversionRef = {
  sourcePath: string;
  outputPath: string;
  outputName: string;
};

export type MuthurOperatorOpenFileRef = {
  filePath: string;
  fileName: string;
  mode: "edit" | "view";
};

export type MuthurLoopAction = "respond" | "defer" | "tool";

export type MuthurCodingVerifyReceipt = {
  timestamp: string;
  passed: boolean;
  touched_paths: string[];
  tsc_exit_code: number;
  tsc_stderr_tail: string;
  git_diff_stat: string;
  receipt_path: string;
};

/** Per-request side effects collected while running OpenAI tool calls. */
export type MuthurToolExecutionContext = {
  operatorEdits: OperatorEditorEdit[];
  operatorConversion: MuthurOperatorConversionRef | null;
  operatorOpenFile: MuthurOperatorOpenFileRef | null;
  codingTouches: string[];
  codingVerify: MuthurCodingVerifyReceipt | null;
};

export function createMuthurToolExecutionContext(): MuthurToolExecutionContext {
  return {
    operatorEdits: [],
    operatorConversion: null,
    operatorOpenFile: null,
    codingTouches: [],
    codingVerify: null,
  };
}

export interface ToolCall {
  toolName: string;
  args: Record<string, unknown>;
  executionContext?: MuthurToolExecutionContext;
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
