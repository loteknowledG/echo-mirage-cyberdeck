'use client';

import { useEffect, useRef, useState } from "react";
import type { Context, Model, SimpleStreamOptions } from "@mariozechner/pi-ai";

type PiChatPaneBodyProps = {
  server: string;
};

declare global {
  interface Window {
    __echoMiragePiStorageReady?: boolean;
  }
}

async function ensurePiStorage(ui: typeof import("@mariozechner/pi-web-ui")) {
  if (typeof window === "undefined") return;
  if (window.__echoMiragePiStorageReady) return;

  const settings = new ui.SettingsStore();
  const providerKeys = new ui.ProviderKeysStore();
  const sessions = new ui.SessionsStore();
  const customProviders = new ui.CustomProvidersStore();

  const backend = new ui.IndexedDBStorageBackend({
    dbName: "echo-mirage-pi",
    version: 1,
    stores: [
      settings.getConfig(),
      providerKeys.getConfig(),
      sessions.getConfig(),
      customProviders.getConfig(),
      ui.SessionsStore.getMetadataConfig(),
    ],
  });

  settings.setBackend(backend);
  providerKeys.setBackend(backend);
  sessions.setBackend(backend);
  customProviders.setBackend(backend);

  ui.setAppStorage(new ui.AppStorage(settings, providerKeys, sessions, customProviders, backend));
  window.__echoMiragePiStorageReady = true;
}

async function promptForProviderKey(
  ui: typeof import("@mariozechner/pi-web-ui"),
  provider: string,
) {
  const existingKey = await ui.getAppStorage().providerKeys.get(provider);
  if (existingKey) return true;

  const enteredKey = window.prompt(`Enter ${provider.toUpperCase()} API key`);
  const trimmedKey = enteredKey?.trim();

  if (!trimmedKey) return false;

  await ui.getAppStorage().providerKeys.set(provider, trimmedKey);
  return true;
}

function createEmptyAssistantMessage(model: Model<any>) {
  return {
    role: "assistant" as const,
    content: [] as Array<{ type: "text"; text: string }>,
    api: model.api,
    provider: model.provider,
    model: model.id,
    responseModel: model.id,
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        total: 0,
      },
    },
    stopReason: "stop" as const,
    timestamp: Date.now(),
  };
}

