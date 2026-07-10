"use client";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  startTransition,
  type DragEvent as ReactDragEvent,
  type MouseEvent as ReactMouseEvent,
  type SetStateAction,
} from "react";
import { flushSync } from "react-dom";
import { art } from "@/lib/TerminalArt";
import {
  clearMuthurMemory,
  createEmptyMuthurMemory,
  loadMuthurMemoryWithResult,
  recordMuthurMemoryTurn,
  saveMuthurMemory,
  type MuthurMemoryState,
} from "@/lib/muthur-memory";
import { persistMuthurShipMemoryTurn } from "@/lib/muthur-ship-memory";
import {
  OPERATOR_BROWSER_HOME_URL,
  looksLikeCaptchaBlock,
  messageReferencesLocalPath,
  parseBrowserCommand,
} from "@/lib/browser-intents";
import { CyberdeckCustomTabBrowserSync } from "@/components/cyberdeck/cyberdeck-custom-tab-browser-sync";
import { useRailTabLongPress } from "@/lib/use-rail-tab-long-press";
import type { CanonicalTarget } from "@/lib/computer-use/ui-alias-registry";
import {
  loadComputerUse,
} from "@/features/cyberdeck/runtime/defer-computer-use";
import {
  playDeckDeclined,
  playDeckDroidDizzy400,
  playDeckDroidDizzy401,
  playDeckOutOfGas429,
  playDeckRaceReadySetGo,
  playDeckWrongDoorShut,
  playDeckSystemSound,
} from "@/features/cyberdeck/runtime/defer-deck-audio";
import { copyTextToClipboard } from "@/lib/grok-image-prompt";
import { revokeOperatorBlobUrl } from "@/lib/operator-binary-preview";
import { isDocumentEditIntent, isOperatorPaneEditRequest } from "@/lib/muthur/document-edit-intent";
import {
  formatMuthurLiveStreamDisplay,
  MUTHUR_UPLINK_PREPARING,
  resolveMuthurCommittedDisplayText,
  splitMuthurStreamPayload,
} from "@/lib/muthur-core/muthur-stream-payload";
import {
  buildMuthurChatScrollKey,
  toolTraceToDiagnostic,
} from "@/lib/muthur-core/muthur-command-console";
import {
  extractMuthurStreamReasoning,
  formatMuthurReasoningDiagnostic,
} from "@/lib/muthur-core/muthur-stream-reasoning";
import { useMuthurChatAutoScroll } from "@/lib/muthur-core/use-muthur-chat-auto-scroll";
import { CADRE_MUTHUR_ARCHIVE_EVENT } from "@/lib/cadre/cadre-event-bus";
import {
  appendMuthurDiagnosticBatch,
  appendMuthurDiagnosticEntry,
} from "@/lib/muthur-core/muthur-diagnostics-channel";
import { parseOperatorConversionJson } from "@/lib/muthur-core/operator-conversion-ref";
import { parseOperatorBrowserJson } from "@/lib/muthur-core/operator-browser-ref";
import { parseSurveyAutoConnectJson } from "@/lib/muthur-core/survey-auto-connect-ref";
import { parseOperatorOpenJson } from "@/lib/muthur-core/operator-open-file-ref";
import type { MuthurOperatorOpenFileRef } from "@/lib/muthur-core/types";
import { parseGlyphResponseActions, type GlyphCommand } from "@/lib/muthur-glyph-intent";
import type { AsciiRenderRequest } from "@/lib/muthur-ascii-skill/types";
import { applyGlyphActions, GLYPH_CHANNEL_FOCUS_EVENT } from "@/lib/glyph-channel-apply.client";
import {
  buildGlyphContextSnapshot,
  dispatchGlyphPaneMode,
  getGlyphChannelText,
  GLYPH_MODE_UPDATE_EVENT,
  mergeGlyphChannelContent,
  readGlyphModeActive,
  readGlyphPaneSettings,
  renderGlyphOutput,
  setGlyphChannelContent,
  writeGlyphModeActive,
  writeGlyphPaneSettings,
  type GlyphRenderEngine,
} from "@/lib/glyph-channel";
import dynamic from "next/dynamic";
import { PanelLoader } from "@/features/cyberdeck/panel-loader";
import { CyberdeckBootSequence } from "@/components/cyberdeck/boot-sequence";
import { registerCyberdeckRailTab } from "@/components/cyberdeck/cyberdeck-rail-tab";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { DeckModeProvider, loadDeckMode, notifyDeckModeChange, saveDeckMode, type DeckMode } from "@/lib/deck-mode";
import { CyberdeckScrollbarHost } from "@/components/cyberdeck/cyberdeck-scrollbar-host";
import { SurveyHubHost } from "@/features/cyberdeck/survey/survey-hub-host";
import { usePowerfistDeckSocket } from "@/features/cyberdeck/survey/use-powerfist-deck-socket";
import {
  notifySurveyTabClosed,
} from "@/features/cyberdeck/survey/survey-tab-lifecycle";
import { CyberdeckLayoutShell } from "@/features/cyberdeck/layout/cyberdeck-layout-shell";
import { useMobileCyberdeckLayout } from "@/features/cyberdeck/layout/use-mobile-cyberdeck-layout";
import { CustomTabPaneRenderer } from "@/features/cyberdeck/workspace/custom-tab-pane-renderer";
import {
  UI_STATE_STORAGE_KEY,
  useCyberdeckWorkspaceHydration,
} from "@/features/cyberdeck/workspace/use-cyberdeck-workspace-hydration";
import { useCyberdeckHeap } from "@/features/cyberdeck/heap/use-cyberdeck-heap";
import { useCyberdeckOperatorObservation } from "@/features/cyberdeck/observation/use-cyberdeck-operator-observation";
import { useCyberdeckKeyboardNav } from "@/features/cyberdeck/keyboard/use-cyberdeck-keyboard-nav";
import { CyberdeckContextMenus } from "@/features/cyberdeck/workspace/cyberdeck-context-menus";
import { useCustomTabBrowser } from "@/features/cyberdeck/workspace/use-custom-tab-browser";
import { useRailTabContextMenu } from "@/features/cyberdeck/workspace/use-rail-tab-context-menu";
import { OperatorPaneHost } from "@/features/cyberdeck/operator/operator-pane-host";
import { useOperatorWorkspaceState } from "@/features/cyberdeck/operator/use-operator-workspace-state";
import { cn } from "@/lib/utils";
import { useCyberdeckTabStore, getCyberdeckSelectedRailTabId, type CyberdeckServerId } from "@/lib/cyberdeck-tab-store";
import { CyberdeckServerRail } from "@/components/cyberdeck/cyberdeck-server-rail";
import { CyberdeckTabPersistence } from "@/components/cyberdeck/cyberdeck-tab-persistence";
import { OperatorWorkspacePersistence } from "@/components/cyberdeck/operator-workspace-persistence";
import {
  CyberdeckCustomTabPanes,
  CyberdeckFixedServerPane,
} from "@/components/cyberdeck/cyberdeck-pane-slots";
import { type MuthurCommandInputHandle } from "@/components/cyberdeck/muthur-command-input";
import { formatPiScreenContextForMuthur, readPiScreenSnapshot } from "@/lib/pi-screen-context";
import { detectComputerUseMission } from "@/lib/muthur/control/computer-use-intent";
import { isPiControlLeaseUiGatingEnabled } from "@/lib/muthur/control/pi-control-lease-gating.client";
import { parsePiControlLeaseStreamMarker } from "@/lib/muthur/control/pi-control-lease-stream";
import { usePiControlLease } from "@/lib/muthur/control/use-pi-control-lease";
import type { PiControlLeaseRequest } from "@/lib/muthur/control/pi-control-lease-types";
import { queuePiMission } from "@/lib/pi/pi-mission-bridge";
import { MuthurControlLeaseHost } from "@/components/cyberdeck/muthur-control-lease-host";
import { emitSignal, useDeckSignal, type DeckSignal } from "@/lib/cyberdeck/signal-router";
import { summarizeMuthurOperatorEdits } from "@/lib/muthur-operator-edit-summary";
import { useDeckAudioBridge } from "@/lib/cyberdeck/audio-bridge";
import { useSilentModeAudioGateSync } from "@/lib/cyberdeck/use-silent-mode-audio-gate-sync";
import { useSurveyMuthurMissionHandlers } from "@/features/cyberdeck/hooks/use-survey-muthur-mission-handlers";
import { useMuthurChatState } from "@/features/cyberdeck/muthur/use-muthur-chat-state";
import { useMuthurSendIntents } from "@/features/cyberdeck/muthur/use-muthur-send-intents";
import { useMuthurChatSend } from "@/features/cyberdeck/muthur/use-muthur-chat-send";
import { useCyberdeckVoice } from "@/features/cyberdeck/voice/use-cyberdeck-voice";
import { useMuthurCommanderHandlers } from "@/features/cyberdeck/muthur/use-muthur-commander-handlers";
import {
  hasAnyProviderClientKey,
  useProviderConnection,
} from "@/features/cyberdeck/gateway/use-provider-connection";
import { GatewayColumn } from "@/features/cyberdeck/gateway/gateway-column";
import { useGatewayPaneState } from "@/features/cyberdeck/gateway/use-gateway-pane-state";
import { MuthurChatColumn } from "@/features/cyberdeck/muthur/muthur-chat-column";
import {
  defaultCustomTabGlyphForKind,
  defaultCustomTabLabelForKind,
  isUnassignedCustomTab,
  parseCustomTabCommand,
  sanitizeCustomTabs,
  type CustomTab,
  type CustomTabKind,
  ENABLE_CARD_TABLE,
  safeServerId,
  SERVER_IDS,
  servers,
  type ServerId,
  type ServerRailButton,
} from "@/features/cyberdeck/workspace/custom-tab-model";
import {
  buildCyberdeckChatHistory,
  getOperatorFileKind,
  isEditableOperatorFile,
  parseCodingVerifyHeader,
  readFileAsDataUrl,
  contextMenuTargetIsTextField,
  type DroppedOperatorAsset,
} from "@/features/cyberdeck/muthur/coding-verify-format";
import { loadIdentityBundle } from "@/lib/identity/load-identity";
import type { Identity } from "@/lib/identity/identity-types";
import { loadOrchestrationBundle } from "@/lib/orchestration/load-orchestration";
import type { OrchestrationBundle } from "@/lib/orchestration/orchestration-types";
import { ENABLE_AUTOMATION } from "@/lib/cyberdeck/automation-config";
import { formatUplinkErrorDetail } from "@/lib/cyberdeck/format-uplink-error";
import { parseFoundationQuery } from "@/lib/muthur-foundation-intent";
import { parseAionQuery } from "@/lib/muthur-aion-intent";
import { parseDocumentOpenIntent } from "@/lib/muthur-document-open-intent";

