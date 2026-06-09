import { NextResponse } from "next/server";
import {
  fetchWithTimeout,
  MEMORY_CONTEXT_TIMEOUT_MS,
  MODEL_LIST_TIMEOUT_MS,
  MODEL_PROBE_TIMEOUT_MS,
} from "@/lib/fetch-with-timeout";
import { ENABLE_AUTOMATION } from "@/lib/cyberdeck/automation-config";
import { EMPTY_TOOL_REGISTRY } from "@/lib/muthur-core/empty-tool-registry";
import type { ToolRegistry } from "@/lib/muthur-core/types";
import { getLatestMuthurObservation } from "@/lib/muthur/observation/observation-store.server";
import { handleLocalFallback, updateCachedObservation } from "@/lib/muthur/local-fallback";
import { recordProviderHealth, recordFailure } from "@/lib/muthur/health";
import {
  buildGlyphContextPrompt,
  MUTHUR_GLYPH_DOCTRINE,
} from "@/lib/muthur-glyph-doctrine";
import {
  formatOperatorChatContextPrompt,
  isDocxFileName,
  isDocumentEditIntent,
  type OperatorChatContext,
} from "@/lib/muthur/document-edit-intent";
import {
  messageNeedsOperatorContext,
  shouldEnableMuthurTools,
} from "@/lib/muthur-core/muthur-chat-intent";

const MUTHUR_AVAILABLE_TOOLS_PROMPT =
  "\n\nAVAILABLE TOOLS:" +
  "\n- observe_operator_pane: Returns the current Monaco editor state in the Operator pane (file name, language, cursor, dirty, content excerpt)." +
  "\n- suggest_operator_edit: Propose typed edits to markdown/code/text open in the operator Monaco editor. Edits auto-apply in the operator pane (Ctrl+Z to undo). Not for DOCX/PDF previews." +
  "\n- justbash: Run shell commands in the workspace (rg, git, ls, cat)." +
  "\n- localfs: Read files, mkdir, write (workspace only)." +
  "\n- clock: Server date/time." +
  "\n\nIMPORTANT: When the user asks what is in the operator pane, call observe_operator_pane." +
  "\nWhen they ask to edit/fix/rewrite/remove text from the open markdown or code file, call observe_operator_pane then suggest_operator_edit (prefer replace_line_range for targeted edits). Edits apply immediately — confirm what changed; mention Ctrl+Z if they want to undo." +
  "\nNever use justbash/find to locate the user's open document — use observe_operator_pane for the file already open in the operator pane.";

function buildDocumentEditHint(message: string, operatorContext?: OperatorChatContext | null): string {
  if (!isDocumentEditIntent(message)) return "";

  const ctxPath = operatorContext?.localFilePath?.trim() ?? "";
  const ctxName = operatorContext?.fileName?.trim() ?? "";
  const ctxSurface = operatorContext?.previewSurface ?? "";

  if (isDocxFileName(ctxName) || ctxSurface === "docx") {
    return (
      "\n\nOPERATOR HINT: User wants to edit a DOCX open in the operator pane. " +
      "Do NOT use justbash or localfs to search the filesystem. " +
      (ctxPath
        ? `Call convert_document_to_markdown with filePath "${ctxPath}", then suggest_operator_edit to remove/replace the requested text in the markdown.`
        : "Call convert_document_to_markdown on the open DOCX path, then suggest_operator_edit.") +
      " Tell the operator they can export back to DOCX when done."
    );
  }

  const obs = getLatestMuthurObservation("cyberdeck");
  const hasOpenDocument = Boolean(obs?.visibleDocument?.trim());
  const hasTextContext = Boolean(
    obs?.editor?.content?.trim() || obs?.documentExcerpt?.trim(),
  );
  if (!obs?.editor?.active && !(hasOpenDocument && hasTextContext)) {
    if (isDocxFileName(obs?.visibleDocument ?? null)) {
      return buildDocumentEditHint(message, {
        fileName: obs?.visibleDocument ?? undefined,
        previewSurface: "docx",
        localFilePath: obs?.editor?.filePath ?? undefined,
      });
    }
    return "\n\nOPERATOR HINT: User wants a document edit but no text editor is active. Open the file in the operator pane. For DOCX, convert to markdown first.";
  }
  return (
    "\n\nOPERATOR HINT: User wants an in-pane edit on the open operator document. " +
    "Call observe_operator_pane, then suggest_operator_edit to remove/replace the requested text. " +
    "Edits apply immediately — confirm what changed; Ctrl+Z undoes in the operator pane. " +
    "Do NOT search the filesystem with justbash."
  );
}

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

