"use client";

import type { DragEvent as ReactDragEvent, RefObject } from "react";
import { memo } from "react";
import dynamic from "next/dynamic";
import { OPERATOR_BROWSER_HOME_URL } from "@/lib/browser-intents";
import { buildMuthurMemoryContext } from "@/lib/muthur-memory";
import type { MuthurMemoryState } from "@/lib/muthur-memory";
import { CyberdeckWebTabFrame } from "@/components/cyberdeck/cyberdeck-web-tab-frame";
import { RegistryShowroom } from "@/app/registry/registry-showroom";
import { RegistryKitScrollFrame } from "@/app/registry/registry-kit-scroll-frame";
import {
  CyberdeckPaneHeader,
  CyberdeckPaneHeaderSubtitle,
  CyberdeckPaneHeaderTitle,
} from "@/components/cyberdeck/pane-header";
import { PanelLoader } from "@/features/cyberdeck/panel-loader";
import { cn } from "@/lib/utils";
import { useCyberdeckTabStore } from "@/lib/cyberdeck-tab-store";
import type { MuthurCommandInputHandle } from "@/components/cyberdeck/muthur-command-input";
import type { ChatMessage } from "@/features/cyberdeck/muthur/muthur-chat-types";
import type { CustomTab } from "@/features/cyberdeck/workspace/custom-tab-model";
import type { ProviderLinkStatus } from "@/lib/cyberdeck/provider-connection";
import type { Identity } from "@/lib/identity/identity-types";
import type { OrchestrationBundle } from "@/lib/orchestration/orchestration-types";
import type { Db8DeckSpeakLine } from "@/lib/db8-voice";

const ActivatedCyberdeckPane = dynamic(
  () =>
    import("@/features/cyberdeck/activated-cyberdeck-pane").then((m) => ({
      default: m.ActivatedCyberdeckPane,
    })),
  { ssr: false, loading: () => <PanelLoader label="SUBSYSTEM" /> },
);

export type CustomTabPaneRendererProps = {
  tab: CustomTab;
  activeProvider: string;
  connectionState: string;
  modelID: string;
  providerModelFetchStatus: ProviderLinkStatus;
  voiceEnabled: boolean;
  voiceHealth: "idle" | "backend" | "fallback" | "off";
  muthurMemory: MuthurMemoryState;
  muthurMemoryHydrated: boolean;
  muthurMemoryLoadError: string | null;
  messages: ChatMessage[];
  streamText: string;
  heapEntryCount: number;
  providerKeys: Record<string, string>;
  operatorBrowserEngine: string;
  operatorBrowserRef: RefObject<HTMLWebViewElement | null>;
  identity: Identity | null;
  orchestration: OrchestrationBundle | null;
  deckSfxVolume: number;
  sonarVolume: number;
  voiceDialVolume: number;
  speakDeckVoiceLine: Db8DeckSpeakLine;
  onVoiceToggle: () => void;
  onVoiceVolumeChange: (volume: number) => void;
  onSonarVolumeChange: (volume: number) => void;
  onDeckSfxVolumeChange: (volume: number) => void;
  customTabBrowserNavigate: (tabId: string, nextUrl: string) => void;
  handleCustomTabDrop: (event: ReactDragEvent<HTMLDivElement>, tabId: string) => void | Promise<void>;
  messageInputRef: RefObject<MuthurCommandInputHandle | null>;
};

