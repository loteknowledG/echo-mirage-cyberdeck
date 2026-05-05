import { NextResponse } from "next/server";
import { runMuthurCoreLoop } from "@/lib/muthur-core/loop";
import { createMuthurToolRegistry } from "@/lib/muthur-core/tool-registry";

const textEncoder = new TextEncoder();

async function streamOpenAiCompatibleResponse(response: Response) {
  const contentType = response.headers.get("content-type") || "";
  const body = response.body;

  if (!body) {
    return new ReadableStream<Uint8Array>({
      start(controller) {
        controller.close();
      },
    });
  }

  if (!contentType.includes("text/event-stream")) {
    return new ReadableStream<Uint8Array>({
      async start(controller) {
        const reader = body.getReader();
        const decoder = new TextDecoder();
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            const text = decoder.decode(value, { stream: true });
            if (text) controller.enqueue(textEncoder.encode(text));
          }
          const rest = decoder.decode();
          if (rest) controller.enqueue(textEncoder.encode(rest));
        } finally {
          controller.close();
        }
      },
    });
  }

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      const emit = (text: string) => {
        if (!text) return;
        controller.enqueue(textEncoder.encode(text));
      };

      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split(/\r?\n/);
          buffer = lines.pop() ?? "";

          for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line || !line.startsWith("data:")) continue;

            const data = line.slice(5).trim();
            if (data === "[DONE]") {
              controller.close();
              return;
            }

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content || "";
              emit(content);
            } catch {
              // Skip malformed JSON
            }
          }
        }
      } finally {
        controller.close();
      }
    },
  });
}

const CHAT_URL: Record<string, string> = {
  opencode: "https://opencode.ai/zen/v1/chat/completions",
  openai: "https://api.openai.com/v1/chat/completions",
  openrouter: "https://openrouter.ai/api/v1/chat/completions",
};

const DEFAULT_PROVIDER_KEY_ENV: Record<string, string | undefined> = {
  opencode: process.env.OPENCODE_API_KEY || process.env.ZEN_API_KEY || process.env.NEXT_PUBLIC_ZEN_API_KEY,
  openai: process.env.OPENAI_API_KEY,
  openrouter: process.env.OPENROUTER_API_KEY,
};

function resolveProviderApiKey(provider: string, suppliedApiKey: unknown): string {
  if (typeof suppliedApiKey === "string" && suppliedApiKey.trim()) {
    return suppliedApiKey.trim();
  }
  const envKey = DEFAULT_PROVIDER_KEY_ENV[provider];
  if (typeof envKey === "string" && envKey.trim()) {
    return envKey.trim();
  }
  return "";
}

function formatToolResult(result: unknown): string {
  if (!result || typeof result !== "object") {
    return "[TOOL] justbash returned no output.";
  }

  const payload = result as {
    command?: string;
    cwd?: string;
    stdout?: string;
    stderr?: string;
    exitCode?: number;
  };

  const parts = [
    "[TOOL] JUSTBASH // WORKSPACE MIRROR",
    payload.command ? `COMMAND // ${payload.command}` : null,
    payload.cwd ? `CWD // ${payload.cwd}` : null,
    typeof payload.exitCode === "number" ? `EXIT // ${payload.exitCode}` : null,
    payload.stdout ? `STDOUT\n${payload.stdout.trimEnd()}` : null,
    payload.stderr ? `STDERR\n${payload.stderr.trimEnd()}` : null,
  ].filter(Boolean);

  return parts.join("\n\n");
}

function formatLocalFsResult(result: unknown): string {
  if (!result || typeof result !== "object") {
    return "[TOOL] LOCALFS returned no output.";
  }

  const payload = result as {
    action?: string;
    path?: string;
    entries?: string[];
    content?: string;
    isDirectory?: boolean;
    size?: number;
    modifiedAt?: string;
  };

  const parts = [
    "[TOOL] LOCALFS // CLIENT MACHINE",
    payload.action ? `ACTION // ${payload.action.toUpperCase()}` : null,
    payload.path ? `PATH // ${payload.path}` : null,
    Array.isArray(payload.entries) ? `ENTRIES\n${payload.entries.join("\n")}` : null,
    typeof payload.content === "string" ? `CONTENT\n${payload.content.trimEnd()}` : null,
    typeof payload.isDirectory === "boolean" ? `DIRECTORY // ${payload.isDirectory ? "YES" : "NO"}` : null,
    typeof payload.size === "number" ? `SIZE // ${payload.size}` : null,
    payload.modifiedAt ? `MODIFIED // ${payload.modifiedAt}` : null,
  ].filter(Boolean);

  return parts.join("\n\n");
}