interface MemoryCacheEntry {
  context: string;
  queryHash: string;
  timestamp: number;
}

const _memoryContextCache = new Map<string, MemoryCacheEntry>();
const MEMORY_CONTEXT_TTL_MS = 60_000;

let muthurBootPromise: Promise<void> | null = null;

async function resolveToolRegistry(): Promise<ToolRegistry> {
  if (!ENABLE_AUTOMATION) return EMPTY_TOOL_REGISTRY;
  const { createMuthurToolRegistry } = await import("@/lib/muthur-core/tool-registry");
  return createMuthurToolRegistry();
}

function hashQuery(query: string): string {
  let hash = 0;
  const text = query.toLowerCase().trim();
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

async function ensureMuthurBooted(): Promise<void> {
  if (!muthurBootPromise) {
    muthurBootPromise = (async () => {
      const { bootMuthur } = await import("@/muthur/boot/boot_muthur");
      await bootMuthur({ workspaceRoot: process.cwd() });
    })().catch((err) => {
      muthurBootPromise = null;
      throw err;
    });
  }
  await muthurBootPromise;
}

function buildMemoryPrompt(clientMemory: unknown, serverMemory: string): string {
  const client =
    typeof clientMemory === "string" && clientMemory.trim() ? clientMemory.trim() : "";
  if (client) {
    return `\n\nPersistent MUTHUR memory:\n${client}`;
  }
  if (serverMemory.trim()) {
    return `\n\nMUTHUR Memory Context:\n${serverMemory.trim()}`;
  }
  return "";
}

function buildEditorContextPrompt(): string {
  try {
    const obs = getLatestMuthurObservation("cyberdeck");
    if (!obs) return "";
    const e = obs.editor;
    if (!e || !e.active) return "";
    const lines = [
      `\n\nOperator pane editor state:`,
      `File: ${e.fileName ?? "unknown"}`,
      `Language: ${e.language ?? "unknown"}`,
      `Dirty: ${e.dirty ? "true" : "false"}`,
      e.cursorLine != null ? `Cursor: line ${e.cursorLine}, column ${e.cursorColumn ?? 1}` : null,
      `Content excerpt: ${e.contentExcerpt ?? e.content?.slice(0, 200) ?? "(empty)"}`,
    ].filter(Boolean);
    return lines.join("\n");
  } catch {
    return "";
  }
}

function buildMuthurSystemContent(args: {
  message: string;
  operatorContext: OperatorChatContext | null;
  memoryPrompt: string;
  browserPrompt: string;
  glyphPrompt: string;
  glyphDoctrine: string;
}): { systemContent: string; toolsEnabled: boolean } {
  const toolsEnabled = shouldEnableMuthurTools(args.message);
  const needsOperator = messageNeedsOperatorContext(args.message);

  let systemContent =
    "You are MU/TH/UR 6000, the AI interface of the Echo Mirage Cyberdeck. Concise, technical, helpful.";

  if (toolsEnabled) {
    systemContent += MUTHUR_AVAILABLE_TOOLS_PROMPT;
    systemContent += buildDocumentEditHint(args.message, args.operatorContext);
    if (needsOperator) {
      systemContent += formatOperatorChatContextPrompt(args.operatorContext);
      systemContent += buildEditorContextPrompt();
    } else {
      systemContent +=
        "\n\nOnly call tools when the user asks for an action (edit a file, run a command, read the operator pane, convert a document, etc.). Do not probe the workspace or operator pane unprompted.";
    }
  } else {
    systemContent +=
      "\n\nReply conversationally in plain text. Do not call any tools for greetings or small talk.";
  }

  systemContent += args.glyphDoctrine + args.memoryPrompt + args.browserPrompt + args.glyphPrompt;

  return { systemContent, toolsEnabled };
}

async function getMuthurMemoryContext(message: string): Promise<string> {
  const queryHash = hashQuery(message);
  const now = Date.now();

  const cached = _memoryContextCache.get(queryHash);
  if (cached && now - cached.timestamp < MEMORY_CONTEXT_TTL_MS) {
    return cached.context;
  }

  try {
    await ensureMuthurBooted();
    const { buildMemoryContext } = await import("@/muthur/boot/boot_muthur");

    const ctx = await Promise.race([
      buildMemoryContext(message),
      new Promise<string>((resolve) => setTimeout(() => resolve(""), MEMORY_CONTEXT_TIMEOUT_MS)),
    ]);
    const context = ctx || "";

    if (context.trim().length > 0) {
      _memoryContextCache.set(queryHash, {
        context,
        queryHash,
        timestamp: now,
      });
    }

    for (const [key, entry] of _memoryContextCache.entries()) {
      if (now - entry.timestamp >= MEMORY_CONTEXT_TTL_MS) {
        _memoryContextCache.delete(key);
      }
    }

    return context;
  } catch {
    return "";
  }
}

const CHAT_URL: Record<string, string> = {
  opencode: "https://opencode.ai/zen/v1/chat/completions",
  openai: "https://api.openai.com/v1/chat/completions",
  openrouter: "https://openrouter.ai/api/v1/chat/completions",
};

type ChatHistoryMessage = {
  role: "user" | "assistant";
  content: string;
};

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

/** Dev-only compile warm — avoids first chat waiting on route bundling. */
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, route: "cyberdeck-chat" });
}