function CustomTabPaneRendererInner({
  tab,
  activeProvider,
  connectionState,
  modelID,
  providerModelFetchStatus,
  voiceEnabled,
  voiceHealth,
  muthurMemory,
  muthurMemoryHydrated,
  muthurMemoryLoadError,
  messages,
  streamText,
  heapEntryCount,
  providerKeys,
  operatorBrowserEngine,
  operatorBrowserRef,
  identity,
  orchestration,
  deckSfxVolume,
  sonarVolume,
  voiceDialVolume,
  speakDeckVoiceLine,
  onVoiceToggle,
  onVoiceVolumeChange,
  onSonarVolumeChange,
  onDeckSfxVolumeChange,
  customTabBrowserNavigate,
  handleCustomTabDrop,
  messageInputRef,
}: CustomTabPaneRendererProps) {
  const server = useCyberdeckTabStore.getState().server;

  const shell = (
    content: JSX.Element,
    right?: JSX.Element,
    opts?: { scrollContent?: boolean },
  ) => (
    <div
      className={cn(
        "custom-scrollbar flex h-full min-h-0 min-w-0 w-full flex-1 flex-col bg-black p-4",
        opts?.scrollContent ? "overflow-hidden" : "overflow-y-auto",
      )}
      data-pointer-target={tab.kind}
    >
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col rounded-sm border border-[#141414] bg-black transition-colors",
          opts?.scrollContent && "overflow-hidden",
        )}
      >
        <CyberdeckPaneHeader
          className={opts?.scrollContent ? "shrink-0" : undefined}
          left={
            <div className="flex flex-col">
              <CyberdeckPaneHeaderTitle style={{ textShadow: "0 0 6px rgba(138,138,138,0.2)" }}>
                {tab.label}
              </CyberdeckPaneHeaderTitle>
              <CyberdeckPaneHeaderSubtitle>
                {tab.kind.toUpperCase()} TAB // {tab.glyph}
              </CyberdeckPaneHeaderSubtitle>
            </div>
          }
          right={
            right ||
            (tab.kind === "web" ? (
              <div className="rounded border border-[#2d2d2d] px-2 py-1 font-mono text-[9px] tracking-[0.08em] text-[#8a8a8a]">
                ENGINE: {operatorBrowserEngine}
              </div>
            ) : null)
          }
        />
        {opts?.scrollContent ? (
          <RegistryKitScrollFrame>{content}</RegistryKitScrollFrame>
        ) : (
          content
        )}
      </div>
    </div>
  );

  if (tab.kind === "realmorphism-kit" || (tab.kind === "web" && tab.label === "REALMORPHISM KIT")) {
    return shell(<RegistryShowroom variant="embedded" />, undefined, { scrollContent: true });
  }

  if (tab.kind === "web") {
    const webUrl = tab.browserUrl || OPERATOR_BROWSER_HOME_URL;
    return shell(
      <div
        className="flex min-h-0 flex-1 flex-col gap-3 p-3"
        onDragOver={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        onDrop={(event) => void handleCustomTabDrop(event, tab.id)}
      >
        <div className="flex items-center gap-2 rounded-sm border border-[#1c1c1c] bg-black/80 p-2">
          <input
            value={webUrl}
            onChange={(event) => customTabBrowserNavigate(tab.id, event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              customTabBrowserNavigate(tab.id, (event.currentTarget as HTMLInputElement).value);
            }}
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
            className="min-w-0 flex-1 border border-[#2d2d2d] bg-black px-2 py-1 font-mono text-[9px] tracking-[0.08em] text-[#cfcfcf] outline-none"
          />
        </div>
        <div className="min-h-0 flex-1 overflow-hidden rounded-sm border border-[#1c1c1c] bg-black">
          <CyberdeckWebTabFrame key={webUrl} url={webUrl} webviewRef={operatorBrowserRef} />
        </div>
      </div>,
    );
  }

  if (tab.kind === "document") {
    return (
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <ActivatedCyberdeckPane kind="document" tabId={tab.id} />
      </div>
    );
  }

  if (tab.kind === "settings") {
    return shell(
      <ActivatedCyberdeckPane
        kind="settings"
        voiceEnabled={voiceEnabled}
        onVoiceToggle={onVoiceToggle}
        deckSfxVolume={deckSfxVolume}
        onDeckSfxVolumeChange={onDeckSfxVolumeChange}
        identity={identity}
        voiceVolume={voiceDialVolume}
        onVoiceVolumeChange={onVoiceVolumeChange}
        sonarVolume={sonarVolume}
        onSonarVolumeChange={onSonarVolumeChange}
      />,
    );
  }

  if (tab.kind === "diagnostics") {
    let lastUserChat = "";
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m && m.role === "user") {
        lastUserChat = m.text;
        break;
      }
    }
    const memoryContextQuery =
      lastUserChat.trim() || messageInputRef.current?.getValue().trim() || undefined;
    return shell(
      <ActivatedCyberdeckPane
        kind="diagnostics"
        server={server}
        connectionState={connectionState}
        activeProvider={activeProvider}
        modelID={modelID}
        providerModelFetchStatus={providerModelFetchStatus}
        voiceEnabled={voiceEnabled}
        voiceHealth={voiceHealth}
        muthurMemory={muthurMemory}
        muthurMemoryHydrated={muthurMemoryHydrated}
        muthurMemoryLoadError={muthurMemoryLoadError}
        memoryContext={buildMuthurMemoryContext(muthurMemory, memoryContextQuery)}
        heapCount={heapEntryCount}
        chatCount={messages.length + (streamText ? 1 : 0)}
      />,
    );
  }

  if (tab.kind === "pi") {
    return shell(<ActivatedCyberdeckPane kind="pi" server={server} />);
  }

  if (tab.kind === "db8") {
    return (
      <div
        className="flex h-full min-h-0 min-w-0 w-full max-w-full flex-1 flex-col overflow-hidden bg-black"
        data-pointer-target="db8"
      >
        <ActivatedCyberdeckPane
          kind="db8"
          activeProvider={activeProvider}
          modelId={modelID}
          apiKey={providerKeys[activeProvider] || ""}
          onSpeakLine={speakDeckVoiceLine}
        />
      </div>
    );
  }

  if (tab.kind === "catelog" || tab.kind === "catalog") {
    return shell(<ActivatedCyberdeckPane kind="catalog" />);
  }

  if (tab.kind === "operators") {
    return shell(<ActivatedCyberdeckPane kind="operators" orchestration={orchestration} />);
  }

  if (tab.kind === "memory-atlas") {
    return shell(<ActivatedCyberdeckPane kind="memory-atlas" />);
  }

  if (tab.kind === "voice-lab") {
    return shell(
      <ActivatedCyberdeckPane kind="voice-lab" voiceEnabled={voiceEnabled} onVoiceToggle={onVoiceToggle} />,
    );
  }

  if (tab.kind === "flight-log") {
    return shell(<ActivatedCyberdeckPane kind="flight-log" />);
  }

  if (tab.kind === "drop-bay") {
    return shell(<ActivatedCyberdeckPane kind="drop-bay" />);
  }

  if (tab.kind === "cadre") {
    return shell(<ActivatedCyberdeckPane kind="cadre" />);
  }

  if (tab.kind === "install") {
    return shell(<ActivatedCyberdeckPane kind="install" />);
  }

  if (tab.kind === "glyph-channel") {
    return (
      <div
        className="flex h-full min-h-0 min-w-0 w-full max-w-full flex-1 flex-col overflow-hidden bg-black"
        data-pointer-target="glyph-channel"
      >
        <ActivatedCyberdeckPane kind="glyph-channel" />
      </div>
    );
  }

  if (tab.kind === "rola-dex") {
    return (
      <div
        className="flex h-full min-h-0 min-w-0 w-full max-w-full flex-1 flex-col overflow-hidden bg-black"
        data-pointer-target="rola-dex"
      >
        <ActivatedCyberdeckPane kind="rola-dex" />
      </div>
    );
  }

  if (tab.kind === "survey") {
    return (
      <div
        className="flex h-full min-h-0 min-w-0 w-full max-w-full flex-1 flex-col overflow-hidden bg-black"
        data-pointer-target="survey"
      >
        <ActivatedCyberdeckPane kind="survey" />
      </div>
    );
  }

  if (tab.kind === "tunes" || String(tab.kind) === "sound-profile") {
    return (
      <div
        className="flex h-full min-h-0 min-w-0 w-full max-w-full flex-1 flex-col overflow-hidden bg-black"
        data-pointer-target="tunes"
      >
        <ActivatedCyberdeckPane kind="tunes" />
      </div>
    );
  }

  if (tab.kind === "call-center") {
    return (
      <div
        className="flex h-full min-h-0 min-w-0 w-full max-w-full flex-1 flex-col overflow-hidden bg-black"
        data-pointer-target="call-center"
      >
        <ActivatedCyberdeckPane
          kind="call-center"
          activeProvider={activeProvider}
          modelId={modelID}
          apiKey={providerKeys[activeProvider] || ""}
        />
      </div>
    );
  }

  if (tab.kind === "photoshop") {
    return (
      <div
        className="flex h-full min-h-0 min-w-0 w-full max-w-full flex-1 flex-col overflow-hidden bg-black"
        data-pointer-target="photoshop"
      >
        <ActivatedCyberdeckPane kind="photoshop" />
      </div>
    );
  }

  return shell(
    <div className="flex min-h-0 flex-1 items-center justify-center p-6 font-mono text-[10px] tracking-[0.08em] text-[#8a8a8a]">
      BLANK TAB // RIGHT-CLICK TAB RAIL TO PICK A TYPE, OR USE CHAT /tab COMMANDS.
    </div>,
  );
}

export const CustomTabPaneRenderer = memo(CustomTabPaneRendererInner);