function formatClockResult(result: unknown): string {
  if (!result || typeof result !== "object") {
    return "[TOOL] CLOCK returned no output.";
  }

  const payload = result as {
    mode?: string;
    iso?: string;
    local?: string;
    time?: string;
    date?: string;
  };

  const parts = [
    "[TOOL] CLOCK // SERVER TIME",
    payload.mode ? `MODE // ${payload.mode.toUpperCase()}` : null,
    payload.time ? `TIME // ${payload.time}` : null,
    payload.date ? `DATE // ${payload.date}` : null,
    payload.local ? `LOCAL // ${payload.local}` : null,
    payload.iso ? `ISO // ${payload.iso}` : null,
  ].filter(Boolean);

  return parts.join("\n\n");
}

function summarizeToolResult(
  toolName: string,
  intent: string,
  output: unknown,
): string {
  if (toolName === "localfs" && output && typeof output === "object") {
    const payload = output as {
      action?: string;
      path?: string;
      entries?: string[];
      content?: string;
      isDirectory?: boolean;
      size?: number;
      modifiedAt?: string;
    };

    if (payload.action === "ls" && Array.isArray(payload.entries)) {
      const preview = payload.entries.slice(0, 12).join(", ");
      const more = payload.entries.length > 12 ? `, plus ${payload.entries.length - 12} more` : "";
      return `Acknowledged. I inspected ${payload.path}. ${payload.entries.length} entries visible: ${preview}${more}.`;
    }

    if (payload.action === "cat" && typeof payload.content === "string") {
      const snippet = payload.content.trim().slice(0, 500);
      return `Acknowledged. I opened ${payload.path}.\n\n${snippet}${payload.content.trim().length > snippet.length ? "\n…" : ""}`;
    }

    if (payload.action === "stat") {
      return `Acknowledged. ${payload.path} ${payload.isDirectory ? "is a directory" : "is a file"}${typeof payload.size === "number" ? `, size ${payload.size} bytes` : ""}${payload.modifiedAt ? `, modified ${payload.modifiedAt}` : ""}.`;
    }
  }

  if (toolName === "justbash" && output && typeof output === "object") {
    const payload = output as {
      command?: string;
      stdout?: string;
      stderr?: string;
      exitCode?: number;
    };
    const body = (payload.stdout || payload.stderr || "").trim();
    if ((payload.command || "").startsWith("rg ") && payload.exitCode === 0) {
      const hits = body
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
      if (hits.length === 0) {
        return "Negative. No matching files were found in the workspace.";
      }
      const preview = hits.slice(0, 12).join("\n");
      const more = hits.length > 12 ? `\n…plus ${hits.length - 12} more.` : "";
      return `Affirmative. I found ${hits.length} matching file${hits.length === 1 ? "" : "s"} in the workspace.\n\n${preview}${more}`;
    }
    const snippet = body.slice(0, 800);
    return `Acknowledged. I inspected the workspace with \`${payload.command || "just-bash"}\`.\n\n${snippet}${body.length > snippet.length ? "\n…" : ""}`;
  }

  if (toolName === "clock" && output && typeof output === "object") {
    const payload = output as {
      mode?: string;
      local?: string;
      time?: string;
      date?: string;
    };

    if (payload.mode === "time" && payload.time) {
      return `Current local time: ${payload.time}.`;
    }

    if (payload.mode === "date" && payload.date) {
      return `Current local date: ${payload.date}.`;
    }

    if (payload.local) {
      return `Current local date and time: ${payload.local}.`;
    }
  }

  return `Acknowledged. I used ${toolName} to inspect that request: ${intent}`;
}