export function CyberdeckPiChatPaneBody({ server }: PiChatPaneBodyProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState("BOOTING PI...");

  useEffect(() => {
    let disposed = false;
    let panel: HTMLElement | null = null;

    const mountPi = async () => {
      try {
        const [{ Agent }, { createAssistantMessageEventStream, getModel }, ui] = await Promise.all([
          import("@mariozechner/pi-agent-core"),
          import("@mariozechner/pi-ai"),
          import("@mariozechner/pi-web-ui"),
        ]);
        await import("@mariozechner/mini-lit/dist/MarkdownBlock.js");

        await ensurePiStorage(ui);
        if (disposed || !hostRef.current) return;

        let agent: InstanceType<typeof Agent> | null = null;
        const forceReady = () => {
          if (!agent) return;
          (agent.state as any).isStreaming = false;
          (agent.state as any).streamingMessage = undefined;
          (agent.state as any).pendingToolCalls = new Set();
          setStatus("PI READY");
        };

        const streamFn = async (
          model: Model<any>,
          context: Context,
          options?: SimpleStreamOptions,
        ) => {
          const stream = createAssistantMessageEventStream();

          queueMicrotask(async () => {
            const partial = createEmptyAssistantMessage(model);

            try {
              console.debug("[pi-tab] stream start", {
                provider: model.provider,
                model: model.id,
                messageCount: context.messages.length,
              });
              let apiKey = typeof options?.apiKey === "string" ? options.apiKey : "";
              if (!apiKey) {
                const hasKey = await promptForProviderKey(ui, String(model.provider));
                if (!hasKey) {
                  throw new Error(`${String(model.provider).toUpperCase()} API key required`);
                }
                apiKey = (await ui.getAppStorage().providerKeys.get(String(model.provider))) || "";
              }

              const response = await fetch("/api/pi-chat", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  provider: model.provider,
                  apiKey,
                  model: model.id,
                  systemPrompt: context.systemPrompt,
                  messages: context.messages,
                }),
                signal: options?.signal,
              });

              console.debug("[pi-tab] proxy response", response.status);

              if (!response.ok || !response.body) {
                const errorText = await response.text().catch(() => "");
                throw new Error(errorText || `Pi proxy error ${response.status}`);
              }

              partial.timestamp = Date.now();
              stream.push({ type: "start", partial });
              stream.push({ type: "text_start", contentIndex: 0, partial });

              const reader = response.body.getReader();
              const decoder = new TextDecoder();
              let text = "";

              while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                const delta = decoder.decode(value, { stream: true });
                if (!delta) continue;

                text += delta;
                partial.content = [{ type: "text", text }];
                stream.push({ type: "text_delta", contentIndex: 0, delta, partial });
              }

              const rest = decoder.decode();
              if (rest) {
                text += rest;
                partial.content = [{ type: "text", text }];
                stream.push({ type: "text_delta", contentIndex: 0, delta: rest, partial });
              }

              partial.content = [{ type: "text", text }];
              stream.push({ type: "text_end", contentIndex: 0, content: text, partial });
              stream.push({ type: "done", reason: "stop", message: partial });
              stream.end(partial);
              queueMicrotask(forceReady);
              console.debug("[pi-tab] stream done", { length: text.length });
            } catch (error) {
              const message =
                error instanceof Error ? error.message : "Pi proxy request failed";
              const failed = {
                ...partial,
                stopReason: options?.signal?.aborted ? ("aborted" as const) : ("error" as const),
                errorMessage: message,
              };
              console.error("[pi-tab] stream error", failed.errorMessage);
              stream.push({
                type: "error",
                reason: options?.signal?.aborted ? "aborted" : "error",
                error: failed,
              });
              stream.end(failed);
              queueMicrotask(forceReady);
            }
          });

          return stream;
        };

        agent = new Agent({
          initialState: {
            systemPrompt:
              "You are Pi running inside the Echo Mirage Cyberdeck. Be technical, direct, and helpful.",
            model: getModel("opencode", "big-pickle"),
            thinkingLevel: "off",
            messages: [],
            tools: [],
          },
          convertToLlm: ui.defaultConvertToLlm,
          streamFn,
        });

        agent.subscribe((event) => {
          if (event.type === "message_end" || event.type === "turn_end" || event.type === "agent_end") {
            agent.state.messages = [...agent.state.messages];
          }
          if (event.type === "agent_start" || event.type === "agent_end" || event.type === "turn_end" || event.type === "message_end") {
            console.debug("[pi-tab] agent event", event.type, {
              isStreaming: agent.state.isStreaming,
              messages: agent.state.messages.length,
            });
          }
        });

        const chatPanel = new ui.ChatPanel();
        chatPanel.style.display = "block";
        chatPanel.style.height = "100%";
        chatPanel.style.width = "100%";
        chatPanel.style.background = "transparent";

        await chatPanel.setAgent(agent, {
          onApiKeyRequired: (provider) => promptForProviderKey(ui, provider),
          toolsFactory: (_agent, _agentInterface, _artifactsPanel, runtimeProvidersFactory) => {
            const replTool = ui.createJavaScriptReplTool();
            replTool.runtimeProvidersFactory = runtimeProvidersFactory;
            return [replTool, ui.createExtractDocumentTool()];
          },
        });

        if (disposed || !hostRef.current) return;

        panel = chatPanel;
        hostRef.current.replaceChildren(chatPanel);
        setStatus("PI READY");
      } catch (error) {
        console.error("[pi-tab] failed to mount Pi chat", error);
        setStatus("PI BOOT FAILURE");
      }
    };

    void mountPi();

    return () => {
      disposed = true;
      panel?.remove();
      hostRef.current?.replaceChildren();
    };
  }, []);

  return (
    <div
      ref={hostRef}
      className="pi-pane-host custom-scrollbar flex h-full min-h-0 w-full flex-col overflow-hidden rounded-sm border border-[#1c1c1c] bg-black/80"
      data-pi-status={status || server.toUpperCase()}
    />
  );
}