const ActivatedCyberdeckPane = dynamic(
  () =>
    import("@/features/cyberdeck/activated-cyberdeck-pane").then((m) => ({
      default: m.ActivatedCyberdeckPane,
    })),
  { ssr: false, loading: () => <PanelLoader label="SUBSYSTEM" /> },
);

const LazyCardTablePaneHost = dynamic(
  () =>
    import("@/features/cyberdeck/card-table-pane-host").then((m) => ({
      default: m.CardTablePaneHost,
    })),
  { ssr: false, loading: () => <PanelLoader label="CARD TABLE" /> },
);

const LazyIndicateOverlay = dynamic(() => import("@/lib/computer-use/IndicateOverlay"), {
  ssr: false,
  loading: () => null,
});

const fixedServers = [
  { id: "m", glyph: "Ø", label: "ØPERATOR" },
  { id: "s", glyph: "μ", label: "MAINNET-UPLINK" },
  ...(ENABLE_CARD_TABLE ? [{ id: "ct", glyph: "◈", label: "CARD TABLE" }] : []),
  { id: "b", glyph: "§", label: "SETTINGS" },
];

export default function CyberdeckApp() {
  // Start on the operator tab; disconnected users are redirected to MAINNET-UPLINK after hydration.
  // Tab rail + pane visibility: zustand store (page must not subscribe).
  useEffect(() => {
    registerCyberdeckRailTab();
  }, []);

  const {
    inputHistory,
    setInputHistory,
    canSendInput,
    handleCanSendInputChange,
    messages,
    setMessages,
    setMessagesRaw,
    muthurDiagnostics,
    setMuthurDiagnostics,
    muthurStall,
    setMuthurStall,
    muthurResponseFailed,
    setMuthurResponseFailed,
    composeStartedAtRef,
    chatUserDisplayName,
    setChatUserDisplayName,
    chatHydrated,
    isStreaming,
    setIsStreaming,
    streamText,
    setStreamText,
    streamToolTrace,
    setStreamToolTrace,
    chatPinnedToBottom,
    setChatPinnedToBottom,
    generatedUI,
    setGeneratedUI,
  } = useMuthurChatState();

  const piControlLease = usePiControlLease();
  const piControlLeaseRefresh = piControlLease.refresh;
  const piControlLeaseRetake = piControlLease.retake;
  const {
    muthurPosture,
    muthurMission,
    muthurDelegations,
    muthurInhabitant,
    handleMuthurPostureChange,
    handleMuthurInhabitantChange,
    handleCreateMuthurMission,
    handleStartMuthurMission,
    handleCreateMuthurDelegation,
    handleDispatchMuthurDelegation,
    handleRecordMuthurDelegationResult,
    handleCancelMuthurDelegation,
    archiveMuthurHistoryLine,
    emitMuthurCognition,
    muthurCognitionStatusLine,
  } = useMuthurCommanderHandlers({
    setMessages,
    setMuthurDiagnostics,
    piControlLeaseRefresh,
    piControlLeaseRetake,
  });

  const playModelTestErrorSound = useCallback((line: string) => {
    if (line.includes("VALID_RESPONSE")) {
      playDeckRaceReadySetGo();
      return;
    }
    if (line.includes("HTTP_401")) {
      playDeckDroidDizzy401();
      return;
    }
    if (line.includes("HTTP_400")) {
      playDeckDroidDizzy400();
      return;
    }
    if (line.includes("HTTP_429")) {
      playDeckOutOfGas429();
      return;
    }
    if (line.includes("EMPTY_PROBE")) {
      playDeckDeclined();
      return;
    }
    if (line.includes("FAILURE")) {
      playDeckWrongDoorShut();
    }
  }, []);

  const {
    activeProvider,
    providerKeys,
    setProviderKeys,
    modelID,
    modelList,
    providers,
    hasProviderAuth,
    isConnected,
    connectionState,
    providerConnectionLabel,
    providerModelFetchStatus,
    scanActivityActive,
    credentialReplaceProvider,
    setCredentialReplaceProvider,
    gatewayKeyDraft,
    setGatewayKeyDraft,
    modelFetchStatusByProvider,
    rateLimitedProviders,
    modelHealthByProvider,
    probeInFlightByProvider,
    defaultKeyAvailableByProvider,
    didHydrateProviderState,
    providerConfigHydrated,
    handleProviderClick,
    submitGatewayKey,
    activateModelById,
    fetchModelsForProvider,
    providerHasKey,
    setModelHealth,
    setVerifiedProviders,
    setModelFetchStatusByProvider,
    setRateLimitedProviders,
    providerRateLimitUntilRef,
  } = useProviderConnection({
    setMessages,
    setMuthurDiagnostics,
    playModelTestErrorSound,
  });

  const {
    voiceEnabled,
    voicePlaybackBusy,
    voiceBlockFocusIndex,
    voiceBlockTotal,
    voiceDial,
    sonarVolume,
    deckSfxVolume,
    voiceHealth,
    speakDeckVoiceLine,
    abortMotherSpeech,
    toggleVoiceEnabled,
    speakVoiceBlockAtIndex,
    replayFullLastAssistant,
    handleDeckSfxVolumeChange,
    handleVoiceVolumeChange,
    handleSonarVolumeChange,
  } = useCyberdeckVoice({
    messages,
    isStreaming,
    openaiApiKey: providerKeys.openai || "",
    setMessages,
  });

  const networkActivityActive = scanActivityActive || isStreaming;
  const [droppedMarkdown, setDroppedMarkdown] = useState<string | null>(null);
  const [droppedMarkdownName, setDroppedMarkdownName] = useState<string>("");
  const [glyphModeActive, setGlyphModeActive] = useState(false);
  const [isMarkdownDragOver, setIsMarkdownDragOver] = useState(false);
  const openRealmorphismKitTabRef = useRef<(tabId?: string) => void>(() => undefined);
  const handleTabClickRef = useRef<
    (
      id: string,
      anchor?: {
        clientX: number;
        clientY: number;
      },
    ) => boolean
  >(() => false);

  const [showCardTablePane, setShowCardTablePane] = useState(false);
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  /** Right-click menu for the main chat / Echo Mirage pane (viewport-clamped like rail tabs). */
  const [mirageContextMenu, setMirageContextMenu] = useState<{ x: number; y: number } | null>(null);
  /** Right-click menu for gateway column surfaces (settings, operator, connection, custom tabs). */
  const [gatewayPaneContextMenu, setGatewayPaneContextMenu] = useState<{ x: number; y: number } | null>(
    null,
  );
  const { isMobileLayout, handleContentSplitSizesChange, mirageHeaderCollapse } =
    useMobileCyberdeckLayout();

  const {
    providerKeyboardHighlightId,
    setProviderKeyboardHighlightId,
    modelKeyboardHighlightId,
    setModelKeyboardHighlightId,
    gatewayColumnRef,
    gatewayConnectionPanelRef,
    focusGatewayConnectionPanel,
  } = useGatewayPaneState({
    isMobileLayout,
    activeProvider,
    modelList,
  });

  const [muthurMemory, setMuthurMemory] = useState<MuthurMemoryState>(() => createEmptyMuthurMemory());
  const [muthurMemoryHydrated, setMuthurMemoryHydrated] = useState(false);
  const [muthurMemoryLoadError, setMuthurMemoryLoadError] = useState<string | null>(null);
  const [deckMode, setDeckMode] = useState<DeckMode>(() => loadDeckMode());
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [orchestration, setOrchestration] = useState<OrchestrationBundle | null>(null);

  /** Escape from gateway → tab rail; Escape from tab rail → gateway. Arrows move highlight while on rail. */
  const [navRailContext, setNavRailContext] = useState<"gateway" | "tabs">("gateway");
  const [serverKeyboardHighlightId, setServerKeyboardHighlightId] = useState<(typeof SERVER_IDS)[number] | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<MuthurCommandInputHandle>(null);
  const messageScrollRef = useRef<HTMLDivElement>(null);
  const muthurChatScrollContentRef = useRef<HTMLDivElement>(null);
  const serverRailRef = useRef<HTMLElement | null>(null);
  const chatColumnRef = useRef<HTMLDivElement>(null);
  const gatewayBlankSettingsRef = useRef<HTMLDivElement>(null);
  const cyberdeckRootRef = useRef<HTMLDivElement>(null);
  const chatAbortRef = useRef<AbortController | null>(null);
  const steerAbortRef = useRef(false);
  const steerPendingRef = useRef<{
    userMessage: string;
    options?: { preserveSelectedSurface?: boolean; surveyMission?: boolean };
  } | null>(null);
  const muthurMemoryRef = useRef<MuthurMemoryState>(createEmptyMuthurMemory());
  const offlineAutoOpenedRef = useRef(false);
  const startupRailResolvedRef = useRef(false);
  const prevConnectionStateRef = useRef<"offline" | "connecting" | "connected">("offline");
  const serverRef = useRef<CyberdeckServerId>("m");
  const restoreOperatorUiRef = useRef<
    (ui: { operatorSurfaceMode?: "workspace" | "browser"; operatorBrowserUrl?: string }) => void
  >(() => undefined);
  const operatorSurfaceModeRef = useRef<"workspace" | "browser">("workspace");
  const operatorBrowserUrlRef = useRef("");
  const getOperatorSurfaceMode = useCallback(() => operatorSurfaceModeRef.current, []);
  const getOperatorBrowserUrl = useCallback(() => operatorBrowserUrlRef.current, []);

  useEffect(() => {
    const unsub = useCyberdeckTabStore.subscribe((state) => {
      serverRef.current = state.server;
    });
    serverRef.current = useCyberdeckTabStore.getState().server;
    return unsub;
  }, []);

  const {
    workspaceHydrated,
    deckUiHydrated,
    buildCyberdeckUiPayload,
    clearSavedCustomTabState,
  } = useCyberdeckWorkspaceHydration({
    restoreOperatorUiFromDeck: (ui) => restoreOperatorUiRef.current(ui),
    getOperatorSurfaceMode,
    getOperatorBrowserUrl,
    navRailContext,
    setNavRailContext,
    serverKeyboardHighlightId,
    setServerKeyboardHighlightId,
    providerConfigHydrated,
    gatewayColumnRef,
    serverRailRef,
    startupRailResolvedRef,
    setMessages,
  });

const operatorWorkspace = useOperatorWorkspaceState({
    deckUiHydrated,
    setNavRailContext,
    setMessages,
    getActiveServerId: () => serverRef.current,
  });
  const {
    operatorDroppedAsset,
    operatorSurfaceMode,
    operatorBrowserEngine,
    operatorDocMode,
    operatorDocNameDraft,
    operatorFileHistory,
    operatorFileHistoryIndex,
    operatorActiveFilePath,
    operatorFolderRootsRef,
    operatorFolderRootsCount,
    operatorBrowserUrl,
    operatorBrowserSnapshot,
    operatorEditorRef,
    operatorNameInputRef,
    operatorBrowserRef,
    operatorPreviewBlobUrlRef,
    operatorSurfaceIsDocument,
    setOperatorDocNameDraft,
    setOperatorSurfaceMode,
    setOperatorBrowserUrl,
    setOperatorDocMode,
    setOperatorBrowserEngine,
    restoreOperatorUiFromDeck,
    captureOperatorBrowserSnapshot,
    openOperatorBrowser,
    performBrowserCommand,
    openOperatorFile,
    navigateOperatorFileHistory,
    openConvertedMarkdownInOperator,
    openWorkspaceFileInOperator,
    handleSetOperatorDocMode,
    handleOperatorDocumentKindChange,
    handleOperatorDocumentTextChange,
    commitOperatorDocName,
    clearOperatorDocument,
    copyOperatorDocToClipboard,
    saveOperatorDocInPlace,
    saveOperatorDocAsFile,
    saveOperatorDocument,
    exportOperatorMarkdown,
    pasteClipboardToOperator,
    openOperatorFolderFile,
    handleOperatorFolderRootsChange,
    reloadOperatorFolderFile,
    isOperatorDragOver,
    handleOperatorDragOver,
    handleOperatorDragLeave,
    handleOperatorDrop,
    showSurveyOperatorImage,
    loadOperatorAssetFromFile,
    setOperatorTextAsset,
    assignOperatorAsset,
  } = operatorWorkspace;
  restoreOperatorUiRef.current = restoreOperatorUiFromDeck;
  operatorSurfaceModeRef.current = operatorSurfaceMode;
  operatorBrowserUrlRef.current = operatorBrowserUrl;

  const { heapEntries, pasteClipboardToHeap } = useCyberdeckHeap({
    openOperatorFile,
    setOperatorTextAsset,
    setOperatorSurfaceMode,
    setOperatorDocMode,
    setNavRailContext,
  });

  useCyberdeckOperatorObservation({
    deckUiHydrated,
    operatorSurfaceMode,
    operatorDroppedAsset,
    operatorSurfaceIsDocument,
    operatorActiveFilePath,
    operatorDocMode,
    operatorBrowserUrl,
    messages,
    streamText,
    chatUserDisplayName,
  });

  /** Forward Tab from message box cycles: gateway (right) → rail (left) → chat log (col2) → … */
  const syncGlyphChannelTabGlyphs = useCallback(() => {
    useCyberdeckTabStore.getState().setCustomTabs((prev) =>
      prev.map((tab) =>
        tab.kind === "glyph-channel" ? { ...tab, glyph: "⟁", label: "⟁ GLYPH" } : tab,
      ),
    );
  }, []);

  const focusGlyphChannelTab = useCallback(() => {
    const customTabs = useCyberdeckTabStore.getState().customTabs;
    const existing = customTabs.find((tab) => tab.kind === "glyph-channel");
    if (existing) {
      useCyberdeckTabStore.getState().setActiveCustomTabId(existing.id);
      syncGlyphChannelTabGlyphs();
    } else {
      const id = `tab-${crypto.randomUUID()}`;
      useCyberdeckTabStore.getState().setCustomTabs((prev) => [
        ...prev,
        { id, label: "⟁ GLYPH", glyph: "⟁", kind: "glyph-channel" },
      ]);
      useCyberdeckTabStore.getState().setActiveCustomTabId(id);
    }
    setNavRailContext("tabs");
    playDeckSystemSound("chirp", 0.05);
  }, [syncGlyphChannelTabGlyphs]);

  const railGlyphForServer = useCallback(
    (btn: ServerRailButton) => {
      if (glyphModeActive && btn.id === "s") return "⟁";
      return btn.glyph;
    },
    [glyphModeActive],
  );

  const railGlyphForCustomTab = useCallback((tab: CustomTab) => {
    if (tab.kind === "glyph-channel") return "⟁";
    return tab.glyph;
  }, []);

  const renderGlyphToChannel = useCallback(
    async (options: {
      engine: GlyphRenderEngine;
      text: string;
      font?: string;
      merge?: "append" | "replace";
      decorate?: boolean;
    }) => {
      const { engine, text, font, merge, decorate } = options;
      const paneSettings = readGlyphPaneSettings();
      const figletFont = font?.trim() || paneSettings.figletFont;
      const usesFigletFont = engine === "figlet";
      if (usesFigletFont && font?.trim()) {
        writeGlyphPaneSettings({ ...paneSettings, figletFont: font.trim() });
      }

      const existing = await getGlyphChannelText();
      const output = await renderGlyphOutput({
        engine,
        text,
        font: usesFigletFont ? figletFont : undefined,
        decorate,
      });
      const mergeMode =
        merge ??
        (existing.trim() ? "append" : "replace");
      const merged = mergeGlyphChannelContent(existing, output, mergeMode);
      await setGlyphChannelContent(merged, {
        scrollToBottom: mergeMode === "append",
      });
      focusGlyphChannelTab();
      return merged;
    },
    [focusGlyphChannelTab],
  );

  const setRawGlyphChannelText = useCallback(
    async (raw: string, merge: "append" | "replace" = "replace") => {
      const existing = await getGlyphChannelText();
      const merged = mergeGlyphChannelContent(existing, raw, merge);
      await setGlyphChannelContent(merged, { scrollToBottom: merge === "append" });
      focusGlyphChannelTab();
      return merged;
    },
    [focusGlyphChannelTab],
  );

  const renderAsciiSkillToChannel = useCallback(
    async (request: AsciiRenderRequest) => {
      const res = await fetch("/api/ascii/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      const payload = (await res.json()) as { ok?: boolean; output?: string; error?: string };
      if (!payload.ok || typeof payload.output !== "string") {
        throw new Error(payload.error || "ascii.render failed");
      }
      await setRawGlyphChannelText(payload.output, request.merge ?? "append");
      return payload.output;
    },
    [setRawGlyphChannelText],
  );

  const applyGlyphActionsFromMuthur = useCallback(
    async (actions: Parameters<typeof applyGlyphActions>[0]) => {
      await applyGlyphActions(actions);
    },
    [],
  );

  useEffect(() => {
    const handler = () => {
      focusGlyphChannelTab();
    };
    window.addEventListener(GLYPH_CHANNEL_FOCUS_EVENT, handler);
    return () => window.removeEventListener(GLYPH_CHANNEL_FOCUS_EVENT, handler);
  }, [focusGlyphChannelTab]);

  const handleGlyphOperatorCommand = useCallback(
    async (command: GlyphCommand) => {
      switch (command.kind) {
        case "mode-on":
          setGlyphModeActive(true);
          writeGlyphModeActive(true);
          syncGlyphChannelTabGlyphs();
          focusGlyphChannelTab();
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              text: "⟁ Glyph mode active. Compose in chat or the ⟁ tab — ask MUTHUR to suggest fonts or render figlet/ascii.",
            },
          ]);
          return;
        case "mode-off":
          setGlyphModeActive(false);
          writeGlyphModeActive(false);
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              text: "⟁ Glyph mode off. Chat input resumes normal routing.",
            },
          ]);
          return;
        case "clear":
          await setGlyphChannelContent("");
          focusGlyphChannelTab();
          setMessages((prev) => [
            ...prev,
            { role: "assistant", text: "⟁ Glyph Channel cleared." },
          ]);
          return;
        case "copy": {
          const text = await getGlyphChannelText();
          await copyTextToClipboard(text);
          setMessages((prev) => [
            ...prev,
            { role: "assistant", text: "⟁ Glyph Channel copied to clipboard." },
          ]);
          return;
        }
        case "edit-on":
          dispatchGlyphPaneMode("edit");
          focusGlyphChannelTab();
          setMessages((prev) => [
            ...prev,
            { role: "assistant", text: "⟁ Glyph Channel edit mode on." },
          ]);
          return;
        case "edit-off":
          dispatchGlyphPaneMode("view");
          focusGlyphChannelTab();
          setMessages((prev) => [
            ...prev,
            { role: "assistant", text: "⟁ Glyph Channel view mode." },
          ]);
          return;
        case "set":
          await setRawGlyphChannelText(command.text, command.merge ?? "replace");
          setMessages((prev) => [
            ...prev,
            { role: "assistant", text: "⟁ Pasted art to Glyph Channel." },
          ]);
          return;
        case "render":
          await renderGlyphToChannel({
            engine: command.engine,
            text: command.text,
            font: command.font,
            merge: command.merge,
            decorate: command.decorate,
          });
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              text: `⟁ Rendered to Glyph Channel (${command.engine}${command.font ? ` // ${command.font}` : ""}).`,
            },
          ]);
          return;
        case "ascii-skill":
          await renderAsciiSkillToChannel(command.request);
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              text: `⟁ ASCII skill rendered (${command.request.template} // ${command.request.style ?? "echo_mirage"}).`,
            },
          ]);
          return;
      }
    },
    [focusGlyphChannelTab, renderAsciiSkillToChannel, renderGlyphToChannel, setRawGlyphChannelText, syncGlyphChannelTabGlyphs],
  );

  useDeckAudioBridge();
  useSilentModeAudioGateSync();

  useEffect(() => {
    const onCadreArchive = (event: Event) => {
      const detail = (event as CustomEvent<{ text?: string }>).detail;
      const text = typeof detail?.text === "string" ? detail.text.trim() : "";
      if (!text) return;
      setMuthurDiagnostics((current) => appendMuthurDiagnosticEntry(current, text));
      setMessagesRaw((prev) => [...prev, { role: "assistant", text }]);
    };

    window.addEventListener(CADRE_MUTHUR_ARCHIVE_EVENT, onCadreArchive);
    return () => window.removeEventListener(CADRE_MUTHUR_ARCHIVE_EVENT, onCadreArchive);
  }, [setMessagesRaw, setMuthurDiagnostics]);

  useEffect(() => {
    if (!ENABLE_AUTOMATION) return;
    let dispose: (() => void) | undefined;
    void import("@/lib/cyberdeck/operator-orchestrator").then(({ startOperatorOrchestrator }) => {
      dispose = startOperatorOrchestrator();
    });
    return () => {
      dispose?.();
    };
  }, []);

  useEffect(() => {
    loadIdentityBundle().then((bundle) => {
      setIdentity(bundle.identity);
    });
    loadOrchestrationBundle().then((bundle) => {
      setOrchestration(bundle);
    });
  }, []);

  const clearMuthurMemoryState = useCallback(async () => {
    if (typeof window !== "undefined") {
      const confirmed = window.confirm("Clear MUTHUR memory?");
      if (!confirmed) return;
    }

    await clearMuthurMemory();
    const fresh = createEmptyMuthurMemory();
    muthurMemoryRef.current = fresh;
    setMuthurMemory(fresh);
    setMuthurMemoryHydrated(true);
    toast.success("MUTHUR memory cleared");
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { state: loaded, error: loadErr } = await loadMuthurMemoryWithResult();
      if (cancelled) return;
      muthurMemoryRef.current = loaded;
      setMuthurMemory(loaded);
      setMuthurMemoryLoadError(loadErr);
      setMuthurMemoryHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!muthurMemoryHydrated) return;
    muthurMemoryRef.current = muthurMemory;
    void saveMuthurMemory(muthurMemory);
  }, [muthurMemory, muthurMemoryHydrated]);

  useEffect(() => {
    saveDeckMode(deckMode);
    notifyDeckModeChange(deckMode);
  }, [deckMode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    void import("@/features/cyberdeck/pane-chunks").then((mod) => {
      for (const kind of mod.PREFETCH_PANE_KINDS) {
        mod.prefetchCyberdeckPane(kind);
      }
    });
  }, []);

  useEffect(() => {
    const active = readGlyphModeActive();
    setGlyphModeActive(active);
    if (active) syncGlyphChannelTabGlyphs();
  }, [syncGlyphChannelTabGlyphs]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (event: Event) => {
      const active = (event as CustomEvent<{ active?: boolean }>).detail?.active;
      if (typeof active === "boolean") {
        setGlyphModeActive(active);
        if (active) syncGlyphChannelTabGlyphs();
      }
    };
    window.addEventListener(GLYPH_MODE_UPDATE_EVENT, handler);
    return () => window.removeEventListener(GLYPH_MODE_UPDATE_EVENT, handler);
  }, [syncGlyphChannelTabGlyphs]);

  const closeMirageContextMenu = useCallback(() => {
    setMirageContextMenu(null);
    emitSignal({ source: "ui", type: "cancel", payload: { target: "mirage_menu" }, severity: "info" });
  }, []);

  const closeGatewayPaneContextMenu = useCallback(() => {
    setGatewayPaneContextMenu(null);
    emitSignal({ source: "ui", type: "cancel", payload: { target: "gateway_menu" }, severity: "info" });
  }, []);


  const muthurChatScrollKey = useMemo(() => {
    const lastDiag = muthurDiagnostics.entries.at(-1);
    return buildMuthurChatScrollKey({
      messages,
      streamText,
      isStreaming,
      streamToolTrace,
      diagnosticsEntryCount: muthurDiagnostics.entries.length,
      lastDiagnosticId: lastDiag?.id,
      lastDiagnosticRepeatCount: lastDiag?.repeatCount,
      responseStallElapsedMs: muthurStall?.elapsedMs,
      cognitionStatusLine: muthurCognitionStatusLine,
    });
  }, [
    messages,
    streamText,
    isStreaming,
    streamToolTrace,
    muthurDiagnostics,
    muthurStall,
    muthurCognitionStatusLine,
  ]);

  const muthurStreamReasoning = useMemo(
    () => extractMuthurStreamReasoning(streamText).reasoning,
    [streamText],
  );

  const { handleScroll: handleMuthurChatScroll, pinToBottom: pinMuthurChatToBottom } =
    useMuthurChatAutoScroll({
      scrollKey: muthurChatScrollKey,
      isStreaming,
      pinnedToBottom: chatPinnedToBottom,
      setPinnedToBottom: setChatPinnedToBottom,
      messageScrollRef,
      scrollContentRef: muthurChatScrollContentRef,
    });

  const appendMuthurAssistantMessage = useCallback((text: string) => {
    setMessagesRaw((prev) => [...prev, { role: "assistant", text }]);
  }, [setMessagesRaw]);

  const { chatKeyboardHighlightIndex, setChatKeyboardHighlightIndex } = useCyberdeckKeyboardNav({
    navRailContext,
    setNavRailContext,
    serverKeyboardHighlightId,
    setServerKeyboardHighlightId,
    providerKeyboardHighlightId,
    setProviderKeyboardHighlightId,
    modelKeyboardHighlightId,
    setModelKeyboardHighlightId,
    activeProvider,
    modelList,
    messages,
    streamText,
    isStreaming,
    activateModelById,
    handleProviderClick,
    pasteClipboardToOperator,
    cyberdeckRootRef,
    serverRailRef,
    chatColumnRef,
    gatewayColumnRef,
    messageInputRef,
    messageScrollRef,
    serverRef,
    handleTabClickRef,
  });


  const screenshotRef = useRef<string | null>(null);

  const handlePasteImageToChat = useCallback((dataUrl: string) => {
    screenshotRef.current = dataUrl;
    void loadComputerUse().then((cu) => {
      cu.setLastSurfaceClassification({
        surface: "unknown",
        confidence: "low",
        reason: "Screenshot available for inspection",
        rawTitle: "Screenshot",
      });
    });
  }, []);

  const {
    isClearChatIntent,
    handleClearChatIntent,
    tryHandleSurveyAndGlyphIntents,
    tryHandleHelpAndAtlasIntents,
  } = useMuthurSendIntents({
    handleGlyphOperatorCommand,
    abortMotherSpeech,
    chatAbortRef,
    steerPendingRef,
    steerAbortRef,
    setMuthurResponseFailed,
    setChatKeyboardHighlightIndex,
    setGeneratedUI,
    screenshotRef,
    messageInputRef,
    setMessages,
    setMuthurDiagnostics,
    setIsStreaming,
    setStreamText,
    setStreamToolTrace,
    setMuthurStall,
    composeStartedAtRef,
  });

  const handleModelLabelClick = useCallback((targetServer: "s" | "ct" | "b" = "s") => {
    const safe = safeServerId(targetServer);
    useCyberdeckTabStore.getState().setActiveCustomTabId(null);
    useCyberdeckTabStore.getState().setServer(safe as (typeof SERVER_IDS)[number]);
    setNavRailContext("gateway");
    setServerKeyboardHighlightId(null);
    setProviderKeyboardHighlightId(activeProvider);
    setModelKeyboardHighlightId(modelID || null);
    gatewayColumnRef.current?.focus({ preventScroll: true });
    if (safe === "s") {
      focusGatewayConnectionPanel();
    } else {
      gatewayBlankSettingsRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    }
  }, [activeProvider, focusGatewayConnectionPanel, modelID]);

  const focusFixedServerPanel = useCallback(
    (serverId: (typeof SERVER_IDS)[number]) => {
      if (serverId === "s") {
        handleModelLabelClick("s");
        return;
      }
      if (serverId === "ct") {
        handleModelLabelClick("ct");
        return;
      }
      if (serverId === "b") {
        handleModelLabelClick("b");
        return;
      }
      gatewayColumnRef.current?.focus({ preventScroll: true });
    },
    [handleModelLabelClick],
  );

  const openOperatorPaneOnStartup = useCallback(() => {
    useCyberdeckTabStore.getState().setActiveCustomTabId(null);
    useCyberdeckTabStore.getState().setServer("m");
    setNavRailContext("tabs");
    setServerKeyboardHighlightId("m");
    setOperatorSurfaceMode("workspace");
    setOperatorDocMode("edit");
    startupRailResolvedRef.current = true;
  }, []);

  useEffect(() => {
    if (!ENABLE_AUTOMATION) return;
    if (!didHydrateProviderState || !providerConfigHydrated || startupRailResolvedRef.current) return;

    if (hasAnyProviderClientKey(providerKeys, defaultKeyAvailableByProvider)) {
      openOperatorPaneOnStartup();
      return;
    }

    if (connectionState === "offline") {
      handleModelLabelClick("s");
      offlineAutoOpenedRef.current = true;
      startupRailResolvedRef.current = true;
    }
  }, [
    connectionState,
    defaultKeyAvailableByProvider,
    didHydrateProviderState,
    handleModelLabelClick,
    openOperatorPaneOnStartup,
    providerConfigHydrated,
    providerKeys,
  ]);

  useEffect(() => {
    if (!ENABLE_AUTOMATION) return;
    const prevState = prevConnectionStateRef.current;
    prevConnectionStateRef.current = connectionState;

    if (connectionState === "connected" && prevState !== "connected") {
      const activeModel = modelID || "UNSET_MODEL";
      const line = `MODEL_CONNECTED // ${activeProvider.toUpperCase()} / ${activeModel}`;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "system" && last.text === line) return prev;
        return [...prev, { role: "system", text: line }];
      });
    }

    if (
      didHydrateProviderState &&
      providerConfigHydrated &&
      connectionState === "offline" &&
      !offlineAutoOpenedRef.current &&
      !hasAnyProviderClientKey(providerKeys, defaultKeyAvailableByProvider)
    ) {
      handleModelLabelClick("s");
      offlineAutoOpenedRef.current = true;
      return;
    }
    if (connectionState !== "offline") {
      offlineAutoOpenedRef.current = false;
    }
  }, [activeProvider, connectionState, didHydrateProviderState, defaultKeyAvailableByProvider, handleModelLabelClick, modelID, providerConfigHydrated, providerKeys]);

  const handleThirdColumnDragOver = useCallback((e: ReactDragEvent<HTMLDivElement>) => {
    if (serverRef.current !== "m" && serverRef.current !== "s") return;
    e.preventDefault();
    setIsMarkdownDragOver(true);
  }, []);

  const handleThirdColumnDragLeave = useCallback((e: ReactDragEvent<HTMLDivElement>) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsMarkdownDragOver(false);
  }, []);

  const handleThirdColumnDrop = useCallback(async (e: ReactDragEvent<HTMLDivElement>) => {
    const activeServer = serverRef.current;
    if (activeServer !== "m" && activeServer !== "s") return;

    e.preventDefault();
    setIsMarkdownDragOver(false);

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    if (activeServer === "s") {
      const looksText = isEditableOperatorFile(file) || file.type === "text/markdown";
      if (!looksText) return;
      try {
        const text = await file.text();
        setDroppedMarkdown(text);
        setDroppedMarkdownName(file.name);
      } catch {
        // ignore failed file read
      }
      return;
    }

    if (activeServer === "m") {
      const dropPath = `drop://${file.name}#${file.lastModified}`;
      await openOperatorFile(dropPath, () => loadOperatorAssetFromFile(file));
    }
  }, [loadOperatorAssetFromFile, openOperatorFile]);

  const updateCustomTab = useCallback((tabId: string, updater: (tab: CustomTab) => CustomTab) => {
    useCyberdeckTabStore.getState().setCustomTabs((prev) =>
      prev.map((tab) => (tab.id === tabId ? updater(tab as CustomTab) : (tab as CustomTab))),
    );
  }, []);

  const convertCustomTab = useCallback(
    (
      tabId: string,
      nextKind: CustomTabKind,
      options?: {
        label?: string;
        glyph?: string;
      },
    ) => {
      const sourceTab = useCyberdeckTabStore.getState().customTabs.find((t) => t.id === tabId);
      if (!sourceTab) return;
      if (!isUnassignedCustomTab(sourceTab)) return;

      if (nextKind === "document") {
        const sourceAsset = sourceTab.asset as DroppedOperatorAsset | null | undefined;
        flushSync(() => {
          if (sourceAsset) {
            assignOperatorAsset(sourceAsset);
          }
          const store = useCyberdeckTabStore.getState();
          store.setActiveCustomTabId(null);
          store.setServer("m");
          store.mountFixedServer("m");
        });
        setNavRailContext("gateway");
        setMessages((prev) => [
          ...prev,
          {
            role: "system",
            text: sourceAsset
              ? `TAB_DOCUMENT // OPENED ØPERATOR // ${sourceAsset.name}`
              : "TAB_DOCUMENT // OPENED ØPERATOR WORKSPACE",
          },
        ]);
        playDeckSystemSound("chirp", 0.05);
        return;
      }

      flushSync(() => {
        updateCustomTab(tabId, (tab) => {
          const nextLabel = options?.label || tab.label || nextKind.toUpperCase();
          const nextGlyph = options?.glyph || tab.glyph || defaultCustomTabGlyphForKind(nextKind);

          return {
            ...tab,
            kind: nextKind,
            label: nextLabel,
            glyph: nextGlyph,
            browserUrl: nextKind === "web" ? tab.browserUrl || OPERATOR_BROWSER_HOME_URL : undefined,
            asset: null,
          };
        });
        const store = useCyberdeckTabStore.getState();
        store.setActiveCustomTabId(tabId);
        store.mountCustomTab(tabId);
      });
      setNavRailContext("tabs");
      setMessages((prev) => [
        ...prev,
        {
          role: "system",
          text: `TAB_CONVERTED // ${tabId} // ${nextKind.toUpperCase()}`,
        },
      ]);
      playDeckSystemSound("chirp", 0.05);
    },
    [assignOperatorAsset, setMessages, setNavRailContext, updateCustomTab],
  );


  const { customTabBrowserNavigate, handleCustomTabDrop } = useCustomTabBrowser({
    updateCustomTab,
    setNavRailContext,
    setMessages,
  });

  const {
    railTabContextMenu,
    closeRailTabContextMenu,
    openRailTabContextMenu,
    openNewTabMenu,
    applyTabMenuAction,
  } = useRailTabContextMenu({
    closeMirageContextMenu,
    closeGatewayPaneContextMenu,
    convertCustomTab,
    openRealmorphismKitTab: (tabId) => openRealmorphismKitTabRef.current(tabId),
    setNavRailContext,
    setMessages,
  });

  const openRealmorphismKitTab = useCallback(
    (tabId?: string) => {
      closeRailTabContextMenu();
      closeMirageContextMenu();
      closeGatewayPaneContextMenu();

      const targetTabId = tabId || `tab-${crypto.randomUUID()}`;

      flushSync(() => {
        const store = useCyberdeckTabStore.getState();
        const existing = store.customTabs.some((tab) => tab.id === targetTabId);

        if (existing) {
          store.setCustomTabs((prev) =>
            prev.map((tab) =>
              tab.id === targetTabId
                ? {
                    ...tab,
                    label: "REALMORPHISM KIT",
                    glyph: "K",
                    kind: "realmorphism-kit",
                    browserUrl: undefined,
                    asset: null,
                  }
                : tab,
            ),
          );
        } else {
          store.setCustomTabs((prev) => [
            ...prev,
            {
              id: targetTabId,
              label: "REALMORPHISM KIT",
              glyph: "K",
              kind: "realmorphism-kit",
              asset: null,
            },
          ]);
        }

        store.setActiveCustomTabId(targetTabId);
        store.mountCustomTab(targetTabId);
      });

      setNavRailContext("tabs");
      setMessages((prev) => [
        ...prev,
        { role: "system", text: "TAB_KIT // REALMORPHISM REGISTRY OPENED" },
      ]);
      playDeckSystemSound("chirp", 0.05);
    },
    [closeGatewayPaneContextMenu, closeMirageContextMenu, closeRailTabContextMenu],
  );
  openRealmorphismKitTabRef.current = openRealmorphismKitTab;

  const deleteActiveTab = useCallback(() => {
    closeRailTabContextMenu();
    closeMirageContextMenu();
    closeGatewayPaneContextMenu();
    const activeCustomTabId = useCyberdeckTabStore.getState().activeCustomTabId;
    if (!activeCustomTabId) return;
    const closingTab = useCyberdeckTabStore
      .getState()
      .customTabs.find((tab) => tab.id === activeCustomTabId);
    useCyberdeckTabStore.getState().setCustomTabs((prev) => prev.filter((tab) => tab.id !== activeCustomTabId));
    useCyberdeckTabStore.setState((state) => ({
      mountedCustomTabIds: state.mountedCustomTabIds.filter((id) => id !== activeCustomTabId),
    }));
    useCyberdeckTabStore.getState().setActiveCustomTabId(null);
    notifySurveyTabClosed(closingTab?.kind);
    playDeckSystemSound("click", 0.02);
  }, [closeGatewayPaneContextMenu, closeMirageContextMenu, closeRailTabContextMenu]);

  const handleTabClick = useCallback(
    (
      id: string,
      anchor?: {
        clientX: number;
        clientY: number;
      },
    ): boolean => {
      const { customTabs, activeCustomTabId, server } = useCyberdeckTabStore.getState();
      const isCustomTab = customTabs.some((tab) => tab.id === id);
      const willChange = isCustomTab
        ? activeCustomTabId !== id
        : activeCustomTabId !== null || server !== id;

      flushSync(() => {
        if (willChange) {
          if (isCustomTab) {
            useCyberdeckTabStore.getState().selectTab(id, true);
          } else {
            useCyberdeckTabStore.getState().selectTab(id, false);
          }
        }
      });

      if (willChange) {
        playDeckSystemSound("chirp", 0.03);
        emitSignal({
          source: "ui",
          type: "select",
          payload: { tabId: id, kind: isCustomTab ? "custom" : "fixed" },
          severity: "info",
        });
        startTransition(() => {
          closeRailTabContextMenu();
          closeMirageContextMenu();
          closeGatewayPaneContextMenu();
          setNavRailContext("gateway");
          setServerKeyboardHighlightId(null);
          if (!isCustomTab && id === "s") {
            focusGatewayConnectionPanel();
          }
        });
        return true;
      }

      playDeckSystemSound("click", 0.02);
      startTransition(() => {
        closeMirageContextMenu();
        closeGatewayPaneContextMenu();
        setServerKeyboardHighlightId(null);

        const tabEl = document.querySelector<HTMLElement>(`[data-server-tab="${CSS.escape(id)}"]`);
        const rect = tabEl?.getBoundingClientRect();
        const clientX = anchor?.clientX ?? (rect ? rect.left + rect.width / 2 : window.innerWidth / 2);
        const clientY = anchor?.clientY ?? (rect ? rect.bottom : window.innerHeight / 2);
        openRailTabContextMenu(id, clientX, clientY);
      });
      return false;
    },
    [
      closeGatewayPaneContextMenu,
      closeMirageContextMenu,
      closeRailTabContextMenu,
      focusGatewayConnectionPanel,
      openRailTabContextMenu,
    ],
  );
  handleTabClickRef.current = handleTabClick;

  const openMirageContextMenu = useCallback(
    (clientX: number, clientY: number) => {
      if (typeof window === "undefined") return;
      closeRailTabContextMenu();
      closeGatewayPaneContextMenu();
      const menuWidth = 176;
      const menuHeight = 236;
      const padding = 8;
      const x = Math.min(clientX, Math.max(padding, window.innerWidth - menuWidth - padding));
      const y = Math.min(clientY, Math.max(padding, window.innerHeight - menuHeight - padding));
      setMirageContextMenu({ x, y });
    },
    [closeGatewayPaneContextMenu, closeRailTabContextMenu],
  );

  const openGatewayPaneContextMenu = useCallback(
    (clientX: number, clientY: number) => {
      if (typeof window === "undefined") return;
      closeRailTabContextMenu();
      closeMirageContextMenu();
      const menuWidth = 176;
      const menuHeight = 200;
      const padding = 8;
      const x = Math.min(clientX, Math.max(padding, window.innerWidth - menuWidth - padding));
      const y = Math.min(clientY, Math.max(padding, window.innerHeight - menuHeight - padding));
      setGatewayPaneContextMenu({ x, y });
    },
    [closeMirageContextMenu, closeRailTabContextMenu],
  );

  const handleMiragePaneContextMenu = useCallback(
    (event: ReactMouseEvent<HTMLElement>) => {
      if (contextMenuTargetIsTextField(event.target)) return;
      event.preventDefault();
      event.stopPropagation();
      openMirageContextMenu(event.clientX, event.clientY);
    },
    [openMirageContextMenu],
  );

  const handleGatewayPaneContextMenu = useCallback(
    (event: ReactMouseEvent<HTMLElement>) => {
      if (contextMenuTargetIsTextField(event.target)) return;
      event.preventDefault();
      event.stopPropagation();
      openGatewayPaneContextMenu(event.clientX, event.clientY);
    },
    [openGatewayPaneContextMenu],
  );

  const copyMirageLastAssistant = useCallback(async () => {
    let text = streamText.trim();
    if (!text) {
      const last = [...messages].reverse().find((m) => m.role === "assistant");
      text = typeof last?.text === "string" ? last.text.trim() : "";
    }
    if (!text) {
      toast.error("No assistant message to copy.");
      return;
    }
    try {
      await copyTextToClipboard(text);
      toast.success("Copied last assistant message.");
    } catch {
      toast.error("Could not copy.");
    }
  }, [messages, streamText]);

  const copyMirageSelectionOrLastMessage = useCallback(async () => {
    const sel = typeof window !== "undefined" ? window.getSelection()?.toString().trim() ?? "" : "";
    let text = sel;
    if (!text) {
      const last = messages[messages.length - 1];
      text = typeof last?.text === "string" ? last.text.trim() : "";
      if (!text) text = streamText.trim();
    }
    if (!text) {
      toast.error("Nothing to copy.");
      return;
    }
    try {
      await copyTextToClipboard(text);
      toast.success(sel ? "Copied selected text." : "Copied last message.");
    } catch {
      toast.error("Could not copy.");
    }
  }, [messages, streamText]);

  const openOrFocusDiagnosticsTab = useCallback(() => {
    const customTabs = useCyberdeckTabStore.getState().customTabs;
    const existing = customTabs.find((t) => t.kind === "diagnostics");
    if (existing) {
      useCyberdeckTabStore.getState().setActiveCustomTabId(existing.id);
      setNavRailContext("tabs");
      playDeckSystemSound("chirp", 0.05);
      return;
    }
    const id = `tab-${crypto.randomUUID()}`;
    const tab: CustomTab = {
      id,
      label: "DIAGNOSTICS",
      glyph: defaultCustomTabGlyphForKind("diagnostics"),
      kind: "diagnostics",
    };
    useCyberdeckTabStore.getState().setCustomTabs((prev) => [...prev, tab]);
    useCyberdeckTabStore.getState().setActiveCustomTabId(id);
    setNavRailContext("tabs");
    playDeckSystemSound("chirp", 0.05);
  }, []);

  const openOrFocusPiTab = useCallback(() => {
    const customTabs = useCyberdeckTabStore.getState().customTabs;
    const existing = customTabs.find((t) => t.kind === "pi");
    if (existing) {
      useCyberdeckTabStore.getState().setActiveCustomTabId(existing.id);
      setNavRailContext("tabs");
      playDeckSystemSound("chirp", 0.05);
      return;
    }
    const id = `tab-${crypto.randomUUID()}`;
    const tab: CustomTab = {
      id,
      label: defaultCustomTabLabelForKind("pi"),
      glyph: defaultCustomTabGlyphForKind("pi"),
      kind: "pi",
    };
    useCyberdeckTabStore.getState().setCustomTabs((prev) => [...prev, tab]);
    useCyberdeckTabStore.getState().setActiveCustomTabId(id);
    setNavRailContext("tabs");
    playDeckSystemSound("chirp", 0.05);
  }, []);

  const { handleSend, handleStop } = useMuthurChatSend({
    messages,
    isStreaming,
    streamToolTrace,
    setInputHistory,
    setMessages,
    setIsStreaming,
    setStreamText,
    setStreamToolTrace,
    setMuthurStall,
    setMuthurResponseFailed,
    setMuthurDiagnostics,
    setGeneratedUI,
    composeStartedAtRef,
    isClearChatIntent,
    handleClearChatIntent,
    tryHandleSurveyAndGlyphIntents,
    tryHandleHelpAndAtlasIntents,
    messageInputRef,
    chatAbortRef,
    steerAbortRef,
    steerPendingRef,
    providerRateLimitUntilRef,
    muthurMemoryRef,
    operatorFolderRootsRef,
    activeProvider,
    providerKeys,
    modelID,
    hasProviderAuth,
    rateLimitedProviders,
    setProviderKeys,
    setVerifiedProviders,
    setModelFetchStatusByProvider,
    setRateLimitedProviders,
    setModelHealth,
    fetchModelsForProvider,
    muthurInhabitant,
    muthurPosture,
    muthurMission,
    setMuthurMemory,
    emitMuthurCognition,
    piControlLease,
    openOrFocusPiTab,
    operatorSurfaceMode,
    operatorSurfaceIsDocument,
    operatorBrowserSnapshot,
    operatorBrowserUrl,
    operatorDroppedAsset,
    operatorActiveFilePath,
    operatorDocMode,
    setOperatorSurfaceMode,
    setOperatorDocMode,
    setOperatorBrowserEngine,
    openConvertedMarkdownInOperator,
    openWorkspaceFileInOperator,
    saveOperatorDocInPlace,
    applyGlyphActionsFromMuthur,
    performBrowserCommand,
    setNavRailContext,
    clearSavedCustomTabState,
    convertCustomTab,
    deleteActiveTab,
    handleModelLabelClick,
    pinMuthurChatToBottom,
    abortMotherSpeech,
  });

  const prependMuthurSystemMessage = useCallback((text: string) => {
    setMessages((prev) => [...prev, { role: "system", text }]);
  }, []);

  const sendSurveyMuthurPrompt = useCallback(
    (
      prompt: string,
      options?: { preserveSelectedSurface?: boolean; surveyMission?: boolean },
    ) => {
      void handleSend(prompt, options);
    },
    [handleSend],
  );

  const { handleSurveyMissionSolve } = useSurveyMuthurMissionHandlers({
    revokeOperatorBlobUrl,
    operatorPreviewBlobUrlRef,
    showOperatorImage: showSurveyOperatorImage,
    prependSystemMessage: prependMuthurSystemMessage,
    sendMuthurPrompt: sendSurveyMuthurPrompt,
  });

  usePowerfistDeckSocket({
    setMessages,
    setOperatorDocMode,
    handleSend,
    openWorkspaceFileInOperator,
    onMissionSolve: handleSurveyMissionSolve,
  });

  const openOrFocusCallCenterTab = useCallback(() => {
    const customTabs = useCyberdeckTabStore.getState().customTabs;
    const existing = customTabs.find((t) => t.kind === "call-center");
    if (existing) {
      useCyberdeckTabStore.getState().setActiveCustomTabId(existing.id);
      setNavRailContext("tabs");
      playDeckSystemSound("chirp", 0.05);
      return;
    }
    const id = `tab-${crypto.randomUUID()}`;
    const tab: CustomTab = {
      id,
      label: defaultCustomTabLabelForKind("call-center"),
      glyph: defaultCustomTabGlyphForKind("call-center"),
      kind: "call-center",
    };
    useCyberdeckTabStore.getState().setCustomTabs((prev) => [...prev, tab]);
    useCyberdeckTabStore.getState().setActiveCustomTabId(id);
    setNavRailContext("tabs");
    playDeckSystemSound("chirp", 0.05);
  }, []);

  const openOrFocusModuleTab = useCallback(
    (target:
      | "memory-atlas"
      | "catalog"
      | "operators"
      | "flight-log"
      | "voice-lab"
      | "glyph-channel"
      | "rola-dex"
      | "tunes"
      | "settings") => {
      const customTabs = useCyberdeckTabStore.getState().customTabs;
      const existing = customTabs.find((tab) => tab.kind === target);
      if (existing) {
        useCyberdeckTabStore.getState().setActiveCustomTabId(existing.id);
        setNavRailContext("tabs");
        playDeckSystemSound("chirp", 0.05);
        emitSignal({
          source: "system",
          type: "focused_module",
          payload: { target },
          severity: "info",
        });
        return true;
      }
      const id = `tab-${crypto.randomUUID()}`;
      const tab: CustomTab = {
        id,
        label: defaultCustomTabLabelForKind(target),
        glyph: defaultCustomTabGlyphForKind(target),
        kind: target,
      };
      useCyberdeckTabStore.getState().setCustomTabs((prev) => [...prev, tab]);
      useCyberdeckTabStore.getState().setActiveCustomTabId(id);
      setNavRailContext("tabs");
      playDeckSystemSound("chirp", 0.05);
      emitSignal({
        source: "system",
        type: "focused_module",
        payload: { target },
        severity: "info",
      });
      return true;
    },
    [],
  );

  const handleModuleFocusSignal = useCallback(
    (signal: DeckSignal) => {
      if (signal.source !== "system" || signal.type !== "module_focus_requested") return;
      const target = signal.payload?.["target"];
      if (typeof target !== "string") return;
      if (
        target !== "memory-atlas" &&
        target !== "catalog" &&
        target !== "operators" &&
        target !== "flight-log" &&
        target !== "voice-lab" &&
        target !== "glyph-channel" &&
        target !== "rola-dex" &&
        target !== "tunes" &&
        target !== "settings"
      ) {
        return;
      }
      const focused = openOrFocusModuleTab(target);
      if (focused) return;
      emitSignal({
        source: "system",
        type: "navigate_recommendation",
        payload: { target },
        severity: "info",
      });
    },
    [openOrFocusModuleTab],
  );

  useDeckSignal(handleModuleFocusSignal);

  const handleOperatorConvertSignal = useCallback(
    (signal: DeckSignal) => {
      if (signal.type !== "operator-convert-document") return;
      const filePath = signal.payload?.filePath;
      if (typeof filePath !== "string" || !filePath.trim()) return;
      void openConvertedMarkdownInOperator(filePath.trim());
    },
    [openConvertedMarkdownInOperator],
  );

  useDeckSignal(handleOperatorConvertSignal);

  const { createHandlers: createRailTabLongPressHandlers, consumeClickIfLongPress, cancelLongPressFromContextMenu } =
    useRailTabLongPress({
      getSelectedRailTabId: getCyberdeckSelectedRailTabId,
      openMenu: openRailTabContextMenu,
    });

  const handleRailTabContextMenu = useCallback(
    (tabId: string, event: ReactMouseEvent<HTMLElement>) => {
      if (getCyberdeckSelectedRailTabId() !== tabId) return;
      event.preventDefault();
      event.stopPropagation();
      cancelLongPressFromContextMenu();
      openRailTabContextMenu(tabId, event.clientX, event.clientY);
    },
    [cancelLongPressFromContextMenu, openRailTabContextMenu],
  );

  const renderCustomTabSurface = useCallback(
    (tab: CustomTab) => (
      <CustomTabPaneRenderer
        tab={tab}
        activeProvider={activeProvider}
        connectionState={connectionState}
        modelID={modelID}
        providerModelFetchStatus={providerModelFetchStatus}
        voiceEnabled={voiceEnabled}
        voiceHealth={voiceHealth}
        muthurMemory={muthurMemory}
        muthurMemoryHydrated={muthurMemoryHydrated}
        muthurMemoryLoadError={muthurMemoryLoadError}
        messages={messages}
        streamText={streamText}
        heapEntryCount={heapEntries.length}
        providerKeys={providerKeys}
        operatorBrowserEngine={operatorBrowserEngine}
        operatorBrowserRef={operatorBrowserRef}
        identity={identity}
        orchestration={orchestration}
        deckSfxVolume={deckSfxVolume}
        sonarVolume={sonarVolume}
        voiceDialVolume={voiceDial.volume}
        speakDeckVoiceLine={speakDeckVoiceLine}
        onVoiceToggle={toggleVoiceEnabled}
        onVoiceVolumeChange={handleVoiceVolumeChange}
        onSonarVolumeChange={handleSonarVolumeChange}
        onDeckSfxVolumeChange={handleDeckSfxVolumeChange}
        customTabBrowserNavigate={customTabBrowserNavigate}
        handleCustomTabDrop={handleCustomTabDrop}
        messageInputRef={messageInputRef}
      />
    ),
    [
      activeProvider,
      connectionState,
      customTabBrowserNavigate,
      deckSfxVolume,
      handleCustomTabDrop,
      handleDeckSfxVolumeChange,
      handleSonarVolumeChange,
      handleVoiceVolumeChange,
      heapEntries.length,
      identity,
      messages,
      modelID,
      muthurMemory,
      muthurMemoryHydrated,
      muthurMemoryLoadError,
      operatorBrowserEngine,
      orchestration,
      providerKeys,
      providerModelFetchStatus,
      sonarVolume,
      speakDeckVoiceLine,
      streamText,
      toggleVoiceEnabled,
      voiceDial.volume,
      voiceEnabled,
      voiceHealth,
    ],
  );

  /* Weyland: col2 = nav, col3 = terminal. Echo: flipped → col2 = terminal (chat), col3 = nav (gateway). */
  return (
    <div
      ref={cyberdeckRootRef}
      data-deck-mode={deckMode}
      className="terminal-window box-border flex h-full min-h-0 w-full flex-1 overflow-hidden bg-background font-mono text-green-500 max-md:min-h-0 max-md:flex-col md:h-screen"
    >
      <DeckModeProvider mode={deckMode}>
      <CyberdeckScrollbarHost />
      <CyberdeckBootSequence />
      <SurveyHubHost
        archiveMuthurHistoryLine={archiveMuthurHistoryLine}
        appendAssistantMessage={appendMuthurAssistantMessage}
        pinMuthurChatToBottom={pinMuthurChatToBottom}
        focusMessageScroll={() => messageScrollRef.current?.focus({ preventScroll: true })}
      />
      <CyberdeckTabPersistence
        uiStateStorageKey={UI_STATE_STORAGE_KEY}
        workspaceHydrated={workspaceHydrated}
        deckUiHydrated={deckUiHydrated}
        serverRef={serverRef}
        navRailContext={navRailContext}
        serverKeyboardHighlightId={serverKeyboardHighlightId}
        operatorSurfaceMode={operatorSurfaceMode}
        operatorBrowserUrl={operatorBrowserUrl}
        buildUiPayload={buildCyberdeckUiPayload}
      />
      <OperatorWorkspacePersistence
        deckUiHydrated={deckUiHydrated}
        operatorDroppedAsset={operatorDroppedAsset}
        operatorActiveFilePath={operatorActiveFilePath}
        operatorDocMode={operatorDocMode}
        operatorFileHistory={operatorFileHistory}
        operatorFileHistoryIndex={operatorFileHistoryIndex}
      />
      <CyberdeckCustomTabBrowserSync
        operatorBrowserRef={operatorBrowserRef}
        updateCustomTab={updateCustomTab}
      />
      <LazyIndicateOverlay />
      <MuthurControlLeaseHost
        snapshot={piControlLease.snapshot}
        onGrant={async () => {
          const lease = await piControlLease.grant();
          openOrFocusPiTab();
          if (lease) {
            setMuthurDiagnostics((current) =>
              appendMuthurDiagnosticEntry(
                current,
                `CONTROL GRANTED // ${lease.task} // operator: Pi // lease: ${lease.leaseId}`,
              ),
            );
            queuePiMission({ missionText: lease.missionText, task: lease.task });
          }
        }}
        onDeny={async () => {
          await piControlLease.deny();
          setMuthurDiagnostics((current) =>
            appendMuthurDiagnosticEntry(current, "CONTROL DENIED // Pi lease request rejected"),
          );
        }}
        onRetake={async () => {
          await piControlLease.retake();
          setMuthurDiagnostics((current) =>
            appendMuthurDiagnosticEntry(current, "AUTHORITY RETURN // pi → user // user_retake"),
          );
        }}
        onContinueMission={async () => {
          await piControlLease.clearConflict();
        }}
        onReportConflict={async () => {
          await piControlLease.reportConflict();
        }}
      />
      <CyberdeckContextMenus
        railTabContextMenu={railTabContextMenu}
        mirageContextMenu={mirageContextMenu}
        gatewayPaneContextMenu={gatewayPaneContextMenu}
        closeRailTabContextMenu={closeRailTabContextMenu}
        closeMirageContextMenu={closeMirageContextMenu}
        closeGatewayPaneContextMenu={closeGatewayPaneContextMenu}
        applyTabMenuAction={applyTabMenuAction}
        focusFixedServerPanel={focusFixedServerPanel}
        deleteActiveTab={deleteActiveTab}
        openOrFocusCallCenterTab={openOrFocusCallCenterTab}
        replayFullLastAssistant={replayFullLastAssistant}
        copyMirageLastAssistant={copyMirageLastAssistant}
        copyMirageSelectionOrLastMessage={copyMirageSelectionOrLastMessage}
        handleModelLabelClick={handleModelLabelClick}
        openOrFocusDiagnosticsTab={openOrFocusDiagnosticsTab}
      />
      <CyberdeckServerRail
        railRef={serverRailRef}
        isMobileLayout={isMobileLayout}
        fixedServers={fixedServers}
        navRailContext={navRailContext}
        serverKeyboardHighlightId={serverKeyboardHighlightId}
        railGlyphForServer={railGlyphForServer}
        railGlyphForCustomTab={(tab) => railGlyphForCustomTab(tab as CustomTab)}
        onTabClick={handleTabClick}
        onOpenNewTabMenu={openNewTabMenu}
        onRailContextMenu={handleRailTabContextMenu}
        createRailTabLongPressHandlers={createRailTabLongPressHandlers}
        consumeClickIfLongPress={consumeClickIfLongPress}
        onPointerNavReset={() => {
          setNavRailContext("gateway");
          setServerKeyboardHighlightId(null);
        }}
      />

        <CyberdeckLayoutShell
          isMobileLayout={isMobileLayout}
          onContentSplitSizesChange={handleContentSplitSizesChange}
          chatColumn={
            <MuthurChatColumn
              ref={chatColumnRef}
              isMobileLayout={isMobileLayout}
              networkActivityActive={networkActivityActive}
              onContextMenu={handleMiragePaneContextMenu}
              messageScrollRef={messageScrollRef}
              muthurChatScrollContentRef={muthurChatScrollContentRef}
              messagesEndRef={messagesEndRef}
              onChatScroll={handleMuthurChatScroll}
              muthurPosture={muthurPosture}
              muthurMission={muthurMission}
              isStreaming={isStreaming}
              onCreateMission={handleCreateMuthurMission}
              onStartMission={handleStartMuthurMission}
              messages={messages}
              muthurDiagnostics={muthurDiagnostics}
              streamText={streamText}
              streamToolTrace={streamToolTrace}
              streamReasoning={muthurStreamReasoning}
              muthurStall={muthurStall}
              chatUserDisplayName={chatUserDisplayName}
              onChatUserDisplayNameChange={setChatUserDisplayName}
              chatKeyboardHighlightIndex={chatKeyboardHighlightIndex}
              cognitionStatusLine={muthurCognitionStatusLine}
              muthurInhabitant={muthurInhabitant}
              muthurDelegations={muthurDelegations}
              onCreateDelegation={handleCreateMuthurDelegation}
              onDispatchDelegation={handleDispatchMuthurDelegation}
              onRecordDelegationResult={handleRecordMuthurDelegationResult}
              onCancelDelegation={handleCancelMuthurDelegation}
              deckMode={deckMode}
              messageInputRef={messageInputRef}
              inputHistory={inputHistory}
              hasProviderAuth={hasProviderAuth}
              glyphModeActive={glyphModeActive}
              chatHydrated={chatHydrated}
              onSend={handleSend}
              onCanSendChange={handleCanSendInputChange}
              onComposerFocusExtra={() => setChatKeyboardHighlightIndex(null)}
              onPasteImage={handlePasteImageToChat}
              connectionState={connectionState}
              modelID={modelID}
              onModelLabelClick={() => handleModelLabelClick("s")}
              onInhabitantChange={handleMuthurInhabitantChange}
              onPostureChange={handleMuthurPostureChange}
              voiceEnabled={voiceEnabled}
              voiceHealth={voiceHealth}
              onVoiceToggle={toggleVoiceEnabled}
              voiceBlockTotal={voiceBlockTotal}
              voiceBlockFocusIndex={voiceBlockFocusIndex}
              voicePlaybackBusy={voicePlaybackBusy}
              onAbortSpeech={abortMotherSpeech}
              onSpeakVoiceBlockAtIndex={speakVoiceBlockAtIndex}
              onReplayFullLastAssistant={replayFullLastAssistant}
              canSendInput={canSendInput}
              onStop={handleStop}
            />
          }
          gatewayColumn={
            <GatewayColumn
            ref={gatewayColumnRef}
            networkActivityActive={networkActivityActive}
            isMarkdownDragOver={isMarkdownDragOver}
            mirageHeaderCollapse={mirageHeaderCollapse}
            isMobileLayout={isMobileLayout}
            deckMode={deckMode}
            droppedMarkdown={droppedMarkdown}
            droppedMarkdownName={droppedMarkdownName}
            onDroppedMarkdownClear={() => {
              setDroppedMarkdown(null);
              setDroppedMarkdownName("");
            }}
            onContextMenu={handleGatewayPaneContextMenu}
            onDragOver={handleThirdColumnDragOver}
            onDragLeave={handleThirdColumnDragLeave}
            onDrop={handleThirdColumnDrop}
            leadingPaneContent={
              <>
                {ENABLE_CARD_TABLE ? (
                  <CyberdeckFixedServerPane
                    serverId="ct"
                    className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
                  >
                    <LazyCardTablePaneHost
                      selectedCardIds={selectedCardIds}
                      setSelectedCardIds={setSelectedCardIds}
                    />
                  </CyberdeckFixedServerPane>
                ) : null}
                <CyberdeckCustomTabPanes renderTab={(tab) => renderCustomTabSurface(tab as CustomTab)} />
              </>
            }
            gatewayConnectionPanelRef={gatewayConnectionPanelRef}
            providerKeyboardHighlightId={providerKeyboardHighlightId}
            modelKeyboardHighlightId={modelKeyboardHighlightId}
            onProviderKeyboardHighlightIdChange={setProviderKeyboardHighlightId}
            onModelKeyboardHighlightIdChange={setModelKeyboardHighlightId}
            focusGatewayConnectionPanel={focusGatewayConnectionPanel}
            providers={providers}
            activeProvider={activeProvider}
            modelList={modelList}
            modelID={modelID}
            hasProviderAuth={hasProviderAuth}
            providerConnectionLabel={providerConnectionLabel}
            providerModelFetchStatus={providerModelFetchStatus}
            credentialReplaceProvider={credentialReplaceProvider}
            gatewayKeyDraft={gatewayKeyDraft}
            onGatewayKeyDraftChange={setGatewayKeyDraft}
            rateLimitedProviders={rateLimitedProviders}
            modelFetchStatusByProvider={modelFetchStatusByProvider}
            modelHealthByProvider={modelHealthByProvider}
            probeInFlightByProvider={probeInFlightByProvider}
            providerHasKey={providerHasKey}
            handleProviderClick={handleProviderClick}
            submitGatewayKey={submitGatewayKey}
            activateModelById={activateModelById}
            generatedUI={generatedUI}
          >
            <CyberdeckFixedServerPane
              serverId="m"
              className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
            >
              <OperatorPaneHost
                isOperatorDragOver={isOperatorDragOver}
                operatorDroppedAsset={operatorDroppedAsset}
                operatorSurfaceMode={operatorSurfaceMode}
                operatorBrowserEngine={operatorBrowserEngine}
                operatorSurfaceIsDocument={operatorSurfaceIsDocument}
                operatorBrowserUrl={operatorBrowserUrl}
                operatorDocMode={operatorDocMode}
                operatorDocNameDraft={operatorDocNameDraft}
                operatorActiveFilePath={operatorActiveFilePath}
                operatorFileHistory={operatorFileHistory}
                operatorFileHistoryIndex={operatorFileHistoryIndex}
                operatorFolderRootsRef={operatorFolderRootsRef}
                operatorFolderRootsCount={operatorFolderRootsCount}
                operatorEditorRef={operatorEditorRef}
                operatorNameInputRef={operatorNameInputRef}
                operatorBrowserRef={operatorBrowserRef}
                onOperatorDragOver={handleOperatorDragOver}
                onOperatorDragLeave={handleOperatorDragLeave}
                onOperatorDrop={handleOperatorDrop}
                onOperatorDocNameDraftChange={setOperatorDocNameDraft}
                onCommitOperatorDocName={commitOperatorDocName}
                onSetOperatorDocMode={handleSetOperatorDocMode}
                onOperatorBrowserNavigate={openOperatorBrowser}
                onOperatorBrowserUrlChange={setOperatorBrowserUrl}
                onSetOperatorSurfaceMode={setOperatorSurfaceMode}
                onPasteClipboardToOperator={pasteClipboardToOperator}
                onSaveOperatorDocInPlace={saveOperatorDocInPlace}
                onSaveOperatorDocAsFile={saveOperatorDocAsFile}
                onConvertDocumentToMarkdown={openConvertedMarkdownInOperator}
                onExportOperatorMarkdown={exportOperatorMarkdown}
                onCopyOperatorDocToClipboard={copyOperatorDocToClipboard}
                onOperatorDocumentTextChange={handleOperatorDocumentTextChange}
                onClearOperatorDocument={clearOperatorDocument}
                onOperatorDocumentKindChange={handleOperatorDocumentKindChange}
                onOpenOperatorFolderFile={openOperatorFolderFile}
                onOperatorFolderRootsChange={handleOperatorFolderRootsChange}
                onOperatorFileHistoryBack={() => navigateOperatorFileHistory("back")}
                onOperatorFileHistoryForward={() => navigateOperatorFileHistory("forward")}
                onReloadOperatorFile={reloadOperatorFolderFile}
              />
            </CyberdeckFixedServerPane>
            <CyberdeckFixedServerPane serverId="b" className="flex min-h-0 flex-1 flex-col">
              <div ref={gatewayBlankSettingsRef} className="flex min-h-0 flex-1 flex-col">
                  <ActivatedCyberdeckPane
                    kind="settings"
                    voiceEnabled={voiceEnabled}
                    onVoiceToggle={toggleVoiceEnabled}
                    deckSfxVolume={deckSfxVolume}
                    onDeckSfxVolumeChange={handleDeckSfxVolumeChange}
                    identity={identity}
                    voiceVolume={voiceDial.volume}
                    onVoiceVolumeChange={handleVoiceVolumeChange}
                    sonarVolume={sonarVolume}
                    onSonarVolumeChange={handleSonarVolumeChange}
                  />
              </div>
            </CyberdeckFixedServerPane>
          </GatewayColumn>
          }
        />
      </DeckModeProvider>
    </div>
  );
}











