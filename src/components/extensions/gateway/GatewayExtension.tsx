"use client";

import type { CSSProperties, DragEvent as ReactDragEvent, RefObject } from "react";
import { Streamdown } from "streamdown";

type ProviderOption = { id: "opencode" | "openrouter" | "openai"; name: string };

function inferModelIntelProvider(modelId: string): "openai" | "openrouter" | "opencode" {
  const id = modelId.toLowerCase();
  if (
    id.startsWith("openai/") ||
    id.includes("gpt") ||
    id.includes("o1") ||
    id.includes("o3") ||
    id.includes("o4")
  ) {
    return "openai";
  }
  if (
    id.startsWith("anthropic/") ||
    id.startsWith("google/") ||
    id.startsWith("meta-llama/") ||
    id.startsWith("mistralai/") ||
    id.startsWith("x-ai/") ||
    id.includes("/")
  ) {
    return "openrouter";
  }
  return "opencode";
}

function providerIntelTone(provider: "openai" | "openrouter" | "opencode"): {
  color: string;
  shadow: string;
} {
  if (provider === "openai") {
    return { color: "#59d7ff", shadow: "0 0 8px rgba(89, 215, 255, 0.24)" };
  }
  if (provider === "openrouter") {
    return { color: "#bf8cff", shadow: "0 0 8px rgba(191, 140, 255, 0.24)" };
  }
  return { color: "#8a8a8a", shadow: "0 0 6px rgba(180, 180, 180, 0.14)" };
}

