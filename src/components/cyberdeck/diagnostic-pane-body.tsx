'use client';

import { useEffect, useRef, useState } from "react";

import {
  CyberdeckPaneHeader,
  CyberdeckPaneHeaderSubtitle,
  CyberdeckPaneHeaderTitle,
  CyberdeckPaneHeaderValue,
} from "@/components/cyberdeck/pane-header";

type DiagnosticPaneBodyProps = {
  server: string;
  connectionState: "offline" | "connecting" | "connected";
  activeProvider: string;
  modelID: string;
  providerModelFetchStatus: "idle" | "retrieving" | "invalid-key" | "error" | "ready";
  voiceEnabled: boolean;
  voiceHealth: "idle" | "backend" | "fallback" | "off";
  muthurMemoryTurnCount: number;
  muthurMemoryUpdatedAt: number;
  memoryContext: string;
  heapCount: number;
  chatCount: number;
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

export function CyberdeckDiagnosticPaneBody({ server }: DiagnosticPaneBodyProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState("BOOTING PI...");

  useEffect(() => {
    let disposed = false;
    let panel: HTMLElement | null = null;

    const mountPi = async () => {
      try {
        const [{ Agent }, { getModel }, ui] = await Promise.all([
          import("@mariozechner/pi-agent-core"),
          import("@mariozechner/pi-ai"),
          import("@mariozechner/pi-web-ui"),
        ]);

        await ensurePiStorage(ui);
        if (disposed || !hostRef.current) return;

        const agent = new Agent({
          initialState: {
            systemPrompt:
              "You are Pi running inside the Echo Mirage Cyberdeck. Be technical, direct, and helpful.",
            model: getModel("opencode", "big-pickle"),
            thinkingLevel: "off",
            messages: [],
            tools: [],
          },
          convertToLlm: ui.defaultConvertToLlm,
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
    <div className="custom-scrollbar flex flex-1 flex-col overflow-y-auto bg-black p-4">
      <div className="flex flex-1 flex-col rounded-sm border border-[#141414] bg-black transition-colors">
        <CyberdeckPaneHeader
          left={
            <>
              <CyberdeckPaneHeaderTitle style={{ textShadow: "0 0 6px rgba(138,138,138,0.2)" }}>
                PI
              </CyberdeckPaneHeaderTitle>
              <CyberdeckPaneHeaderSubtitle>CODING AGENT // WORKBENCH</CyberdeckPaneHeaderSubtitle>
            </>
          }
          right={<CyberdeckPaneHeaderValue>{status || server.toUpperCase()}</CyberdeckPaneHeaderValue>}
        />

        <div className="min-h-0 flex-1 overflow-hidden p-3">
          <div
            ref={hostRef}
            className="h-full min-h-[60vh] overflow-hidden rounded-sm border border-[#1c1c1c] bg-black/80"
          />
        </div>
      </div>
    </div>
  );
}