function defaultModelForProvider(provider: string): string {
  if (provider === "openai") return "gpt-4o-mini";
  if (provider === "openrouter") return "openai/gpt-4o-mini";
  return "trinity-large-preview-free";
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { message, provider, apiKey, testMode, probe, model: modelFromBody, memoryContext } = body;
    const memoryPrompt =
      typeof memoryContext === "string" && memoryContext.trim()
        ? `\n\nPersistent MUTHUR memory:\n${memoryContext.trim()}`
        : "";
    const toolRegistry = createMuthurToolRegistry();
    const loopState = runMuthurCoreLoop(typeof message === "string" ? message : "", toolRegistry);
    console.debug("[muthur-core] loop step", loopState.steps[0]);

    const firstStep = loopState.steps[0];
    if (firstStep?.action === "tool" && firstStep.toolCall) {
      const tool = toolRegistry.tools[firstStep.toolCall.toolName];
      if (!tool) {
        return NextResponse.json({ error: `Tool not found: ${firstStep.toolCall.toolName}` }, { status: 500 });
      }

      const toolResult = await tool.run(firstStep.toolCall);
      const originalMessage = typeof message === "string" ? message.trim() : "";
      const explicitToolUse = /^(?:\/bash|bash:|\/local|local:)\b/i.test(originalMessage);
      const failureLabel =
        firstStep.toolCall.toolName === "localfs" ? "[TOOL] LOCALFS FAILURE" : "[TOOL] JUSTBASH FAILURE";
      const bodyText = toolResult.ok
        ? !explicitToolUse
          ? summarizeToolResult(firstStep.toolCall.toolName, originalMessage, toolResult.output)
          : firstStep.toolCall.toolName === "localfs"
            ? formatLocalFsResult(toolResult.output)
            : firstStep.toolCall.toolName === "clock"
              ? formatClockResult(toolResult.output)
            : formatToolResult(toolResult.output)
        : `${failureLabel}\n\n${toolResult.error || "Unknown tool error."}`;

      console.debug("[muthur-tools] response branch", {
        tool: firstStep.toolCall.toolName,
        explicitToolUse,
        preview: bodyText.slice(0, 140),
      });

      return new Response(bodyText, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
        },
      });
    }

    // Model probe (non-stream), same contract as weyland-yutani transmit chat stream:false
    if (probe === true && provider && modelFromBody) {
      const endpoint = CHAT_URL[provider as string];
      const resolvedApiKey = resolveProviderApiKey(String(provider), apiKey);
      if (!endpoint) {
        return NextResponse.json({ ok: false, valid: false, status: 400 }, { status: 400 });
      }
      if (!resolvedApiKey) {
        return NextResponse.json({ ok: false, valid: false, status: 401 }, { status: 401 });
      }
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resolvedApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: modelFromBody,
            messages: [
              { role: "system", content: "Reply with exactly OK." },
              { role: "user", content: "probe" },
            ],
            max_tokens: 8,
            temperature: 0,
            stream: false,
          }),
        });
        const data = res.ok ? ((await res.json()) as { choices?: { message?: { content?: string } }[] }) : {};
        const content = String(data?.choices?.[0]?.message?.content || "").trim();
        return NextResponse.json({
          ok: res.ok,
          status: res.status,
          valid: content.length > 0,
          rateLimited: res.status === 429,
        });
      } catch {
        return NextResponse.json({ ok: false, valid: false, status: 0 }, { status: 500 });
      }
    }

    if (!message && !testMode) {
      return NextResponse.json({ error: "Message required" }, { status: 400 });
    }

    // Handle test mode (provider connection validation)
    if (testMode) {
      if (!apiKey) {
        return NextResponse.json({ error: "API key required" }, { status: 400 });
      }
      const testEndpoint =
        provider === "opencode"
          ? "https://opencode.ai/zen/v1/models"
          : provider === "openai"
            ? "https://api.openai.com/v1/models"
            : provider === "openrouter"
              ? "https://openrouter.ai/api/v1/models"
              : provider === "anthropic"
                ? "https://api.anthropic.com/v1/models"
                : null;
      
      if (!testEndpoint) {
        return NextResponse.json({ connected: true }, { status: 200 });
      }

      try {
        const testRes = await fetch(testEndpoint, {
          method: "GET",
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        return NextResponse.json({ 
          connected: testRes.ok, 
          status: testRes.status 
        }, { status: testRes.ok ? 200 : 401 });
      } catch {
        return NextResponse.json({ connected: false, error: "Network error" }, { status: 500 });
      }
    }

    const normalizedMsg = typeof message === "string" ? message.toLowerCase().trim() : "";

    // User session: stream via selected provider (keys from client)
    if (provider && typeof message === "string" && message.trim()) {
      const endpoint = CHAT_URL[provider as string];
      const resolvedApiKey = resolveProviderApiKey(String(provider), apiKey);
      if (endpoint) {
        if (!resolvedApiKey) {
          return NextResponse.json({ error: "API key required" }, { status: 401 });
        }
        if (normalizedMsg === "providers" || normalizedMsg === "connect providers" || normalizedMsg === "provider") {
          return NextResponse.json({
            type: "providers",
            data: [
              { id: "opencode", name: "OpenCode", description: "Zen uplink", status: "ready" },
              { id: "openrouter", name: "OpenRouter", description: "Model mesh", status: "config" },
              { id: "openai", name: "OpenAI", description: "GPT family", status: "config" },
            ],
          });
        }

        if (normalizedMsg === "models" || normalizedMsg === "list models" || normalizedMsg === "available models") {
          return NextResponse.json({
            type: "models",
            data: [
              { id: "trinity-large-preview-free", name: "Trinity Large", provider: "opencode", status: "active" },
              { id: "gpt-4o-mini", name: "GPT-4o mini", provider: "openai", status: "active" },
            ],
          });
        }

        if (normalizedMsg === "status" || normalizedMsg === "connection status") {
          return NextResponse.json({
            type: "status",
            data: {
              provider,
              model: modelFromBody || defaultModelForProvider(provider),
              connection: "active",
              memory: "—",
            },
          });
        }

        const model =
          (typeof modelFromBody === "string" && modelFromBody.trim()) || defaultModelForProvider(provider);

        const providerResponse = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${resolvedApiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [
              {
                role: "system",
                content:
                  "You are MU/TH/UR 6000, the AI interface of the Echo Mirage Cyberdeck. Concise, technical, helpful." +
                  memoryPrompt,
              },
              { role: "user", content: message },
            ],
            stream: true,
          }),
        });

        if (!providerResponse.ok) {
          const text = await providerResponse.text().catch(() => "");
          return NextResponse.json(
            { error: `API error ${providerResponse.status}: ${text}` },
            { status: 502 },
          );
        }

        return new Response(await streamOpenAiCompatibleResponse(providerResponse), {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
          },
        });
      }
    }

    // Handle providers command (no user session)
    if (normalizedMsg === "providers" || normalizedMsg === "connect providers" || normalizedMsg === "provider") {
      return NextResponse.json({
        type: "providers",
        data: [
          { id: "opencode", name: "OpenCode", description: "Default AI provider", status: "ready" },
          { id: "openai", name: "OpenAI", description: "GPT-4 and variants", status: "config" },
          { id: "anthropic", name: "Anthropic", description: "Claude models", status: "config" },
          { id: "ollama", name: "Ollama", description: "Local models", status: "config" },
        ],
      });
    }

    // Handle models command
    if (normalizedMsg === "models" || normalizedMsg === "list models" || normalizedMsg === "available models") {
      return NextResponse.json({
        type: "models",
        data: [
          { id: "trinity-large-preview-free", name: "Trinity Large", provider: "opencode", status: "active" },
          { id: "gpt-4", name: "GPT-4", provider: "openai", status: "config" },
          { id: "gpt-4-turbo", name: "GPT-4 Turbo", provider: "openai", status: "config" },
          { id: "claude-3-opus", name: "Claude 3 Opus", provider: "anthropic", status: "config" },
          { id: "claude-3-sonnet", name: "Claude 3 Sonnet", provider: "anthropic", status: "config" },
          { id: "llama3", name: "Llama 3", provider: "ollama", status: "config" },
          { id: "mistral", name: "Mistral", provider: "ollama", status: "config" },
        ],
      });
    }

    // Handle status command
    if (normalizedMsg === "status" || normalizedMsg === "connection status") {
      return NextResponse.json({
        type: "status",
        data: {
          provider: "opencode",
          model: "trinity-large-preview-free",
          connection: "active",
          memory: "12 moments",
        },
      });
    }

    // Get API config from env or default to opencode
    const envApiKey = process.env.OPENCODE_API_KEY || process.env.ZEN_API_KEY || process.env.NEXT_PUBLIC_ZEN_API_KEY || "";
    const model = process.env.OPENCODE_MODEL || "trinity-large-preview-free";
    const endpoint = "https://opencode.ai/zen/v1/chat/completions";

    const providerResponse = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(!envApiKey ? {} : { Authorization: `Bearer ${envApiKey}` }),
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content:
              "You are MU/TH/UR 6000, the AI interface of the Echo Mirage Cyberdeck. Concise, technical, helpful." +
              memoryPrompt,
          },
          { role: "user", content: message },
        ],
        stream: true,
      }),
    });

    if (!providerResponse.ok) {
      const text = await providerResponse.text().catch(() => "");
      return NextResponse.json(
        { error: `API error ${providerResponse.status}: ${text}` },
        { status: 502 }
      );
    }

    return new Response(await streamOpenAiCompatibleResponse(providerResponse), {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    console.error("[api/cyberdeck-chat][error]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
