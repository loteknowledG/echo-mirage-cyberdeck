"use client";

import type { CSSProperties, DragEvent as ReactDragEvent, MouseEvent as ReactMouseEvent, ReactNode, Ref } from "react";
import dynamic from "next/dynamic";
import { forwardRef } from "react";
import { MirageHeader } from "@/components/cyberdeck/mirage-header";
import { CyberdeckControlButton } from "@/components/cyberdeck/cyberdeck-control-button";
import { CyberdeckGatewaySettingsPane } from "@/components/cyberdeck/cyberdeck-pane-slots";
import {
  GATEWAY_ACTIVE_TEXT_GLOW,
  GATEWAY_AMBER_TEXT_GLOW,
  GATEWAY_INACTIVE_SUBTLE_TEXT_COLOR,
  GATEWAY_INACTIVE_TEXT_COLOR,
  GATEWAY_INACTIVE_TEXT_GLOW,
  GATEWAY_SR_ONLY_BLURB,
} from "@/features/cyberdeck/gateway/provider-pane-state";
import type { DeckMode } from "@/lib/deck-mode";
import { providerToneColors, resolveProviderVisualTone, type ProviderLinkStatus } from "@/lib/cyberdeck/provider-connection";

const CyberdeckMarkdownPreview = dynamic(
  () =>
    import("@/features/cyberdeck/streamdown-markdown-preview").then((m) => ({
      default: m.StreamdownMarkdownPreview,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="font-mono text-[10px] tracking-[0.08em] text-[#707070]">MARKDOWN // LOADING</div>
    ),
  },
);

type GatewayProvider = {
  readonly id: string;
  readonly name: string;
};

export type GatewayColumnProps = {
  networkActivityActive: boolean;
  isMarkdownDragOver: boolean;
  mirageHeaderCollapse: number;
  isMobileLayout: boolean;
  deckMode: DeckMode;
  droppedMarkdown: string | null;
  droppedMarkdownName: string;
  onDroppedMarkdownClear: () => void;
  onContextMenu: (event: ReactMouseEvent<HTMLDivElement>) => void;
  onDragOver: (event: ReactDragEvent<HTMLDivElement>) => void;
  onDragLeave: (event: ReactDragEvent<HTMLDivElement>) => void;
  onDrop: (event: ReactDragEvent<HTMLDivElement>) => void;
  leadingPaneContent?: ReactNode;
  children?: ReactNode;
  gatewayConnectionPanelRef: Ref<HTMLDivElement>;
  providerKeyboardHighlightId: string | null;
  modelKeyboardHighlightId: string | null;
  onProviderKeyboardHighlightIdChange: (id: string | null) => void;
  onModelKeyboardHighlightIdChange: (id: string | null) => void;
  focusGatewayConnectionPanel: () => void;
  providers: readonly GatewayProvider[];
  activeProvider: string;
  modelList: { id: string }[];
  modelID: string;
  hasProviderAuth: boolean;
  providerConnectionLabel: string;
  providerModelFetchStatus: ProviderLinkStatus;
  credentialReplaceProvider: string | null;
  gatewayKeyDraft: string;
  onGatewayKeyDraftChange: (value: string) => void;
  rateLimitedProviders: Set<string>;
  modelFetchStatusByProvider: Record<string, ProviderLinkStatus>;
  modelHealthByProvider: Record<string, Record<string, string>>;
  probeInFlightByProvider: Record<string, string>;
  providerHasKey: (providerId: string) => boolean;
  handleProviderClick: (providerId: string) => void;
  submitGatewayKey: () => void | Promise<void>;
  activateModelById: (modelId: string) => void;
  generatedUI: string | null;
};

export const GatewayColumn = forwardRef<HTMLDivElement, GatewayColumnProps>(function GatewayColumn(
  {
    networkActivityActive,
    isMarkdownDragOver,
    mirageHeaderCollapse,
    isMobileLayout,
    deckMode,
    droppedMarkdown,
    droppedMarkdownName,
    onDroppedMarkdownClear,
    onContextMenu,
    onDragOver,
    onDragLeave,
    onDrop,
    leadingPaneContent,
    children,
    gatewayConnectionPanelRef,
    providerKeyboardHighlightId,
    modelKeyboardHighlightId,
    onProviderKeyboardHighlightIdChange,
    onModelKeyboardHighlightIdChange,
    focusGatewayConnectionPanel,
    providers,
    activeProvider,
    modelList,
    modelID,
    hasProviderAuth,
    providerConnectionLabel,
    providerModelFetchStatus,
    credentialReplaceProvider,
    gatewayKeyDraft,
    onGatewayKeyDraftChange,
    rateLimitedProviders,
    modelFetchStatusByProvider,
    modelHealthByProvider,
    probeInFlightByProvider,
    providerHasKey,
    handleProviderClick,
    submitGatewayKey,
    activateModelById,
    generatedUI,
  },
  ref,
) {
  return (
    <div
      ref={ref}
      tabIndex={-1}
      aria-label="Gateway"
      onContextMenu={onContextMenu}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`cyberdeck-net-pane right flex h-full min-w-0 flex-col overflow-hidden border-gray-800 bg-black outline-none focus-visible:ring-2 focus-visible:ring-green-500/35 focus-visible:ring-offset-2 focus-visible:ring-offset-black ${
        networkActivityActive ? "is-net-active" : ""
      } ${isMarkdownDragOver ? "ring-2 ring-amber-500/50 ring-inset" : ""}`}
    >
      <MirageHeader collapse={mirageHeaderCollapse} />
      <p className="sr-only">{GATEWAY_SR_ONLY_BLURB}</p>
      <div className="mirage-pane-body relative box-border flex min-h-0 min-w-0 w-full max-w-full flex-1 flex-col overflow-hidden ps-2 pe-3">
        {leadingPaneContent}
        <CyberdeckGatewaySettingsPane className="custom-scrollbar flex flex-1 flex-col overflow-y-auto bg-black p-4 max-md:pb-[max(1rem,env(safe-area-inset-bottom))]">
          {droppedMarkdown ? (
            <div className="mb-4 rounded-sm border border-amber-700/70 bg-black p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="truncate font-mono text-[10px] text-amber-300">
                  MARKDOWN: {droppedMarkdownName || "dropped.md"}
                </div>
                <CyberdeckControlButton
                  deckMode={deckMode}
                  control={{ size: "action", amber: true }}
                  onClick={onDroppedMarkdownClear}
                >
                  CLEAR
                </CyberdeckControlButton>
              </div>
              <CyberdeckMarkdownPreview className="prose prose-invert prose-pre:bg-black prose-pre:text-green-300 max-w-none text-[12px] leading-snug text-green-200">
                {droppedMarkdown}
              </CyberdeckMarkdownPreview>
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
              const linkStatus: ProviderLinkStatus = modelFetchStatusByProvider[p.id] ?? "idle";
              const tone = resolveProviderVisualTone({
                hasKey: providerHasKey(p.id),
                status: linkStatus,
                rateLimited: rateLimitedProviders.has(p.id),
              });
              const toneColors = providerToneColors(tone);
              return (
                <div
                  key={p.id}
                  data-provider-row={p.id}
                  className={`nav-row cursor-pointer py-[5px]${kbHover ? " nav-row-kb-hover" : ""}`}
                  style={
                    {
                      "--nav-color": toneColors.color,
                      "--nav-shadow": toneColors.shadow,
                      "--nav-hover-color": toneColors.hoverColor,
                      "--nav-hover-shadow": toneColors.hoverShadow,
                      fontWeight: selected ? 600 : 400,
                    } as CSSProperties
                  }
                  onClick={() => {
                    handleProviderClick(p.id);
                    onProviderKeyboardHighlightIdChange(null);
                    onModelKeyboardHighlightIdChange(null);
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
            className={`mt-5 border-t border-[#111] pt-2 max-md:order-first max-md:mt-0 max-md:border-t-0 max-md:pt-0${
              !hasProviderAuth || credentialReplaceProvider === activeProvider
                ? " max-md:sticky max-md:top-0 max-md:z-10 max-md:border-b max-md:border-[#111] max-md:bg-black max-md:pb-3"
                : ""
            }`}
            style={{
              pointerEvents: probeInFlightByProvider[activeProvider] ? "none" : "auto",
              opacity: probeInFlightByProvider[activeProvider] ? 0.7 : 1,
              transition: "opacity 0.2s",
            }}
          >
            {!hasProviderAuth || credentialReplaceProvider === activeProvider ? (
              <div className="mb-3">
                <label
                  htmlFor="gateway-provider-key"
                  className="mb-1 block font-mono text-[9px] tracking-[0.08em] text-[#8a8a8a] max-md:text-[10px]"
                >
                  {credentialReplaceProvider === activeProvider ? "ENTER NEW KEY" : "ENTER GATEWAY KEY"}
                </label>
                {isMobileLayout ? (
                  <p className="mb-2 font-mono text-[9px] leading-snug text-[#666]">
                    Tap μ (MAINNET-UPLINK) if this panel is hidden. Paste your key, then Connect — or paste the key in
                    chat.
                  </p>
                ) : null}
                <div className="flex flex-col gap-2 max-md:flex-row max-md:items-stretch">
                  <input
                    id="gateway-provider-key"
                    type="password"
                    enterKeyHint="done"
                    value={gatewayKeyDraft}
                    onChange={(e) => onGatewayKeyDraftChange(e.target.value)}
                    onFocus={focusGatewayConnectionPanel}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void submitGatewayKey();
                      }
                    }}
                    autoComplete="off"
                    spellCheck={false}
                    className="min-h-[44px] w-full flex-1 rounded border border-[#2d2d2d] bg-black px-3 py-2 font-mono text-base text-green-300 outline-none focus:border-green-700 max-md:text-[16px] md:min-h-0 md:px-2 md:py-1 md:text-[10px]"
                    placeholder={`${providers.find((p) => p.id === activeProvider)?.name ?? activeProvider.toUpperCase()} API KEY`}
                  />
                  <CyberdeckControlButton
                    deckMode={deckMode}
                    control={{ size: "action", signal: true }}
                    disabled={!gatewayKeyDraft.trim() || providerModelFetchStatus === "retrieving"}
                    className="min-h-[44px] shrink-0 md:min-h-0"
                    onClick={() => void submitGatewayKey()}
                  >
                    {providerModelFetchStatus === "retrieving" ? "LINKING…" : "CONNECT"}
                  </CyberdeckControlButton>
                </div>
              </div>
            ) : null}
            <div
              className="mb-2 font-mono text-[10px]"
              style={{ color: GATEWAY_INACTIVE_TEXT_COLOR, textShadow: GATEWAY_INACTIVE_TEXT_GLOW }}
            >
              CONNECTION_STATUS: {providerConnectionLabel}
            </div>
            <div
              className="mb-2 font-mono text-[10px]"
              style={{ color: GATEWAY_INACTIVE_TEXT_COLOR, textShadow: GATEWAY_INACTIVE_TEXT_GLOW }}
            >
              AVAILABLE_MODELS:
            </div>
            {!hasProviderAuth ? (
              <div
                className="font-mono text-[10px]"
                style={{ color: GATEWAY_INACTIVE_TEXT_COLOR, textShadow: GATEWAY_INACTIVE_TEXT_GLOW }}
              >
                NO KEY // ENTER_KEY_ABOVE_OR_PASTE_IN_CHAT
              </div>
            ) : rateLimitedProviders.has(activeProvider) ? (
              <div
                className="font-mono text-[10px] text-amber-300"
                style={{ textShadow: "0 0 8px rgba(255, 170, 0, 0.28)" }}
              >
                QUOTA // RATE_LIMIT // OPERATOR_ACTION_REQUIRED
              </div>
            ) : providerModelFetchStatus === "retrieving" ? (
              <div className="model-probe-wave font-mono text-[10px]" style={{ color: "#ffaa00" }}>
                CONNECTING... RETRIEVING_MODELS
              </div>
            ) : providerModelFetchStatus === "invalid-key" ? (
              <div
                className="font-mono text-[10px] text-red-400"
                style={{ textShadow: "0 0 8px rgba(255, 85, 85, 0.3)" }}
              >
                AUTH FAILED // INVALID_KEY
              </div>
            ) : providerModelFetchStatus === "error" ? (
              <div
                className="font-mono text-[10px] text-red-300"
                style={{ textShadow: "0 0 8px rgba(255, 122, 122, 0.3)" }}
              >
                UNAVAILABLE // UPLINK_ERROR // OPERATOR_ACTION_REQUIRED
              </div>
            ) : modelList.length === 0 ? (
              <div
                className="font-mono text-[10px]"
                style={{ color: GATEWAY_INACTIVE_TEXT_COLOR, textShadow: GATEWAY_INACTIVE_TEXT_GLOW }}
              >
                NO_MODELS_LOADED
              </div>
            ) : (
              modelList.map((m) => {
                const health = modelHealthByProvider[activeProvider]?.[m.id] || "idle";
                const isSel = modelID === m.id;
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
                      onProviderKeyboardHighlightIdChange(null);
                      onModelKeyboardHighlightIdChange(null);
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
                              : GATEWAY_INACTIVE_TEXT_COLOR
                          : isFree
                            ? "#ffaa00"
                            : GATEWAY_INACTIVE_SUBTLE_TEXT_COLOR,
                        "--nav-shadow": isSel
                          ? health === "green"
                            ? GATEWAY_ACTIVE_TEXT_GLOW
                            : health === "amber"
                              ? GATEWAY_AMBER_TEXT_GLOW
                              : GATEWAY_INACTIVE_TEXT_GLOW
                          : isFree
                            ? GATEWAY_AMBER_TEXT_GLOW
                            : GATEWAY_INACTIVE_TEXT_GLOW,
                        "--nav-hover-color": isSel ? (health === "green" ? "#36ff73" : "#ffbf4d") : "#b0b0b0",
                        "--nav-hover-shadow": isSel
                          ? health === "green"
                            ? "0 0 10px rgba(54, 255, 115, 0.30)"
                            : "0 0 10px rgba(255, 191, 77, 0.28)"
                          : GATEWAY_INACTIVE_TEXT_GLOW,
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
              <pre className="whitespace-pre-wrap font-mono text-[10px] leading-snug text-green-300/95">
                {generatedUI}
              </pre>
            </div>
          ) : null}
        </CyberdeckGatewaySettingsPane>
        {children}
      </div>
    </div>
  );
});
