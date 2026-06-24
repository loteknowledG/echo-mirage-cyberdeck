import { NextResponse } from "next/server";
import { readOpenCodeZenApiKeyFromEnv } from "@/lib/opencode-provider-env";
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
import { buildMemoryPrompt } from "@/muthur/memory/chat-memory";
import {
  formatOperatorChatContextPrompt,
  isDocxFileName,
  isDocumentEditIntent,
  isOperatorPaneEditRequest,
  type OperatorChatContext,
} from "@/lib/muthur/document-edit-intent";
import {
  isCasualMuthurChat,
  messageNeedsOperatorContext,
  shouldEnableMuthurTools,
} from "@/lib/muthur-core/muthur-chat-intent";
import {
  buildMuthurPostureSystemPrompt,
  normalizeMuthurPosture,
  shouldEnableToolsForPosture,
  type MuthurPosture,
} from "@/lib/muthur/muthur-posture";
import { MUTHUR_PI_CONTROL_DOCTRINE } from "@/lib/muthur/control/muthur-control-doctrine";
import { isMuthurDirectPiComputerUseEnabled } from "@/lib/muthur/control/muthur-direct-pi-computer-use";
import { isCalyxMuthurToolsEnabled } from "@/lib/muthur/calyx/calyx-muthur-tools.server";
import { PI_COMPUTER_USE_DOCTRINE } from "@/lib/pi/pi-computer-use-doctrine";
import { messageReferencesLocalPath } from "@/lib/browser-intents";
import {
  buildProviderReceipt,
  classifyProviderAuthFailure,
  formatProviderReceiptHeader,
  providerResponseHeaders,
  resolveServerProviderCredentials,
} from "@/lib/server/provider-credentials.server";

const MUTHUR_COGNITION_DOCTRINE =
  "\n\nCOGNITION: You interpret operator intent and choose tools. The deck does not pre-run browser searches, file reads, or conversions from regex on the operator's message — call tools yourself (localfs, operator_browser, observe_operator_pane, etc.). Do not emit [GLYPH:...] unless the operator explicitly asked for a glyph render.";

function buildMuthurAvailableToolsPrompt(): string {
  const directPi = isMuthurDirectPiComputerUseEnabled();
  const calyx = isCalyxMuthurToolsEnabled();
  return (
    "\n\nAVAILABLE TOOLS:" +
    "\n- observe_operator_pane: Returns the current Monaco editor state in the Operator pane (file name, language, cursor, dirty, content excerpt)." +
    "\n- open_operator_file: Open a workspace text/markdown/code file in the operator Monaco editor on the operator's screen. Call before suggest_operator_edit when nothing is open." +
    "\n- suggest_operator_edit: Propose typed edits to markdown/code/text open in the operator Monaco editor. Edits auto-apply in the operator pane (Ctrl+Z to undo). Not for DOCX/PDF previews." +
    "\n- operator_browser: Operator web pane — goto URL or search query, snapshot page text, back/forward/reload, click/type/submit. Not for local disk paths." +
    "\n- localfs: REAL disk — read anywhere; mkdir/write only inside the Echo Mirage repo. Use write to create or update source files." +
    "\n- workspace_exec: REAL disk — allowlisted commands only (pnpm exec tsc --noEmit, pnpm lint, pnpm build, git diff, git log, etc.). Run after edits to verify." +
    "\n- git_status / git_diff: REAL disk — inspect repo changes after coding." +
    "\n- justbash: EPHEMERAL mirror only — rg/ls/cat search; writes do NOT persist. Never use for pnpm, git, or file changes." +
    "\n- clock: Server date/time." +
    "\n- request_pi_control_lease: Request operator grant for Pi desktop embodiment (mouse/keyboard/screen) before computer-use missions." +
    (directPi
      ? "\n- pi_computer_use: Execute one Synapse desktop action (screenshot, click, type, hotkey, scroll, move) under an active control lease."
      : "\n- delegate_pi_computer_use: Delegate approved missions to Pi under an active control lease.") +
    (calyx
      ? "\n- calyx_ingest / calyx_search / calyx_kernel_answer: Local Calyx vault (echo-mirage) for grounded ingest, multi-lens search, and kernel answers."
      : "") +
    "\n\nCODING ECHO MIRAGE (Phase A + B):" +
    "\n1. localfs write (or suggest_operator_edit for open operator files) to change code." +
    "\n2. git_status or git_diff to review changes." +
    "\n3. After file touches, MUTHUR auto-runs `git diff --stat` + `pnpm exec tsc --noEmit` and writes a receipt under `.muthur/receipts/coding/` — report PASS/FAIL from that receipt." +
    "\n4. You may still call workspace_exec for extra checks (lint, build) when asked." +
    "\n\nIMPORTANT: When the user asks what is currently visible in the operator pane, call observe_operator_pane." +
    "\nWhen the user says open/read/show/view a specific file (e.g. L-ARCH-001.md), resolve that file — call open_operator_file with the path and localfs cat to read it. Do NOT call observe_operator_pane for document open commands." +
    "\nWhen they ask to edit a file and Monaco is not active, call open_operator_file with the path, then suggest_operator_edit (prefer replace_line_range for targeted edits). Edits apply immediately — confirm what changed; mention Ctrl+Z if they want to undo." +
    "\nWhen a file is already open in the operator pane, NEVER use localfs write on that file — only suggest_operator_edit." +
    "\nNever use justbash/find to locate the user's open document — use observe_operator_pane for the file already open in the operator pane."
  );
}

