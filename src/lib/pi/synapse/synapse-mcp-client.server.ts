import {
  readSynapseBearerToken,
  SYNAPSE_MCP_URL,
} from "./synapse-config.server";

type JsonRpcMessage = {
  jsonrpc?: string;
  id?: number | string | null;
  result?: unknown;
  error?: { code?: number; message?: string; data?: unknown };
};

type McpToolCallResult = {
  content?: Array<{ type?: string; text?: string }>;
  structuredContent?: unknown;
  isError?: boolean;
};

let sharedClient: SynapseMcpClient | null = null;

export function getSynapseMcpClient(): SynapseMcpClient {
  sharedClient ??= new SynapseMcpClient();
  return sharedClient;
}

export function resetSynapseMcpClientForTests(): void {
  sharedClient = null;
}

function parseStreamableHttpBody(text: string): JsonRpcMessage {
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) {
    return JSON.parse(trimmed) as JsonRpcMessage;
  }

  for (const line of text.split(/\r?\n/)) {
    if (!line.startsWith("data:")) {
      continue;
    }
    const payload = line.slice(5).trim();
    if (!payload) {
      continue;
    }
    return JSON.parse(payload) as JsonRpcMessage;
  }

  throw new Error("Synapse MCP response contained no JSON-RPC data frame");
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

export class SynapseMcpClient {
  private sessionId: string | null = null;
  private requestId = 0;
  private initialized = false;
  private initPromise: Promise<void> | null = null;

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }
    this.initPromise ??= this.initializeInternal();
    await this.initPromise;
  }

  private async initializeInternal(): Promise<void> {
    await this.request("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "echo-mirage-pi", version: "0.1.0" },
    });
    await this.notify("notifications/initialized", {});
    this.initialized = true;
  }

  private async notify(method: string, params?: unknown): Promise<void> {
    const token = readSynapseBearerToken();
    if (!token) {
      throw new Error("Synapse bearer token is not configured");
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      Authorization: `Bearer ${token}`,
    };
    if (this.sessionId) {
      headers["Mcp-Session-Id"] = this.sessionId;
    }

    const body = JSON.stringify({
      jsonrpc: "2.0",
      method,
      params: params ?? {},
    });

    const response = await fetch(SYNAPSE_MCP_URL, {
      method: "POST",
      headers,
      body,
    });

    const nextSession = response.headers.get("Mcp-Session-Id");
    if (nextSession) {
      this.sessionId = nextSession;
    }

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Synapse MCP HTTP ${response.status}: ${text.slice(0, 240) || response.statusText}`,
      );
    }
  }

  async callTool<T = unknown>(
    name: string,
    args: Record<string, unknown> = {},
  ): Promise<T> {
    await this.initialize();
    const result = (await this.request("tools/call", {
      name,
      arguments: args,
    })) as McpToolCallResult;

    if (result.isError) {
      const text = result.content?.map((entry) => entry.text).filter(Boolean).join("\n");
      throw new Error(text || `Synapse tool ${name} failed`);
    }

    return extractToolPayload(result) as T;
  }

  private async request(method: string, params?: unknown): Promise<unknown> {
    const token = readSynapseBearerToken();
    if (!token) {
      throw new Error("Synapse bearer token is not configured");
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      Authorization: `Bearer ${token}`,
    };
    if (this.sessionId) {
      headers["Mcp-Session-Id"] = this.sessionId;
    }

    const body = JSON.stringify({
      jsonrpc: "2.0",
      id: ++this.requestId,
      method,
      params: params ?? {},
    });

    const response = await fetch(SYNAPSE_MCP_URL, {
      method: "POST",
      headers,
      body,
    });

    const nextSession = response.headers.get("Mcp-Session-Id");
    if (nextSession) {
      this.sessionId = nextSession;
    }

    const text = await response.text();
    if (!response.ok) {
      throw new Error(
        `Synapse MCP HTTP ${response.status}: ${text.slice(0, 240) || response.statusText}`,
      );
    }

    const message = parseStreamableHttpBody(text);
    if (message.error) {
      throw new Error(message.error.message || "Synapse MCP request failed");
    }
    return message.result;
  }
}