export function GatewayExtension({
  gatewayColumnRef,
  gatewayConnectionPanelRef,
  networkActivityActive,
  isMarkdownDragOver,
  onDragOver,
  onDragLeave,
  onDrop,
  droppedMarkdown,
  droppedMarkdownName,
  setDroppedMarkdown,
  setDroppedMarkdownName,
  providers,
  activeProvider,
  providerKeyboardHighlightId,
  setProviderKeyboardHighlightId,
  setModelKeyboardHighlightId,
  selectProvider,
  inactiveSubtleTextColor,
  activeTextGlow,
  inactiveTextGlow,
  probeInFlightByProvider,
  providerModelFetchStatus,
  hasProviderAuth,
  providerKeys,
  modelList,
  inactiveTextColor,
  modelHealthByProvider,
  modelID,
  activateModelById,
  modelKeyboardHighlightId,
  generatedUI,
}: {
  gatewayColumnRef: RefObject<HTMLDivElement | null>;
  gatewayConnectionPanelRef: RefObject<HTMLDivElement | null>;
  networkActivityActive: boolean;
  isMarkdownDragOver: boolean;
  onDragOver: (e: ReactDragEvent<HTMLDivElement>) => void;
  onDragLeave: (e: ReactDragEvent<HTMLDivElement>) => void;
  onDrop: (e: ReactDragEvent<HTMLDivElement>) => void;
  droppedMarkdown: string | null;
  droppedMarkdownName: string;
  setDroppedMarkdown: (value: string | null) => void;
  setDroppedMarkdownName: (value: string) => void;
  providers: readonly ProviderOption[];
  activeProvider: string;
  providerKeyboardHighlightId: string | null;
  setProviderKeyboardHighlightId: (value: string | null) => void;
  setModelKeyboardHighlightId: (value: string | null) => void;
  selectProvider: (id: string) => void;
  inactiveSubtleTextColor: string;
  activeTextGlow: string;
  inactiveTextGlow: string;
  probeInFlightByProvider: Record<string, string>;
  providerModelFetchStatus: "idle" | "retrieving" | "invalid-key" | "error" | "ready";
  hasProviderAuth: boolean;
  providerKeys: Record<string, string>;
  modelList: { id: string }[];
  inactiveTextColor: string;
  modelHealthByProvider: Record<string, Record<string, string>>;
  modelID: string;
  activateModelById: (modelId: string) => void;
  modelKeyboardHighlightId: string | null;
  generatedUI: string | null;
}) {
  return (
    <div
      ref={gatewayColumnRef}
      tabIndex={-1}
      aria-label="Extension surface"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`cyberdeck-net-pane right flex h-full min-w-0 flex-col border-gray-800 bg-black outline-none focus-visible:ring-2 focus-visible:ring-green-500/35 focus-visible:ring-offset-2 focus-visible:ring-offset-black md:border-l ${
        networkActivityActive ? "is-net-active" : ""
      } ${isMarkdownDragOver ? "ring-2 ring-amber-500/50 ring-inset" : ""}`}
    >
      <header className="flex shrink-0 items-center overflow-visible border-b border-gray-800 bg-black px-6 py-2">
        <pre
          className="cyberdeck-net-logo m-0 whitespace-pre font-mono text-[4px] leading-[1.0] text-green-400"
          style={{ textShadow: "0 0 5px #00ff00" }}
        >
          {`
        _   _          _          _           _                   _              _      
       ╱╲_╲╱╲_╲ _     ╱╲ ╲       ╱╲ ╲        ╱ ╱╲                ╱╲ ╲           ╱╲ ╲    
      ╱ ╱ ╱ ╱ ╱╱╲_╲   ╲ ╲ ╲     ╱  ╲ ╲      ╱ ╱  ╲              ╱  ╲ ╲         ╱  ╲ ╲   
     ╱╲ ╲╱ ╲ ╲╱ ╱ ╱   ╱╲ ╲_╲   ╱ ╱╲ ╲ ╲    ╱ ╱ ╱╲ ╲            ╱ ╱╲ ╲_╲       ╱ ╱╲ ╲ ╲  
    ╱  ╲____╲__╱ ╱   ╱ ╱╲╱_╱  ╱ ╱ ╱╲ ╲_╲  ╱ ╱ ╱╲ ╲ ╲          ╱ ╱ ╱╲╱_╱      ╱ ╱ ╱╲ ╲_╲ 
   ╱ ╱╲╱________╱   ╱ ╱ ╱    ╱ ╱ ╱_╱ ╱ ╱ ╱ ╱ ╱  ╲ ╲ ╲        ╱ ╱ ╱ ______   ╱ ╱_╱_ ╲╱_╱ 
  ╱ ╱ ╱╲╱_╱╱ ╱ ╱   ╱ ╱ ╱    ╱ ╱ ╱__╲╱ ╱ ╱ ╱ ╱___╱ ╱╲ ╲      ╱ ╱ ╱ ╱╲_____╲ ╱ ╱____╱╲    
 ╱ ╱ ╱    ╱ ╱ ╱   ╱ ╱ ╱    ╱ ╱ ╱_____╱ ╱ ╱ ╱_____╱ ╱╲ ╲    ╱ ╱ ╱  ╲╱____ ╱╱ ╱╲____╲╱    
╱ ╱ ╱    ╱ ╱ ╱___╱ ╱ ╱__  ╱ ╱ ╱╲ ╲ ╲  ╱ ╱_________╱╲ ╲ ╲  ╱ ╱ ╱_____╱ ╱ ╱╱ ╱ ╱______    
╲╱_╱    ╱ ╱ ╱╱╲__╲╱_╱___╲╱ ╱ ╱  ╲ ╲ ╲╱ ╱ ╱_       __╲ ╲_╲╱ ╱ ╱______╲╱ ╱╱ ╱ ╱_______╲   
        ╲╱_╱ ╲╱_________╱╲╱_╱    ╲_╲╱╲_╲___╲     ╱____╱_╱╲╱___________╱ ╲╱__________╱`}
        </pre>
      </header>
      <div className="custom-scrollbar flex-1 overflow-y-auto bg-black p-4">
        {droppedMarkdown ? (
          <div className="mb-4 rounded-sm border border-amber-700/70 bg-black p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="truncate font-mono text-[10px] text-amber-300">
                MARKDOWN: {droppedMarkdownName || "dropped.md"}
              </div>
              <button
                type="button"
                className="rounded border border-amber-700 px-2 py-[2px] font-mono text-[10px] text-amber-300 hover:border-amber-500"
                onClick={() => {
                  setDroppedMarkdown(null);
                  setDroppedMarkdownName("");
                }}
              >
                CLEAR
              </button>
            </div>
            <Streamdown className="prose prose-invert prose-pre:bg-black prose-pre:text-green-300 max-w-none text-[12px] leading-snug text-green-200">
              {droppedMarkdown}
            </Streamdown>
          </div>
        ) : null}
        <div
          className="pb-2 font-mono text-[10px] tracking-[0.04em] text-[#8a8a8a]"
          style={{ textShadow: "0 0 6px rgba(138,138,138,0.2)" }}
        >
          MAINNET-UPLINK
        </div>

        <div
          className="cursor-default py-1 font-mono text-[10px] tracking-[0.04em] text-[#8a8a8a]"
          style={{ textShadow: "0 0 6px rgba(138,138,138,0.2)" }}
        >
          # GATEWAY
        </div>

        <div className="mt-1 flex select-none flex-col font-mono text-[10px] tracking-[0.04em]">
          {providers.map((p) => {
            const selected = activeProvider === p.id;
            const kbHover = providerKeyboardHighlightId === p.id;
            return (
              <div
                key={p.id}
                data-provider-row={p.id}
                className={`nav-row cursor-pointer py-[5px]${kbHover ? " nav-row-kb-hover" : ""}`}
                style={
                  {
                    "--nav-color": selected ? "#00ff00" : inactiveSubtleTextColor,
                    "--nav-shadow": selected ? activeTextGlow : inactiveTextGlow,
                    "--nav-hover-color": selected ? "#36ff73" : "#b0b0b0",
                    "--nav-hover-shadow": selected ? "0 0 10px rgba(54, 255, 115, 0.30)" : inactiveTextGlow,
                  } as CSSProperties
                }
                onClick={() => {
                  selectProvider(p.id);
                  setProviderKeyboardHighlightId(null);
                  setModelKeyboardHighlightId(null);
                }}
              >
                {selected ? "[X] " : "[ ] "}
                {p.name}
              </div>
            );
          })}
        </div>

        <div
          ref={gatewayConnectionPanelRef}
          className="mt-5 border-t border-[#111] pt-2"
          style={{
            pointerEvents: probeInFlightByProvider[activeProvider] ? "none" : "auto",
            opacity: probeInFlightByProvider[activeProvider] ? 0.7 : 1,
            transition: "opacity 0.2s",
          }}
        >
          <div className="mb-2 font-mono text-[10px]" style={{ color: inactiveTextColor, textShadow: inactiveTextGlow }}>
            AVAILABLE_MODELS:
          </div>
          {!hasProviderAuth ? null : providerModelFetchStatus === "retrieving" ? (
            <div className="model-probe-wave font-mono text-[10px]" style={{ color: "#ffaa00" }}>
              CONNECTING... RETRIEVING_MODELS
            </div>
          ) : providerModelFetchStatus === "invalid-key" ? (
            <div className="font-mono text-[10px] text-red-400" style={{ textShadow: "0 0 8px rgba(255, 85, 85, 0.3)" }}>
              INVALID_KEY // AUTH_REJECTED
            </div>
          ) : providerModelFetchStatus === "error" ? (
            <div className="font-mono text-[10px] text-red-300" style={{ textShadow: "0 0 8px rgba(255, 122, 122, 0.3)" }}>
              UPLINK_ERROR // RETRY
            </div>
          ) : modelList.length === 0 ? (
            <div className="font-mono text-[10px]" style={{ color: inactiveTextColor, textShadow: inactiveTextGlow }}>
              NO_MODELS_LOADED
            </div>
          ) : (
            modelList.map((m) => {
              const health = modelHealthByProvider[activeProvider]?.[m.id] || "idle";
              const isSel = modelID === m.id;
              const inferredProvider = inferModelIntelProvider(m.id);
              const intelTone = providerIntelTone(inferredProvider);
              const isFree = m.id.toLowerCase().includes("free");
              const wave = probeInFlightByProvider[activeProvider] === m.id;
              const modelKb = modelKeyboardHighlightId === m.id;
              return (
                <div
                  key={m.id}
                  data-model-row={m.id}
                  className={`${wave ? "model-probe-wave nav-row" : "nav-row"}${modelKb ? " nav-row-kb-hover" : ""}`}
                  role="button"
                  tabIndex={-1}
                  onClick={() => {
                    setProviderKeyboardHighlightId(null);
                    setModelKeyboardHighlightId(null);
                    activateModelById(m.id);
                  }}
                  style={
                    {
                      cursor: "pointer",
                      fontSize: "10px",
                      paddingTop: "4px",
                      paddingBottom: "4px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      "--nav-color": isSel
                        ? health === "green"
                          ? "#00ff00"
                          : health === "amber"
                            ? "#ffaa00"
                            : inactiveTextColor
                        : isFree
                          ? "#ffaa00"
                          : intelTone.color,
                      "--nav-shadow": isSel
                        ? health === "green"
                          ? activeTextGlow
                          : health === "amber"
                            ? "0 0 8px rgba(255, 170, 0, 0.22)"
                            : inactiveTextGlow
                        : isFree
                          ? "0 0 8px rgba(255, 170, 0, 0.22)"
                          : intelTone.shadow,
                      "--nav-hover-color": isSel
                        ? health === "green"
                          ? "#36ff73"
                          : "#ffbf4d"
                        : inferredProvider === "openai"
                          ? "#7fe5ff"
                          : inferredProvider === "openrouter"
                            ? "#d1a7ff"
                            : "#b0b0b0",
                      "--nav-hover-shadow": isSel
                        ? health === "green"
                          ? "0 0 10px rgba(54, 255, 115, 0.30)"
                          : "0 0 10px rgba(255, 191, 77, 0.28)"
                        : intelTone.shadow,
                    } as CSSProperties
                  }
                >
                  {m.id.split("/").pop()}
                </div>
              );
            })
          )}
        </div>

        {generatedUI ? (
          <div className="mt-4 rounded-sm border border-green-900/80 bg-black/60 p-3">
            <div className="mb-1 font-mono text-[10px] text-green-500/90">// FEED</div>
            <pre className="whitespace-pre-wrap font-mono text-[10px] leading-snug text-green-300/95">{generatedUI}</pre>
          </div>
        ) : null}
      </div>
    </div>
  );
}

