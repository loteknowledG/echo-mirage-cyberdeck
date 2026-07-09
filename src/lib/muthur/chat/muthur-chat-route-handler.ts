import { NextResponse } from "next/server";
import { readOpenCodeZenApiKeyFromEnv } from "@/lib/opencode-provider-env";
import {
  fetchWithTimeout,
  MODEL_LIST_TIMEOUT_MS,
  MODEL_PROBE_TIMEOUT_MS,
} from "@/lib/fetch-with-timeout";
import { ENABLE_AUTOMATION } from "@/lib/cyberdeck/automation-config";
import { EMPTY_TOOL_REGISTRY } from "@/lib/muthur-core/empty-tool-registry";
import type { ToolRegistry } from "@/lib/muthur-core/types";
import { handleLocalFallback, updateCachedObservation } from "@/lib/muthur/local-fallback";
import { recordProviderHealth, recordFailure } from "@/lib/muthur/health";
import {
  buildGlyphContextPrompt,
  MUTHUR_GLYPH_DOCTRINE,
} from "@/lib/muthur-glyph-doctrine";
import { buildMemoryPrompt } from "@/muthur/memory/chat-memory";
import type { OperatorChatContext } from "@/lib/muthur/document-edit-intent";
import { normalizeMuthurPosture } from "@/lib/muthur/muthur-posture";
import { buildMuthurSystemContent } from "@/lib/muthur/chat/muthur-chat-posture";
import { getMuthurChatMemoryContext } from "@/lib/muthur/chat/muthur-chat-memory-context";
import {
  buildProviderReceipt,
  providerResponseHeaders,
  resolveServerProviderCredentials,
} from "@/lib/server/provider-credentials.server";
import { detectProviderModelMismatch } from "@/lib/server/provider-upstream-headers.server";

const CHAT_URL: Record<string, string> = {
  opencode: "https://opencode.ai/zen/v1/chat/completions",
  openai: "https://api.openai.com/v1/chat/completions",
  openrouter: "https://openrouter.ai/api/v1/chat/completions",
};

type ChatHistoryMessage = {
  role: "user" | "assistant";
  content: string;
};

async function chatWithModelTools(
  ...args: Parameters<(typeof import("@/lib/muthur-core/muthur-provider-chat"))["muthurChatWithModelTools"]>
) {
  const { muthurChatWithModelTools } = await import("@/lib/muthur-core/muthur-provider-chat");
  return muthurChatWithModelTools(...args);
}

async function streamProviderResponse(response: Response) {
  const { streamOpenAiCompatibleResponse } = await import("@/lib/muthur-core/stream-openai-response");
  return streamOpenAiCompatibleResponse(response);
}

async function resolveToolRegistry(): Promise<ToolRegistry> {
  if (!ENABLE_AUTOMATION) return EMPTY_TOOL_REGISTRY;
  const { createMuthurToolRegistry } = await import("@/lib/muthur-core/tool-registry");
  return createMuthurToolRegistry();
}

function normalizeChatHistory(history: unknown, limit = 8): ChatHistoryMessage[] {
  if (!Array.isArray(history)) return [];

  return history
    .map((entry) => ({
      role: entry?.role === "assistant" ? "assistant" : entry?.role === "user" ? "user" : null,
      content: typeof entry?.content === "string" ? entry.content.trim() : "",
    }))
    .filter((entry): entry is ChatHistoryMessage => Boolean(entry.role && entry.content))
    .slice(-limit);
}

function defaultModelForProvider(provider: string): string {
  if (provider === "openai") return "gpt-4o-mini";
  if (provider === "openrouter") return "openai/gpt-4o-mini";
  return "trinity-large-preview-free";
}

function parseOperatorChatContext(raw: unknown): OperatorChatContext | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  return {
    previewSurface: typeof o.previewSurface === "string" ? o.previewSurface : null,
    fileName: typeof o.fileName === "string" ? o.fileName : null,
    localFilePath: typeof o.localFilePath === "string" ? o.localFilePath : null,
    docMode: o.docMode === "view" || o.docMode === "edit" ? o.docMode : null,
  };
}