export async function POST(request: Request) {
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
    } = body;
    const operatorContext = parseOperatorChatContext(operatorContextRaw);
    const chatHistory = normalizeChatHistory(history);
    const clientHasMemory =
      typeof memoryContext === "string" && memoryContext.trim().length > 0;
    /** Cyberdeck always ships client memory — skip boot_muthur on the hot path. */
    const clientSentMemoryField = typeof memoryContext === "string";

    if (body.warm === true && process.env.NODE_ENV !== "production") {
      await resolveToolRegistry();
      await import("@/lib/muthur-core/muthur-provider-chat");
      return NextResponse.json({ ok: true, route: "cyberdeck-chat", warmed: true });
    }

    // Always refresh cached observation at the start of each request
    updateCachedObservation();

    // Check for local-only intents first — no provider required
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
        const res = await fetchWithTimeout(endpoint, {
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
        }, MODEL_PROBE_TIMEOUT_MS);
        const data = res.ok ? ((await res.json()) as { choices?: { message?: { content?: string } }[] }) : {};
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
        const testRes = await fetchWithTimeout(testEndpoint, {
          method: "GET",
          headers: { Authorization: `Bearer ${apiKey}` },
        }, MODEL_LIST_TIMEOUT_MS);
        return NextResponse.json({ 
          connected: testRes.ok, 
          status: testRes.status 
        }, { status: testRes.ok ? 200 : 401 });
      } catch {
        return NextResponse.json({ connected: false, error: "Network error" }, { status: 500 });
      }
    }

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

        const serverMemoryCtx =
          clientSentMemoryField || clientHasMemory ? "" : await getMuthurMemoryContext(message);
        const memoryPrompt = buildMemoryPrompt(memoryContext, serverMemoryCtx);

        const { systemContent, toolsEnabled } = buildMuthurSystemContent({
          message,
          operatorContext,
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
          registry: toolsEnabled ? await resolveToolRegistry() : EMPTY_TOOL_REGISTRY,
          toolsEnabled,
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
    const envModel = process.env.OPENCODE_MODEL || "trinity-large-preview-free";
    const endpoint = "https://opencode.ai/zen/v1/chat/completions";

    const fallbackMemoryCtx =
      clientSentMemoryField || clientHasMemory
        ? ""
        : await getMuthurMemoryContext(typeof message === "string" ? message : "");
    const fallbackMemoryPrompt = buildMemoryPrompt(memoryContext, fallbackMemoryCtx);

    const userMessage = typeof message === "string" ? message : "";
    const { systemContent, toolsEnabled } = buildMuthurSystemContent({
      message: userMessage,
      operatorContext,
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
      });
    }

    // No API key — try provider, fall back to local if it fails
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
        recordProviderHealth({ status: "failed", connected: false, lastError: `HTTP ${providerResponse.status}: ${text}` });
        recordFailure("PROVIDER_ERROR", `Provider HTTP error ${providerResponse.status}`, text);
        // Provider error — try local fallback
        const localResponse = handleLocalFallback(message as string);
        if (localResponse) return new Response(localResponse, { status: 200, headers: { "Content-Type": "text/plain" } });
        return NextResponse.json(
          { error: `API error ${providerResponse.status}: ${text}` },
          { status: 502 }
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
      // Provider failure — try local fallback
      const localResponse = handleLocalFallback(message as string);
      if (localResponse) return new Response(localResponse, { status: 200, headers: { "Content-Type": "text/plain" } });
      return NextResponse.json(
        { error: errMsg },
        { status: 503 }
      );
    }
  } catch (err) {
    console.error("[api/cyberdeck-chat][error]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