function buildDocumentEditHint(
  message: string,
  operatorContext: OperatorChatContext | null | undefined,
  posture: MuthurPosture,
): string {
  if (!isOperatorPaneEditRequest(message, operatorContext)) return "";

  if (posture === "plan") {
    return (
      "\n\nOPERATOR HINT: User mentioned a change but MUTHUR is in PLAN posture. " +
      "Brainstorm the approach and outline steps — do NOT call suggest_operator_edit, localfs, convert, or export. " +
      "Tell the operator to switch to Agent or Commander to apply changes."
    );
  }

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
      return buildDocumentEditHint(
        message,
        {
          fileName: obs?.visibleDocument ?? undefined,
          previewSurface: "docx",
          localFilePath: obs?.editor?.filePath ?? undefined,
        },
        posture,
      );
    }
    return "\n\nOPERATOR HINT: User wants a document edit but no text editor is active. Open the file in the operator pane. For DOCX, convert to markdown first.";
  }
  const saveHint =
    posture === "agent" || posture === "commander"
      ? "Edits auto-save to disk when a writable path exists."
      : "Plan posture: observe and discuss only — switch to Agent or Commander to edit.";

  return (
    "\n\nOPERATOR HINT: User wants an in-pane edit on the open operator document. " +
    "Call observe_operator_pane, then suggest_operator_edit to remove/replace the requested text. " +
    "Do NOT use localfs write on a file already open in the operator pane — use suggest_operator_edit only. " +
    "For HTML comments or a single top line, use replace_line_range with startLine=1 endLine=1. " +
    `${saveHint} Confirm what changed; Ctrl+Z undoes in the operator pane. ` +
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
  posture: MuthurPosture;
  commanderMissionActive?: boolean;
  memoryPrompt: string;
  browserPrompt: string;
  glyphPrompt: string;
  glyphDoctrine: string;
}): { systemContent: string; toolsEnabled: boolean } {
  const toolContext =
    typeof args.commanderMissionActive === "boolean"
      ? { missionActive: args.commanderMissionActive }
      : undefined;
  const toolsEnabled =
    shouldEnableMuthurTools(args.message) &&
    shouldEnableToolsForPosture(args.posture, args.message, toolContext);
  const needsOperator = messageNeedsOperatorContext(args.message, args.operatorContext);

  let systemContent =
    "You are MU/TH/UR 6000, the AI interface of the Echo Mirage Cyberdeck. Concise, technical, helpful.";

  systemContent += buildMuthurPostureSystemPrompt(args.posture);

  if (toolsEnabled) {
    systemContent += buildMuthurAvailableToolsPrompt();
    systemContent += buildDocumentEditHint(args.message, args.operatorContext, args.posture);
    if (needsOperator) {
      systemContent += formatOperatorChatContextPrompt(args.operatorContext);
      systemContent += buildEditorContextPrompt();
    } else {
      systemContent +=
        "\n\nInterpret the operator's intent and call tools when an action is needed (read a path, browse the web, edit a file, run a command). Do not probe unprompted.";
    }
  } else if (isCasualMuthurChat(args.message)) {
    systemContent +=
      "\n\nReply conversationally. Tools are available if the operator asks for an action in the same turn.";
  } else {
    systemContent += "\n\nReply in plain text.";
  }

  systemContent += MUTHUR_COGNITION_DOCTRINE;
  if (toolsEnabled) {
    systemContent += MUTHUR_PI_CONTROL_DOCTRINE;
    if (!isMuthurDirectPiComputerUseEnabled()) {
      systemContent += PI_COMPUTER_USE_DOCTRINE;
    }
  }

  if (messageReferencesLocalPath(args.message)) {
    systemContent +=
      "\n\nThe user referenced a local filesystem path. Use localfs ls/cat/stat on that path (paths outside the Echo Mirage repo are read-only). Do NOT search the web or open a browser for disk paths.";
  }

  systemContent += args.glyphDoctrine + args.memoryPrompt + args.browserPrompt + args.glyphPrompt;

  return { systemContent, toolsEnabled };
}

async function getMuthurMemoryContext(message: string, clientMemory?: unknown): Promise<string> {
  const queryHash = hashQuery(message);
  const now = Date.now();
  const clientContext = typeof clientMemory === "string" ? clientMemory : "";

  const cached = _memoryContextCache.get(queryHash);
  if (cached && now - cached.timestamp < MEMORY_CONTEXT_TTL_MS) {
    return cached.context;
  }

  try {
    await ensureMuthurBooted();
    const { buildMemoryContext } = await import("@/muthur/boot/boot_muthur");

    const ctx = await Promise.race([
      buildMemoryContext(message, { clientContext, workspaceRoot: process.cwd() }),
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

function resolveProviderApiKey(provider: string, suppliedApiKey: unknown): string {
  return resolveServerProviderCredentials(provider, suppliedApiKey).apiKey;
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
      const providerId = String(provider);
      const { apiKey: resolvedApiKey, credentialSource } = resolveServerProviderCredentials(
        providerId,
        apiKey,
      );
      if (endpoint) {
        const model =
          (typeof modelFromBody === "string" && modelFromBody.trim()) || defaultModelForProvider(providerId);

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

        const serverMemoryCtx = await getMuthurMemoryContext(message, memoryContext);
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
    const envApiKey = readOpenCodeZenApiKeyFromEnv();
    const envModel = process.env.OPENCODE_MODEL || "trinity-large-preview-free";
    const endpoint = "https://opencode.ai/zen/v1/chat/completions";

    const fallbackMemoryCtx = await getMuthurMemoryContext(
      typeof message === "string" ? message : "",
      memoryContext
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
