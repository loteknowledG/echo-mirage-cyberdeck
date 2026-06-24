import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import readline from "node:readline";
import {
  isCalyxIntegrationEnabled,
  resolveCalyxHome,
  resolveCalyxMcpBinary,
} from "./calyx-config.server";

type JsonRpcMessage = {
  jsonrpc?: string;
  id?: number | string | null;
  method?: string;
  result?: unknown;
  error?: { code?: number; message?: string; data?: unknown };
};

type McpToolCallResult = {
  content?: Array<{ type?: string; text?: string }>;
  structuredContent?: unknown;
  isError?: boolean;
};

const REQUEST_TIMEOUT_MS = 120_000;

let sharedClient: CalyxMcpStdioClient | null = null;

export function getCalyxMcpClient(): CalyxMcpStdioClient {
  sharedClient ??= new CalyxMcpStdioClient();
  return sharedClient;
}

export function resetCalyxMcpClientForTests(): void {
  sharedClient?.dispose();
  sharedClient = null;
}

function extractToolPayload(result: McpToolCallResult): unknown {
  if (result.structuredContent !== undefined) {
    return result.structuredContent;
  }
  const textBlock = result.content?.find((entry) => entry.type === "text")?.text;
  if (!textBlock) {
    return result;
  }
  try {
    return JSON.parse(textBlock) as unknown;
  } catch {
    return { text: textBlock };
  }
}

export class CalyxMcpStdioClient {
  private proc: ChildProcessWithoutNullStreams | null = null;
  private requestId = 0;
  private initialized = false;
  private initPromise: Promise<void> | null = null;
  private serverVersion: string | undefined;
  private readonly pending = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (error: Error) => void; timer: NodeJS.Timeout }
  >();
  private operationChain: Promise<unknown> = Promise.resolve();

  dispose(): void {
    for (const entry of this.pending.values()) {
      clearTimeout(entry.timer);
      entry.reject(new Error("Calyx MCP client disposed"));
    }
    this.pending.clear();
    if (this.proc) {
      this.proc.kill();
      this.proc = null;
    }
    this.initialized = false;
    this.initPromise = null;
  }

  private enqueue<T>(run: () => Promise<T>): Promise<T> {
    const next = this.operationChain.then(run, run);
    this.operationChain = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  getServerVersion(): string | undefined {
    return this.serverVersion;
  }

  async initialize(): Promise<void> {
    if (!isCalyxIntegrationEnabled()) {
      throw new Error("Calyx integration is disabled");
    }
    if (this.initialized) {
      return;
    }
    this.initPromise ??= this.initializeInternal();
    await this.initPromise;
  }

  private async initializeInternal(): Promise<void> {
    const result = (await this.request("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "echo-mirage", version: "0.1.0" },
    })) as { serverInfo?: { version?: string } };
    this.serverVersion = result.serverInfo?.version;
    this.sendNotification("notifications/initialized", {});
    this.initialized = true;
  }

  async listTools(): Promise<string[]> {
    return this.enqueue(async () => {
      await this.initialize();
      const result = (await this.request("tools/list", {})) as {
        tools?: Array<{ name?: string }>;
      };
      return (result.tools ?? [])
        .map((tool) => tool.name?.trim())
        .filter((name): name is string => Boolean(name));
    });
  }

  async callTool<T = unknown>(
    name: string,
    args: Record<string, unknown> = {},
  ): Promise<T> {
    return this.enqueue(async () => {
      await this.initialize();
      const result = (await this.request("tools/call", {
        name,
        arguments: args,
      })) as McpToolCallResult;

      if (result.isError) {
        const text = result.content?.map((entry) => entry.text).filter(Boolean).join("\n");
        throw new Error(text || `Calyx tool ${name} failed`);
      }

      return extractToolPayload(result) as T;
    });
  }

  private ensureProcess(): ChildProcessWithoutNullStreams {
    if (this.proc) {
      return this.proc;
    }

    const binary = resolveCalyxMcpBinary();
    const calyxHome = resolveCalyxHome();
    const proc = spawn(binary, [], {
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        CALYX_HOME: calyxHome,
      },
    });

    proc.stderr.on("data", (chunk: Buffer) => {
      const line = chunk.toString("utf8").trim();
      if (line) {
        console.debug("[calyx-mcp]", line);
      }
    });

    proc.on("exit", (code, signal) => {
      const reason = signal ? `signal ${signal}` : `code ${code ?? "unknown"}`;
      for (const entry of this.pending.values()) {
        clearTimeout(entry.timer);
        entry.reject(new Error(`Calyx MCP process exited (${reason})`));
      }
      this.pending.clear();
      this.proc = null;
      this.initialized = false;
      this.initPromise = null;
    });

    const rl = readline.createInterface({ input: proc.stdout });
    rl.on("line", (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      let message: JsonRpcMessage;
      try {
        message = JSON.parse(trimmed) as JsonRpcMessage;
      } catch {
        console.warn("[calyx-mcp] non-JSON stdout line:", trimmed.slice(0, 200));
        return;
      }
      if (message.id === undefined || message.id === null) {
        return;
      }
      const id = typeof message.id === "number" ? message.id : Number(message.id);
      const pending = this.pending.get(id);
      if (!pending) {
        return;
      }
      clearTimeout(pending.timer);
      this.pending.delete(id);
      if (message.error) {
        pending.reject(new Error(message.error.message || "Calyx MCP request failed"));
        return;
      }
      pending.resolve(message.result);
    });

    this.proc = proc;
    return proc;
  }

  private sendNotification(method: string, params?: unknown): void {
    const proc = this.ensureProcess();
    proc.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method, params: params ?? {} })}\n`);
  }

  private request(method: string, params?: unknown): Promise<unknown> {
    const proc = this.ensureProcess();
    const id = ++this.requestId;
    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Calyx MCP request timed out: ${method}`));
      }, REQUEST_TIMEOUT_MS);

      this.pending.set(id, { resolve, reject, timer });
      proc.stdin.write(
        `${JSON.stringify({ jsonrpc: "2.0", id, method, params: params ?? {} })}\n`,
      );
    });
  }
}