function respondProvidersList(sessionScoped: boolean) {
  return NextResponse.json({
    type: "providers",
    data: sessionScoped
      ? [
          { id: "opencode", name: "OpenCode", description: "Zen uplink", status: "ready" },
          { id: "openrouter", name: "OpenRouter", description: "Model mesh", status: "config" },
          { id: "openai", name: "OpenAI", description: "GPT family", status: "config" },
        ]
      : [
          { id: "opencode", name: "OpenCode", description: "Default AI provider", status: "ready" },
          { id: "openai", name: "OpenAI", description: "GPT-4 and variants", status: "config" },
          { id: "anthropic", name: "Anthropic", description: "Claude models", status: "config" },
          { id: "ollama", name: "Ollama", description: "Local models", status: "config" },
        ],
  });
}

function respondModelsList(sessionScoped: boolean) {
  return NextResponse.json({
    type: "models",
    data: sessionScoped
      ? [
          { id: "trinity-large-preview-free", name: "Trinity Large", provider: "opencode", status: "active" },
          { id: "gpt-4o-mini", name: "GPT-4o mini", provider: "openai", status: "active" },
        ]
      : [
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

function respondStatusList(options: {
  sessionScoped: boolean;
  provider?: string;
  model?: string;
}) {
  return NextResponse.json({
    type: "status",
    data: options.sessionScoped
      ? {
          provider: options.provider,
          model: options.model || defaultModelForProvider(String(options.provider)),
          connection: "active",
          memory: "—",
        }
      : {
          provider: "opencode",
          model: "trinity-large-preview-free",
          connection: "active",
          memory: "12 moments",
        },
  });
}

function isProvidersCommand(normalizedMsg: string): boolean {
  return (
    normalizedMsg === "providers" ||
    normalizedMsg === "connect providers" ||
    normalizedMsg === "provider"
  );
}

function isModelsCommand(normalizedMsg: string): boolean {
  return (
    normalizedMsg === "models" ||
    normalizedMsg === "list models" ||
    normalizedMsg === "available models"
  );
}

function isStatusCommand(normalizedMsg: string): boolean {
  return normalizedMsg === "status" || normalizedMsg === "connection status";
}

async function handleModelProbe(body: {
  provider: unknown;
  apiKey: unknown;
  modelFromBody: unknown;
}) {
  const { provider, apiKey, modelFromBody } = body;
  const endpoint = CHAT_URL[provider as string];
  const resolvedApiKey = resolveServerProviderCredentials(String(provider), apiKey).apiKey;
  if (!endpoint) {
    return NextResponse.json({ ok: false, valid: false, status: 400 }, { status: 400 });
  }
  if (!resolvedApiKey) {
    return NextResponse.json({ ok: false, valid: false, status: 401 }, { status: 401 });
  }
  try {
    const res = await fetchWithTimeout(
      endpoint,
      {
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
      },
      MODEL_PROBE_TIMEOUT_MS,
    );
    const data = res.ok
      ? ((await res.json()) as { choices?: { message?: { content?: string } }[] })
      : {};
    const content = String(data?.choices?.[0]?.message?.content || "").trim();
    return NextResponse.json({
      ok: res.ok,
      status: res.status,
      valid: content.length > 0,
      rateLimited: res.status === 429,
    });
  } catch (err) {
    const timedOut = err instanceof Error && err.message.includes("timed out");
    return NextResponse.json(
      { ok: false, valid: false, status: timedOut ? 408 : 0, rateLimited: false },
      { status: timedOut ? 408 : 500 },
    );
  }
}

async function handleTestMode(provider: unknown, apiKey: unknown) {
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
    const testRes = await fetchWithTimeout(
      testEndpoint,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${apiKey}` },
      },
      MODEL_LIST_TIMEOUT_MS,
    );
    return NextResponse.json(
      {
        connected: testRes.ok,
        status: testRes.status,
      },
      { status: testRes.ok ? 200 : 401 },
    );
  } catch {
    return NextResponse.json({ connected: false, error: "Network error" }, { status: 500 });
  }
}

/** Dev-only compile warm — avoids first chat waiting on route bundling. */
export async function handleCyberdeckChatGet() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, route: "cyberdeck-chat" });
}

export async function handleCyberdeckChatPost(request: Request) {
  try {
    const body = await request.json();
    const {
      message,
      provider,
      apiKey,
      testMode,
      probe,
      model: modelFromBody,
      memoryContext,
      browserContext,
      glyphContext,
      history,
      operatorContext: operatorContextRaw,
      posture: postureRaw,
      uplinkMode: legacyPostureRaw,
      commanderMissionActive: commanderMissionActiveRaw,
    } = body;
    const operatorContext = parseOperatorChatContext(operatorContextRaw);
    const posture = normalizeMuthurPosture(postureRaw ?? legacyPostureRaw);
    const commanderMissionActive = commanderMissionActiveRaw === true;
    const chatHistory = normalizeChatHistory(history);
    const toolRegistryPrefetch = ENABLE_AUTOMATION
      ? resolveToolRegistry()
      : Promise.resolve(EMPTY_TOOL_REGISTRY);

    if (body.warm === true && process.env.NODE_ENV !== "production") {
      await resolveToolRegistry();
      await import("@/lib/muthur-core/muthur-provider-chat");
      return NextResponse.json({ ok: true, route: "cyberdeck-chat", warmed: true });
    }

    updateCachedObservation();

    const normalizedMsg = typeof message === "string" ? message.toLowerCase().trim() : "";
    const localFallback = handleLocalFallback(message as string);
    if (localFallback && !chatHistory.length) {
      return new Response(localFallback, {
        status: 200,
        headers: { "Content-Type": "text/plain", "X-Muthur-Local-Fallback": "true" },
      });
    }

    const browserPrompt =
      typeof browserContext === "string" && browserContext.trim()
        ? `\n\nLive browser pane snapshot:\n${browserContext.trim()}`
        : "";
    const glyphPrompt = buildGlyphContextPrompt(
      typeof glyphContext === "string" ? glyphContext : "",
    );
    const glyphDoctrine = `\n\n${MUTHUR_GLYPH_DOCTRINE}`;

    if (probe === true && provider && modelFromBody) {
      return handleModelProbe({ provider, apiKey, modelFromBody });
    }

    if (!message && !testMode) {
      return NextResponse.json({ error: "Message required" }, { status: 400 });
    }

    if (testMode) {
      return handleTestMode(provider, apiKey);
    }

    if (provider && typeof message === "string" && message.trim()) {
      const endpoint = CHAT_URL[provider as string];
      const providerId = String(provider);
      const { apiKey: resolvedApiKey, credentialSource } = resolveServerProviderCredentials(
        providerId,
        apiKey,
      );
      if (endpoint) {
        const model =
          (typeof modelFromBody === "string" && modelFromBody.trim()) ||
          defaultModelForProvider(providerId);

        const modelMismatch = detectProviderModelMismatch(providerId, model);
        if (modelMismatch) {
          const receipt = buildProviderReceipt({
            provider: providerId,
            model,
            credentialSource,
            auth: "failed",
            reason: "model_mismatch",
          });
          return new Response(modelMismatch, {
            status: 400,
            headers: {
              "Content-Type": "text/plain; charset=utf-8",
              ...providerResponseHeaders(receipt),
            },
          });
        }

        if (!resolvedApiKey) {
          const receipt = buildProviderReceipt({
            provider: providerId,
            model,
            credentialSource: "none",
            auth: "failed",
            reason: "no_key",
          });
          return NextResponse.json(
            {
              error: "API key required",
              code: "NO_PROVIDER_KEY",
              credential_source: "none",
              reason: "no_key",
              receipt,
            },
            {
              status: 401,
              headers: providerResponseHeaders(receipt),
            },
          );
        }

        if (isProvidersCommand(normalizedMsg)) {
          return respondProvidersList(true);
        }
        if (isModelsCommand(normalizedMsg)) {
          return respondModelsList(true);
        }
        if (isStatusCommand(normalizedMsg)) {
          return respondStatusList({
            sessionScoped: true,
            provider: providerId,
            model: typeof modelFromBody === "string" ? modelFromBody : undefined,
          });
        }

        const serverMemoryCtx = await getMuthurChatMemoryContext(message, memoryContext);
        const memoryPrompt = buildMemoryPrompt(memoryContext, serverMemoryCtx);

        const providerReceipt = buildProviderReceipt({
          provider: providerId,
          model,
          credentialSource,
          auth: "success",
        });

        const { systemContent, toolsEnabled } = buildMuthurSystemContent({
          message,
          operatorContext,
          posture,
          commanderMissionActive,
          memoryPrompt,
          browserPrompt,
          glyphPrompt,
          glyphDoctrine,
        });

        const baseMessages: Record<string, unknown>[] = [
          { role: "system", content: systemContent },
          ...chatHistory.map((m) => ({ role: m.role, content: m.content })),
          { role: "user", content: message },
        ];

        return await chatWithModelTools({
          endpoint,
          apiKey: resolvedApiKey,
          model,
          baseMessages,
          registry: toolsEnabled ? await toolRegistryPrefetch : EMPTY_TOOL_REGISTRY,
          toolsEnabled,
          posture,
          commanderMissionActive,
          providerReceipt,
          providerId,
        });
      }
    }

    if (isProvidersCommand(normalizedMsg)) {
      return respondProvidersList(false);
    }
    if (isModelsCommand(normalizedMsg)) {
      return respondModelsList(false);
    }
    if (isStatusCommand(normalizedMsg)) {
      return respondStatusList({ sessionScoped: false });
    }

    const envApiKey = readOpenCodeZenApiKeyFromEnv();
    const envModel = process.env.OPENCODE_MODEL || "trinity-large-preview-free";
    const endpoint = "https://opencode.ai/zen/v1/chat/completions";

    const fallbackMemoryCtx = await getMuthurChatMemoryContext(
      typeof message === "string" ? message : "",
      memoryContext,
    );
    const fallbackMemoryPrompt = buildMemoryPrompt(memoryContext, fallbackMemoryCtx);

    const userMessage = typeof message === "string" ? message : "";
    const { systemContent, toolsEnabled } = buildMuthurSystemContent({
      message: userMessage,
      operatorContext,
      posture,
      commanderMissionActive,
      memoryPrompt: fallbackMemoryPrompt,
      browserPrompt,
      glyphPrompt,
      glyphDoctrine,
    });

    const baseMessages: Record<string, unknown>[] = [
      { role: "system", content: systemContent },
      ...chatHistory.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: userMessage },
    ];

    if (envApiKey.trim()) {
      return await chatWithModelTools({
        endpoint,
        apiKey: envApiKey.trim(),
        model: envModel,
        baseMessages,
        registry: toolsEnabled ? await resolveToolRegistry() : EMPTY_TOOL_REGISTRY,
        toolsEnabled,
        posture,
        commanderMissionActive,
      });
    }

    try {
      const providerResponse = await fetchWithTimeout(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: envModel,
          messages: [
            {
              role: "system",
              content: systemContent,
            },
            ...chatHistory,
            { role: "user", content: message },
          ],
          stream: true,
        }),
      });

      if (!providerResponse.ok) {
        const text = await providerResponse.text().catch(() => "");
        recordProviderHealth({
          status: "failed",
          connected: false,
          lastError: `HTTP ${providerResponse.status}: ${text}`,
        });
        recordFailure("PROVIDER_ERROR", `Provider HTTP error ${providerResponse.status}`, text);
        const localResponse = handleLocalFallback(message as string);
        if (localResponse) {
          return new Response(localResponse, {
            status: 200,
            headers: { "Content-Type": "text/plain" },
          });
        }
        return NextResponse.json(
          { error: `API error ${providerResponse.status}: ${text}` },
          { status: 502 },
        );
      }

      recordProviderHealth({ status: "healthy", connected: true, lastSuccessAt: Date.now() });
      return new Response(await streamProviderResponse(providerResponse), {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        },
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Provider unavailable";
      recordProviderHealth({ status: "failed", connected: false, lastError: errMsg });
      recordFailure("NETWORK_ERROR", errMsg);
      const localResponse = handleLocalFallback(message as string);
      if (localResponse) {
        return new Response(localResponse, { status: 200, headers: { "Content-Type": "text/plain" } });
      }
      return NextResponse.json({ error: errMsg }, { status: 503 });
    }
  } catch (err) {
    console.error("[api/cyberdeck-chat][error]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}
