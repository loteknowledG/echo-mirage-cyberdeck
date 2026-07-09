"use client";

import type { DragEvent as ReactDragEvent, MouseEvent as ReactMouseEvent, SetStateAction } from "react";
import { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo, startTransition } from "react";
import { flushSync } from "react-dom";
import { art } from "@/lib/TerminalArt";
import type { CyberdeckVoiceTuning } from "@/lib/cyberdeck-voice-tuning";
import type { Db8DeckSpeakLine } from "@/lib/db8-voice";
import { selectMuthurFallbackVoice } from "@/voice/speakMuthur";
import { MUTHUR_PRESET } from "@/voice/muthurPreset";
import {
  buildMuthurVoiceMasterCopy,
  buildMuthurVoiceTuning,
  getInitialMuthurVoiceDials,
  muthurBrowserSpeechTuning,
  muthurMasterGain,
  restoreMuthurVoiceMasterCopy,
  saveMuthurVoiceMasterCopy,
  type MuthurVoiceDialState,
} from "@/voice/muthurVoiceSettings";
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
import { splitIntoSpeechBlocks } from "@/lib/muthur-voice-blocks";
import type { CanonicalTarget } from "@/lib/computer-use/ui-alias-registry";
import {
  loadComputerUse,
} from "@/features/cyberdeck/runtime/defer-computer-use";
import {
  bindDeckKeyboardSfx,
  loadDeckAudio,
  playDeckDeclined,
  playDeckDroidDizzy400,
  playDeckDroidDizzy401,
  playDeckOutOfGas429,
  playDeckRaceReadySetGo,
  playDeckWrongDoorShut,
  playDeckNavigationSound,
  playDeckSystemSound,
  playDeckBleepBloop,
  setDeckUplinkSonarVolume,
  setDeckSfxVolume,
  unlockDeckKeyboardSfx,
} from "@/features/cyberdeck/runtime/defer-deck-audio";
import { copyTextToClipboard } from "@/lib/grok-image-prompt";
import { revokeOperatorBlobUrl } from "@/lib/operator-binary-preview";
import { resolveOperatorAssetSurface } from "@/lib/operator-file-surface";
import { isDocumentEditIntent, isOperatorPaneEditRequest } from "@/lib/muthur/document-edit-intent";
import {
  applyMuthurOperatorEdits,
  parseOperatorEditsHeader,
  pathsReferToSameOperatorFile,
  reloadOperatorDocumentFromWorkspacePath,
  waitForOperatorDocumentReady,
} from "@/lib/operator-muthur-edit";
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
import { readOperatorPaneSaveText } from "@/lib/operator-workbench";
import { get, set } from "idb-keyval";
import dynamic from "next/dynamic";
import { PanelLoader } from "@/features/cyberdeck/panel-loader";
import { CyberdeckBootSequence } from "@/components/cyberdeck/boot-sequence";
import { registerCyberdeckRailTab } from "@/components/cyberdeck/cyberdeck-rail-tab";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { DeckModeProvider, loadDeckMode, notifyDeckModeChange, saveDeckMode, type DeckMode } from "@/lib/deck-mode";
import { CyberdeckScrollbarHost } from "@/components/cyberdeck/cyberdeck-scrollbar-host";
import { SurveyAutoPairHost } from "@/components/cyberdeck/survey-auto-pair-host";
import { CyberdeckLayoutShell } from "@/features/cyberdeck/layout/cyberdeck-layout-shell";
import { useMobileCyberdeckLayout } from "@/features/cyberdeck/layout/use-mobile-cyberdeck-layout";
import { CustomTabPaneRenderer } from "@/features/cyberdeck/workspace/custom-tab-pane-renderer";
import { CyberdeckContextMenus } from "@/features/cyberdeck/workspace/cyberdeck-context-menus";
import { useCustomTabBrowser } from "@/features/cyberdeck/workspace/use-custom-tab-browser";
import { useRailTabContextMenu } from "@/features/cyberdeck/workspace/use-rail-tab-context-menu";
import { OperatorPaneHost } from "@/features/cyberdeck/operator/operator-pane-host";
import { useOperatorWorkspaceState } from "@/features/cyberdeck/operator/use-operator-workspace-state";
import {
  getInitialUplinkSonarVolume,
  saveUplinkSonarVolume,
} from "@/lib/cyberdeck/uplink-sonar-volume";
import {
  getInitialDeckSfxVolume,
  saveDeckSfxVolume,
} from "@/lib/cyberdeck/deck-sfx-volume";
import { playBeep } from "@/lib/deck-audio";
import { loadWorkspaceState, saveWorkspaceState } from "@/lib/workspace-state";
import { useDebouncedEffect } from "@/lib/use-debounced-effect";
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
import { setMuthurScreenSnapshot } from "@/lib/muthur-screen-context";
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
import { formatInhabitantChannelLabel } from "@/lib/muthur/muthur-inhabitant";
import { useDeckAudioBridge } from "@/lib/cyberdeck/audio-bridge";
import {
  isAudioAllowed,
  registerAudioStopHook,
  subscribeAudioGate,
} from "@/lib/cyberdeck/audio-gate";
import { useSilentModeAudioGateSync } from "@/lib/cyberdeck/use-silent-mode-audio-gate-sync";
import { isEchoMirageDesktopShell } from "@/lib/electron/desktop-install.client";
import {
  POWERFIST_STACK_CHANNEL,
  POWERFIST_STACK_PUSH_EVENT,
  type PowerFistStackCommand,
} from "@/lib/cyberdeck/powerfist-events";
import { connectPowerfistDeckSocket, fetchPowerfistDeckConnect } from "@/lib/cyberdeck/powerfist-remote-socket";
import { appendSurveyChatMessage } from "@/lib/cyberdeck/survey-chat";
import {
  executeSurveyHubConnectForMuthur,
  surveyAutoConnectFailureMessage,
} from "@/lib/cyberdeck/survey-muthur-connect.client";
import {
  terminateSurveySessionWhenTabClosed,
  terminateSurveySessionWhenTabsCleared,
} from "@/lib/cyberdeck/survey-tab-lifecycle.client";
import { useSurveyMuthurArchive } from "@/features/cyberdeck/hooks/use-survey-muthur-archive";
import { useSurveyMuthurMissionHandlers } from "@/features/cyberdeck/hooks/use-survey-muthur-mission-handlers";
import { useMuthurChatState } from "@/features/cyberdeck/muthur/use-muthur-chat-state";
import { useMuthurSendIntents } from "@/features/cyberdeck/muthur/use-muthur-send-intents";
import { useMuthurChatSend } from "@/features/cyberdeck/muthur/use-muthur-chat-send";
import { useMuthurCommanderHandlers } from "@/features/cyberdeck/muthur/use-muthur-commander-handlers";
import {
  CYBERDECK_PROVIDER_IDS,
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
  isFixedServerTabId,
  safeServerId,
  SERVER_IDS,
  servers,
  type ServerId,
  type ServerRailButton,
} from "@/features/cyberdeck/workspace/custom-tab-model";
import {
  buildCyberdeckChatHistory,
  formatCodingVerifySystemLine,
  getOperatorFileKind,
  isEditableOperatorFile,
  parseCodingVerifyHeader,
  readFileAsDataUrl,
  textForSpeech,
  contextMenuTargetIsTextField,
  type DroppedOperatorAsset,
} from "@/features/cyberdeck/muthur/coding-verify-format";
import { runPowerfistToolOverride } from "@/lib/cyberdeck/powerfist-tool-override";
import { loadIdentityBundle } from "@/lib/identity/load-identity";
import type { Identity } from "@/lib/identity/identity-types";
import { loadOrchestrationBundle } from "@/lib/orchestration/load-orchestration";
import type { OrchestrationBundle } from "@/lib/orchestration/orchestration-types";
import { ENABLE_AUTOMATION } from "@/lib/cyberdeck/automation-config";
import { formatUplinkErrorDetail } from "@/lib/cyberdeck/format-uplink-error";
import { publishMuthurObservation, flushMuthurObservation } from "@/lib/muthur/observation/publish-observation";
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

const HEAP_STORAGE_KEY = "echo-mirage-heap-items";
const UI_STATE_STORAGE_KEY = "echo-mirage-ui-state-v1";

type CyberdeckUiState = {
  server: ServerId;
  navRailContext: "gateway" | "tabs";
  serverKeyboardHighlightId: ServerId | null;
  operatorSurfaceMode?: "workspace" | "browser";
  operatorBrowserUrl?: string;
  customTabs?: CustomTab[];
  activeCustomTabId?: string | null;
};

type HeapEntry = {
  id: string;
  name: string;
  text: string;
  createdAt: number;
};

type SaveFilePickerHandle = {
  createWritable(): Promise<{
    write(data: Blob | string): Promise<void>;
    close(): Promise<void>;
  }>;
};

type SaveFilePickerOptions = {
  suggestedName?: string;
  types?: Array<{
    description?: string;
    accept: Record<string, string[]>;
  }>;
  excludeAcceptAllOption?: boolean;
};

type EchoMirageClipboardApi = {
  readText(): string;
  writeText(text: string): void;
};

type EchoMirageSaveApi = {
  showDialog(options: {
    defaultRelativePath: string;
    content: string;
  }): Promise<{ canceled: boolean; filePath?: string; error?: string }>;
};

async function readEchoMirageClipboardText() {
  const bridge = (window as Window & { echoMirageClipboard?: EchoMirageClipboardApi })
    .echoMirageClipboard;
  if (bridge?.readText) {
    try {
      return bridge.readText();
    } catch {
      /* fall through */
    }
  }

  if (typeof navigator !== "undefined" && navigator.clipboard?.readText) {
    return navigator.clipboard.readText();
  }

  return "";
}

class MotherTerminal {
  private ctx: AudioContext | null = null;
  private burstThreshold: number;

  constructor({ burstThreshold = 180 }: { burstThreshold?: number } = {}) {
    this.burstThreshold = burstThreshold;
  }

  init() {
    if (this.ctx || typeof window === "undefined") return;
    const Ctx =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
  }

  async unlock() {
    this.init();
    if (!this.ctx) return;
    if (this.ctx.state === "suspended") {
      await this.ctx.resume();
    }
  }

  beep(freq: number, time: number, duration = 0.045, gain = 0.045) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();

    osc.type = "square";
    osc.frequency.setValueAtTime(freq, time);

    g.gain.setValueAtTime(0.0001, time);
    g.gain.linearRampToValueAtTime(gain, time + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, time + duration);

    osc.connect(g).connect(this.ctx.destination);
    osc.start(time);
    osc.stop(time + duration);
  }

  playBurstSound(charCount = 12) {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime + 0.02;
    const pulses = Math.min(24, Math.max(6, Math.floor(charCount / 12)));
    for (let i = 0; i < pulses; i++) {
      const t = now + i * 0.025;
      const freq = 520 + Math.random() * 900;
      this.beep(freq, t, 0.035, 0.04);
    }
  }

  shouldBurst(text: string) {
    return text.length >= this.burstThreshold;
  }
}

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

  const [chatKeyboardHighlightIndex, setChatKeyboardHighlightIndex] = useState<number | null>(null);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [voicePlaybackBusy, setVoicePlaybackBusy] = useState(false);
  const [voiceBlockFocusIndex, setVoiceBlockFocusIndex] = useState(0);
  const [voiceBlockTotal, setVoiceBlockTotal] = useState(0);
  const [voiceDial, setVoiceDial] = useState<MuthurVoiceDialState>(getInitialMuthurVoiceDials);
  const [sonarVolume, setSonarVolume] = useState(getInitialUplinkSonarVolume);
  const [deckSfxVolume, setDeckSfxVolumeState] = useState(getInitialDeckSfxVolume);
  const [voiceHealth, setVoiceHealth] = useState<"idle" | "backend" | "fallback" | "off">("idle");
  const [muthurMemory, setMuthurMemory] = useState<MuthurMemoryState>(() => createEmptyMuthurMemory());
  const [muthurMemoryHydrated, setMuthurMemoryHydrated] = useState(false);
  const [muthurMemoryLoadError, setMuthurMemoryLoadError] = useState<string | null>(null);
  const [heapEntries, setHeapEntries] = useState<HeapEntry[]>([]);
  const [heapNameDraft, setHeapNameDraft] = useState("");
  const [heapTextDraft, setHeapTextDraft] = useState("");
  const [heapHydrated, setHeapHydrated] = useState(false);
  const [deckMode, setDeckMode] = useState<DeckMode>(() => loadDeckMode());
  const [workspaceHydrated, setWorkspaceHydrated] = useState(false);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [orchestration, setOrchestration] = useState<OrchestrationBundle | null>(null);

  /** Escape from gateway → tab rail; Escape from tab rail → gateway. Arrows move highlight while on rail. */
  const [navRailContext, setNavRailContext] = useState<"gateway" | "tabs">("gateway");
  const [serverKeyboardHighlightId, setServerKeyboardHighlightId] = useState<(typeof SERVER_IDS)[number] | null>(null);
  const [deckUiHydrated, setDeckUiHydrated] = useState(false);
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
  const lastSpokenAssistantTextRef = useRef<string>("");
  const assistantVoiceBlocksRef = useRef<string[]>([]);
  const speakQueueActiveRef = useRef(false);
  const speakSequenceRef = useRef(0);
  const lastVoiceErrorRef = useRef<string>("");
  const voiceDialRef = useRef<MuthurVoiceDialState>(getInitialMuthurVoiceDials());
  const muthurMemoryRef = useRef<MuthurMemoryState>(createEmptyMuthurMemory());
  const audioContextRef = useRef<AudioContext | null>(null);
  const activeSourceNodesRef = useRef<AudioBufferSourceNode[]>([]);
  const motherMasterGainRef = useRef<GainNode | null>(null);
  const motherTerminalRef = useRef(new MotherTerminal({ burstThreshold: 180 }));
  const networkFeedbackDelayRef = useRef<number | null>(null);
  const networkFeedbackRepeatRef = useRef<number | null>(null);
  const offlineAutoOpenedRef = useRef(false);
  const startupRailResolvedRef = useRef(false);
  const prevConnectionStateRef = useRef<"offline" | "connecting" | "connected">("offline");
  const serverRef = useRef<CyberdeckServerId>("m");

  useEffect(() => {
    const unsub = useCyberdeckTabStore.subscribe((state) => {
      serverRef.current = state.server;
    });
    serverRef.current = useCyberdeckTabStore.getState().server;
    return unsub;
  }, []);

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
  /** Forward Tab from message box cycles: gateway (right) → rail (left) → chat log (col2) → … */
  const deckTabNextRef = useRef<"gateway" | "rail" | "chatlog">("gateway");
  const prevNavRailRef = useRef<"gateway" | "tabs">("gateway");
  const uiFocusRestoredRef = useRef(false);

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

  const handleDeckSfxVolumeChange = useCallback((volume: number) => {
    setDeckSfxVolumeState((prev) => {
      if (prev <= 0 && volume > 0) {
        playBeep();
      }
      return volume;
    });
    saveDeckSfxVolume(volume);
    emitSignal({
      source: "audio",
      type: "setting_changed",
      payload: { key: "deck_sfx_volume", value: volume },
      severity: "info",
    });
  }, []);

  const splitMiragePhrases = useCallback((text: string) => {
    return text
      .replace(/\s+/g, " ")
      .replace(/([,;:])\s*/g, "$1 ")
      .trim()
      .split(/(?<=[.!?])\s+|(?<=\u2026)\s+/)
      .map((part) => part.trim())
      .filter(Boolean);
  }, []);

  const stopMirageAudio = useCallback(() => {
    activeSourceNodesRef.current.forEach((source) => {
      try {
        source.stop();
      } catch {
        /* ignore */
      }
    });
    activeSourceNodesRef.current = [];
    speakQueueActiveRef.current = false;
  }, []);

  const getBrowserVoices = useCallback(async () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return [];
    const synth = window.speechSynthesis;
    let voices = synth.getVoices();
    if (voices.length > 0) return voices;
    await new Promise<void>((resolve) => {
      const timeout = window.setTimeout(resolve, 350);
      const onVoices = () => {
        window.clearTimeout(timeout);
        synth.removeEventListener("voiceschanged", onVoices);
        resolve();
      };
      synth.addEventListener("voiceschanged", onVoices, { once: true });
    });
    voices = synth.getVoices();
    return voices;
  }, []);

  const playMirageBuffer = useCallback(async (arrayBuffer: ArrayBuffer) => {
    if (!isAudioAllowed()) return false;
    if (typeof window === "undefined") return false;
    const Ctx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return false;

    const ctx = audioContextRef.current ?? new Ctx();
    audioContextRef.current = ctx;
    if (ctx.state === "suspended") {
      await ctx.resume();
    }

    const decoded = await ctx.decodeAudioData(arrayBuffer.slice(0));
    const source = ctx.createBufferSource();
    source.buffer = decoded;
    const deckAudio = await loadDeckAudio();
    const output = deckAudio.applyMuthurEffectChain(ctx, source, {
      ...MUTHUR_PRESET.playback,
    });

    const masterOutput = motherMasterGainRef.current ?? ctx.destination;
    output.connect(masterOutput);

    activeSourceNodesRef.current.push(source);
    source.start(0);

    await new Promise<void>((resolve) => {
      source.onended = () => {
        activeSourceNodesRef.current = activeSourceNodesRef.current.filter((s) => s !== source);
        resolve();
      };
    });
    return true;
  }, []);

  const initMotherAudio = useCallback((): AudioContext | null => {
    if (typeof window === "undefined") return null;
    const Ctx =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;

    const ctx = audioContextRef.current ?? new Ctx();
    audioContextRef.current = ctx;
    if (!motherMasterGainRef.current) {
      const master = ctx.createGain();
      master.gain.value = muthurMasterGain(voiceDialRef.current.volume);
      master.connect(ctx.destination);
      motherMasterGainRef.current = master;
    }
    return ctx;
  }, []);

  const unlockMotherAudio = useCallback(async () => {
    const ctx = initMotherAudio();
    if (!ctx) return null;
    if (ctx.state === "suspended") {
      await ctx.resume();
    }
    return ctx;
  }, [initMotherAudio]);

  const motherTone = useCallback(
    (freq: number, time: number, duration: number, gain = 0.04, type: OscillatorType = "sine") => {
      const ctx = audioContextRef.current;
      const master = motherMasterGainRef.current;
      if (!ctx || !master) return;

      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, time);

      g.gain.setValueAtTime(0.0001, time);
      g.gain.linearRampToValueAtTime(gain, time + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, time + duration);

      osc.connect(g);
      g.connect(master);
      osc.start(time);
      osc.stop(time + duration + 0.05);
    },
    [],
  );

  const motherReverbTail = useCallback(
    (time: number) => {
      motherTone(220, time, 1.2, 0.025, "sine");
      motherTone(330, time + 0.08, 1.4, 0.018, "sine");
      motherTone(440, time + 0.16, 1.6, 0.012, "triangle");
    },
    [motherTone],
  );

  const synthesizeMirageChunk = useCallback(async (text: string, voiceTuning: CyberdeckVoiceTuning) => {
    const res = await fetch("/api/cyberdeck-voice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        voiceTuning: {
          ratePercent: voiceTuning.ratePercent,
          pitchHz: voiceTuning.pitchHz,
          volume: voiceTuning.volume,
          voiceType: voiceTuning.voiceType,
          gender: voiceTuning.gender,
        },
        apiKey: providerKeys.openai || "",
      }),
    });

    const contentType = res.headers.get("content-type") || "";
    const isAudio = contentType.startsWith("audio/");
    const isJson = contentType.includes("application/json");

    if (isAudio) {
      lastVoiceErrorRef.current = "";
      const voiceType = res.headers.get("x-muthur-voice-type");
      if (voiceType) {
        console.info("[muthur] voice backend", voiceType, res.headers.get("x-muthur-voice-source"));
      }
      return { kind: "audio" as const, audio: await res.arrayBuffer() };
    }

    if (isJson) {
      const diagnostic = await res.json().catch(() => null);
      if (diagnostic && typeof diagnostic === "object") {
        const diagnosticRecord = diagnostic as Record<string, unknown>;
        const diagnosticKeys = Object.keys(diagnosticRecord);
        if (diagnosticKeys.length === 0) {
          console.warn("[muthur] render diagnostic", {
            status: res.status,
            note: "empty-json",
          });
          if (lastVoiceErrorRef.current !== `empty:${res.status}`) {
            lastVoiceErrorRef.current = `empty:${res.status}`;
          }
          return { kind: "diagnostic" as const, diagnostic: null };
        }

        console.warn("[muthur] render diagnostic", diagnosticRecord);
        const stage = typeof (diagnostic as { stage?: unknown }).stage === "string"
          ? (diagnostic as { stage: string }).stage
          : "unknown";
        const message = typeof (diagnostic as { message?: unknown }).message === "string"
          ? (diagnostic as { message: string }).message
          : "MUTHUR backend returned a diagnostic";
        const details = typeof (diagnostic as { details?: unknown }).details === "string"
          ? (diagnostic as { details: string }).details
          : "";
        const signature = `${res.status}:${stage}:${message}`;
        if (lastVoiceErrorRef.current !== signature) {
          lastVoiceErrorRef.current = signature;
          setMessages((prev) => [
            ...prev,
            {
              role: "system",
              text: `MUTHUR_BACKEND_DIAGNOSTIC // ${stage.toUpperCase()} // ${message} // ${details}`.slice(0, 240),
            },
          ]);
        }
        return { kind: "diagnostic" as const, diagnostic };
      }
    }

    if (lastVoiceErrorRef.current !== String(res.status)) {
      lastVoiceErrorRef.current = String(res.status);
      setMessages((prev) => [
        ...prev,
        { role: "system", text: `VOICE_ENDPOINT_UNAVAILABLE // HTTP_${res.status} // USING_LOCAL_FALLBACK` },
      ]);
    }
    return { kind: "diagnostic" as const, diagnostic: null };
  }, [providerKeys.openai]);

  const speakInBrowser = useCallback((text: string, profile?: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;
    if (!text.trim()) return false;
    try {
      const synth = window.speechSynthesis;
      const utterance = new SpeechSynthesisUtterance(text);
      const normalizedProfile = (profile || "").toLowerCase();
      const wantsMuthur = normalizedProfile === "muthur";
      const browserTuning = muthurBrowserSpeechTuning(voiceDialRef.current);
      const voices = synth.getVoices().filter((voice) => voice.lang.toLowerCase().startsWith("en"));
      const preferred = wantsMuthur
        ? selectMuthurFallbackVoice()
        : voices.find((voice) => voice.name.toLowerCase().includes("jenny")) ?? null;

      if (wantsMuthur && !preferred) {
        return false;
      }

      if (preferred) {
        utterance.voice = preferred;
        utterance.lang = preferred.lang || "en-US";
      } else {
        utterance.lang = "en-US";
      }
      utterance.rate = wantsMuthur ? browserTuning.rate : 1;
      utterance.pitch = wantsMuthur ? browserTuning.pitch : 1;
      utterance.volume = wantsMuthur ? browserTuning.volume : 1;

      void unlockMotherAudio().then((ctx) => {
        if (!ctx) return;
        motherReverbTail(ctx.currentTime + 0.02);
      });
      utterance.addEventListener("end", () => {
        const ctx = audioContextRef.current;
        if (!ctx) return;
        motherReverbTail(ctx.currentTime + 0.02);
      });

      synth.cancel();
      synth.speak(utterance);
      return true;
    } catch {
      return false;
    }
  }, [motherReverbTail, unlockMotherAudio]);

  const speakMother = useCallback(async (text: string) => {
    if (!isAudioAllowed()) return false;
    const speakId = ++speakSequenceRef.current;
    speakQueueActiveRef.current = true;
    stopMirageAudio();
    const currentVoiceDial = voiceDialRef.current;
    const browserTuning = muthurBrowserSpeechTuning(currentVoiceDial);
    try {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    } catch {
      /* ignore */
    }

    try {
      const result = await synthesizeMirageChunk(text, buildMuthurVoiceTuning(currentVoiceDial));
      if (speakId !== speakSequenceRef.current) return false;
      if (result.kind === "audio") {
        setVoiceHealth("backend");
        await playMirageBuffer(result.audio);
        if (speakId !== speakSequenceRef.current) return false;
        return true;
      }
      setVoiceHealth("fallback");
      console.warn(
        "[muthur] coderobo unavailable — browser fallback",
        buildMuthurVoiceTuning(currentVoiceDial),
      );
    } catch {
      /* fall through */
    }
    try {
      setVoiceHealth("fallback");
      await (await loadDeckAudio()).speakDryFallback(text, browserTuning);
      if (speakId !== speakSequenceRef.current) return false;
      return true;
    } catch {
      setVoiceHealth("off");
      /* fall through */
    } finally {
      if (speakId === speakSequenceRef.current) {
        speakQueueActiveRef.current = false;
      }
    }
    return false;
  }, [playMirageBuffer, stopMirageAudio, synthesizeMirageChunk]);

  const speakDeckVoiceLine = useCallback<Db8DeckSpeakLine>(
    async (text, profile) => {
      if (!isAudioAllowed()) return;
      await unlockMotherAudio();
      stopMirageAudio();
      try {
        if (typeof window !== "undefined" && "speechSynthesis" in window) {
          window.speechSynthesis.cancel();
        }
      } catch {
        /* ignore */
      }

      const tuning: CyberdeckVoiceTuning = {
        ratePercent: profile.ratePercent,
        pitchHz: profile.pitchHz,
        volume: profile.volume,
        voiceType: profile.voiceType,
        gender: profile.gender,
      };

      try {
        const result = await synthesizeMirageChunk(text, tuning);
        if (result.kind === "audio") {
          await playMirageBuffer(result.audio);
          return;
        }
      } catch {
        /* fall through */
      }

      const deckAudio = await loadDeckAudio();
      await deckAudio.speakDryFallback(text, {
        rate: profile.browserRate,
        pitch: profile.browserPitch,
        volume: profile.volume,
      });
    },
    [playMirageBuffer, stopMirageAudio, synthesizeMirageChunk, unlockMotherAudio],
  );

  const abortMotherSpeech = useCallback(() => {
    speakSequenceRef.current += 1;
    stopMirageAudio();
    try {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    } catch {
      /* ignore */
    }
    setVoicePlaybackBusy(false);
  }, [stopMirageAudio]);

  const clearNetworkFeedbackAudio = useCallback(() => {
    if (networkFeedbackRepeatRef.current !== null) {
      window.clearInterval(networkFeedbackRepeatRef.current);
      networkFeedbackRepeatRef.current = null;
    }
    if (networkFeedbackDelayRef.current !== null) {
      window.clearTimeout(networkFeedbackDelayRef.current);
      networkFeedbackDelayRef.current = null;
    }
  }, []);

  useEffect(() => {
    const unregisterMirage = registerAudioStopHook(stopMirageAudio);
    const unregisterNetwork = registerAudioStopHook(clearNetworkFeedbackAudio);
    const unsubscribeGate = subscribeAudioGate(() => {
      if (!isAudioAllowed()) {
        clearNetworkFeedbackAudio();
      }
    });
    return () => {
      unregisterMirage();
      unregisterNetwork();
      unsubscribeGate();
    };
  }, [clearNetworkFeedbackAudio, stopMirageAudio]);

  const speakVoiceBlockAtIndex = useCallback(
    (index: number) => {
      const blocks = assistantVoiceBlocksRef.current;
      if (!blocks.length || index < 0 || index >= blocks.length) return;
      setVoiceBlockFocusIndex(index);
      const line = blocks[index];
      if (!line) return;
      setVoicePlaybackBusy(true);
      void speakMother(line).finally(() => setVoicePlaybackBusy(false));
    },
    [speakMother],
  );

  const replayFullLastAssistant = useCallback(() => {
    const assistants = messages.filter((m) => m.role === "assistant");
    const last = assistants[assistants.length - 1];
    const t = last?.text ? textForSpeech(last.text) : "";
    if (!t) return;
    setVoicePlaybackBusy(true);
    void speakMother(t).finally(() => setVoicePlaybackBusy(false));
  }, [messages, speakMother]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (!voicePlaybackBusy) return;
      e.preventDefault();
      abortMotherSpeech();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [abortMotherSpeech, voicePlaybackBusy]);

  const toggleVoiceEnabled = useCallback(() => {
    const latestAssistantMessage = [...messages].reverse().find((message) => message.role === "assistant");
    setVoiceEnabled((prev) => {
      const next = !prev;
      if (next) {
        setVoiceHealth("idle");
        if (latestAssistantMessage?.text) {
          lastSpokenAssistantTextRef.current = latestAssistantMessage.text;
        }
        void speakMother(MUTHUR_PRESET.testPhrase);
      } else {
        setVoiceHealth("off");
        stopMirageAudio();
      }
      return next;
    });
  }, [messages, speakMother, stopMirageAudio]);

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

  const saveMuthurVoiceCopyToApp = useCallback(() => {
    saveMuthurVoiceMasterCopy(buildMuthurVoiceMasterCopy(voiceDialRef.current));
    toast.success("Saved MUTHUR voice copy.");
  }, []);

  const restoreMuthurVoiceMaster = useCallback(() => {
    if (typeof window !== "undefined") {
      const confirmed = window.confirm("Restore MUTHUR voice master?");
      if (!confirmed) return;
    }

    const restored = restoreMuthurVoiceMasterCopy();
    setVoiceDial(restored);
    voiceDialRef.current = restored;
    toast.success("Restored MUTHUR master.");
  }, []);

  const playVoiceTest = useCallback(() => {
    if (!voiceEnabled) return;
    void speakMother(MUTHUR_PRESET.testPhrase);
  }, [speakMother, voiceEnabled]);

  useEffect(() => {
    try {
      saveMuthurVoiceMasterCopy(buildMuthurVoiceMasterCopy(voiceDial));
    } catch {
      /* ignore */
    }
  }, [voiceDial]);

  useEffect(() => {
    voiceDialRef.current = voiceDial;
  }, [voiceDial]);

  useEffect(() => {
    const master = motherMasterGainRef.current;
    if (!master) return;
    master.gain.value = muthurMasterGain(voiceDial.volume);
  }, [voiceDial.volume]);

  useEffect(() => {
    setDeckUplinkSonarVolume(sonarVolume);
  }, [sonarVolume]);

  useEffect(() => {
    setDeckSfxVolume(deckSfxVolume);
  }, [deckSfxVolume]);

  const handleVoiceVolumeChange = useCallback((volume: number) => {
    setVoiceDial((prev) => ({ ...prev, volume }));
  }, []);

  const handleSonarVolumeChange = useCallback((volume: number) => {
    setSonarVolume(volume);
    saveUplinkSonarVolume(volume);
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

  useEffect(() => {
    if (typeof window === "undefined") return;
    let restored = false;
    try {
      const workspaceState = loadWorkspaceState();
      if (workspaceState) {
        const restoredWorkspaceTabs = sanitizeCustomTabs(workspaceState.customTabs);
        useCyberdeckTabStore.getState().setCustomTabs(restoredWorkspaceTabs);
        if (
          typeof workspaceState.activeCustomTabId === "string" &&
          restoredWorkspaceTabs.some((tab) => tab.id === workspaceState.activeCustomTabId)
        ) {
          useCyberdeckTabStore.getState().setActiveCustomTabId(workspaceState.activeCustomTabId);
          restored = true;
        } else if (
          typeof workspaceState.activeModuleId === "string" &&
          isFixedServerTabId(workspaceState.activeModuleId)
        ) {
          useCyberdeckTabStore.getState().setServer(workspaceState.activeModuleId);
          useCyberdeckTabStore.getState().setActiveCustomTabId(null);
          restored = true;
        } else {
          useCyberdeckTabStore.getState().setActiveCustomTabId(null);
        }
      }
      const stored = window.localStorage.getItem(UI_STATE_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<CyberdeckUiState> | null;
        const allFixedIds = ["m", "s", "ct", "b"] as const;
        const savedServer = parsed?.server;
        if (savedServer && allFixedIds.includes(savedServer as (typeof allFixedIds)[number])) {
          useCyberdeckTabStore.getState().setServer(safeServerId(savedServer) as (typeof SERVER_IDS)[number]);
          restored = true;
        }
        if (parsed?.navRailContext === "gateway" || parsed?.navRailContext === "tabs") {
          setNavRailContext(parsed.navRailContext);
          restored = true;
        }
        const highlightId = parsed?.serverKeyboardHighlightId;
        if (highlightId && allFixedIds.includes(highlightId as (typeof allFixedIds)[number])) {
          setServerKeyboardHighlightId(safeServerId(highlightId) as (typeof SERVER_IDS)[number] | null);
          restored = true;
        }
        if (
          parsed?.operatorSurfaceMode === "workspace" ||
          parsed?.operatorSurfaceMode === "browser" ||
          (typeof parsed?.operatorBrowserUrl === "string" && parsed.operatorBrowserUrl.trim())
        ) {
          restoreOperatorUiFromDeck({
            operatorSurfaceMode: parsed?.operatorSurfaceMode,
            operatorBrowserUrl: parsed?.operatorBrowserUrl,
          });
          restored = true;
        }
        const restoredCustomTabs = sanitizeCustomTabs(parsed?.customTabs);
        useCyberdeckTabStore.getState().setCustomTabs(restoredCustomTabs);
        if (
          typeof parsed?.activeCustomTabId === "string" &&
          restoredCustomTabs.some((tab) => tab.id === parsed.activeCustomTabId)
        ) {
          useCyberdeckTabStore.getState().setActiveCustomTabId(parsed.activeCustomTabId);
        } else {
          useCyberdeckTabStore.getState().setActiveCustomTabId(null);
        }
        if (restoredCustomTabs.length > 0) {
          restored = true;
        }
      }
    } catch {
      /* ignore ui restore errors */
    } finally {
      if (restored) {
        startupRailResolvedRef.current = true;
      }
      setWorkspaceHydrated(true);
      setDeckUiHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!deckUiHydrated) return;
    if (isEchoMirageDesktopShell()) {
      useCyberdeckTabStore.getState().setCustomTabs((prev) =>
        prev.filter((tab) => tab.kind !== "install"),
      );
      return;
    }
    useCyberdeckTabStore.getState().setCustomTabs((prev) => {
      if (prev.some((tab) => tab.kind === "install")) return prev;
      return [
        {
          id: "echo-install-pane",
          label: "INSTALL",
          glyph: "I",
          kind: "install",
        },
        ...prev,
      ];
    });
  }, [deckUiHydrated]);

  const buildCyberdeckUiPayload = useCallback(
    (): CyberdeckUiState => {
      const { server, customTabs, activeCustomTabId } = useCyberdeckTabStore.getState();
      return {
        server,
        navRailContext,
        serverKeyboardHighlightId,
        operatorSurfaceMode,
        operatorBrowserUrl,
        customTabs: customTabs as CustomTab[],
        activeCustomTabId,
      };
    },
    [navRailContext, operatorBrowserUrl, operatorSurfaceMode, serverKeyboardHighlightId],
  );

  useEffect(() => {
    if (!deckUiHydrated || uiFocusRestoredRef.current) return;
    if (ENABLE_AUTOMATION && !providerConfigHydrated) return;
    if (ENABLE_AUTOMATION && !startupRailResolvedRef.current) return;
    const id = window.requestAnimationFrame(() => {
      if (navRailContext === "tabs") {
        serverRailRef.current?.focus({ preventScroll: true });
      } else {
        gatewayColumnRef.current?.focus({ preventScroll: true });
      }
      uiFocusRestoredRef.current = true;
    });
    return () => window.cancelAnimationFrame(id);
  }, [deckUiHydrated, navRailContext, providerConfigHydrated]);

  const publishOperatorObservation = useCallback(() => {
    if (!deckUiHydrated) return;
    const { server, customTabs, activeCustomTabId } = useCyberdeckTabStore.getState();
    const activeCustomTab = customTabs.find((tab) => tab.id === activeCustomTabId) ?? null;
    const visibleAsset = activeCustomTab?.asset ?? (operatorSurfaceMode === "workspace" ? operatorDroppedAsset : null);
    void publishMuthurObservation({
      route: "/cyberdeck",
      surface: "cyberdeck",
      activeTab: activeCustomTab?.label ?? server,
      activePane: activeCustomTab?.kind ?? server,
      visibleDocument: visibleAsset?.name ?? null,
      documentExcerpt: typeof visibleAsset?.text === "string" ? visibleAsset.text.slice(0, 800) : null,
    });
  }, [
    deckUiHydrated,
    operatorDroppedAsset,
    operatorSurfaceMode,
  ]);

  useEffect(() => {
    publishOperatorObservation();
    const unsubscribe = useCyberdeckTabStore.subscribe(() => publishOperatorObservation());
    return () => {
      unsubscribe();
      flushMuthurObservation();
    };
  }, [publishOperatorObservation]);

  useEffect(() => {
    if (!deckUiHydrated) return;

    const syncMuthurScreenSnapshot = () => {
      const { server, customTabs, activeCustomTabId } = useCyberdeckTabStore.getState();
      const activeCustomTab = customTabs.find((tab) => tab.id === activeCustomTabId) ?? null;
      const operatorSurface = operatorDroppedAsset
        ? resolveOperatorAssetSurface(operatorDroppedAsset)
        : null;
      const operatorText =
        operatorSurfaceIsDocument && operatorDroppedAsset
          ? readOperatorPaneSaveText(operatorDroppedAsset.text || "")
          : null;

      setMuthurScreenSnapshot({
        capturedAt: new Date().toISOString(),
        activeServer: server,
        activeCustomTab: activeCustomTab?.label ?? null,
        chat: messages.map((message) => ({
          role:
            message.role === "user" || message.role === "assistant" || message.role === "system"
              ? message.role
              : "error",
          label:
            message.role === "user"
              ? chatUserDisplayName
              : message.role === "assistant"
                ? message.inhabitant
                  ? formatInhabitantChannelLabel(message.inhabitant)
                  : "MUTHUR"
                : message.role === "system"
                  ? "SYS"
                  : "ERR",
          text: message.text,
        })),
        streamingMuthur: streamText || null,
        operator: operatorDroppedAsset
          ? {
              surfaceMode: operatorSurfaceMode,
              fileName: operatorDroppedAsset.name ?? null,
              filePath:
                operatorActiveFilePath?.trim() ||
                operatorDroppedAsset.localFilePath?.trim() ||
                null,
              previewSurface: operatorSurface,
              docMode: operatorDocMode,
              documentText: operatorText,
            }
          : null,
        browserUrl: operatorSurfaceMode === "browser" ? operatorBrowserUrl : null,
      });
    };

    syncMuthurScreenSnapshot();
    const unsubscribe = useCyberdeckTabStore.subscribe(syncMuthurScreenSnapshot);
    return unsubscribe;
  }, [
    chatUserDisplayName,
    deckUiHydrated,
    messages,
    operatorActiveFilePath,
    operatorDocMode,
    operatorDroppedAsset,
    operatorBrowserUrl,
    operatorSurfaceIsDocument,
    operatorSurfaceMode,
    streamText,
  ]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const saved = (await get<HeapEntry[]>(HEAP_STORAGE_KEY)) || [];
        if (!mounted) return;
        setHeapEntries(Array.isArray(saved) ? saved : []);
      } catch {
        if (!mounted) return;
        setHeapEntries([]);
      } finally {
        if (mounted) setHeapHydrated(true);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!heapHydrated) return;
    void set(HEAP_STORAGE_KEY, heapEntries).catch(() => {
      toast.error("Heap save failed.");
    });
  }, [heapEntries, heapHydrated]);

  const saveHeapDraft = useCallback(
    async (sourceText?: string) => {
      const text = (sourceText ?? heapTextDraft).trim();
      if (!text) {
        toast.error("Heap entry is empty.");
        return;
      }

      const nextName = heapNameDraft.trim() || `entry-${heapEntries.length + 1}`;
      const entry: HeapEntry = {
        id: crypto.randomUUID(),
        name: nextName,
        text: sourceText ?? heapTextDraft,
        createdAt: Date.now(),
      };

      setHeapEntries((prev) => [entry, ...prev]);
      setHeapNameDraft("");
      setHeapTextDraft("");
      toast.success(`Saved "${nextName}" to Heap.`);
    },
    [heapEntries.length, heapNameDraft, heapTextDraft],
  );

  const pasteClipboardToHeap = useCallback(async () => {
    try {
      const clipboardText = await readEchoMirageClipboardText();

      if (!clipboardText.trim()) {
        toast.error("Clipboard has no text.");
        return;
      }

      setHeapTextDraft(clipboardText);
      await saveHeapDraft(clipboardText);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not paste clipboard text.");
    }
  }, [saveHeapDraft]);

  const copyHeapEntry = useCallback(async (entry: HeapEntry) => {
    try {
      await copyTextToClipboard(entry.text);
      toast.success(`Copied "${entry.name}" to clipboard.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not copy heap entry.");
    }
  }, []);

  const openHeapEntryInOperator = useCallback(
    (entry: HeapEntry) => {
      const filePath = `heap://${entry.id}`;
      void openOperatorFile(filePath, async () => {
        const text = entry.text || "";
        setOperatorTextAsset({
          kind: "text",
          name: entry.name,
          mimeType: "text/plain",
          size: new Blob([text]).size,
          text,
        });
        setOperatorSurfaceMode("workspace");
        setOperatorDocMode("edit");
        useCyberdeckTabStore.getState().setServer("m");
        setNavRailContext("gateway");
      });
    },
    [openOperatorFile, setOperatorDocMode, setOperatorSurfaceMode, setOperatorTextAsset, setNavRailContext],
  );

  const deleteHeapEntry = useCallback((id: string) => {
    setHeapEntries((prev) => prev.filter((entry) => entry.id !== id));
  }, []);

  const closeMirageContextMenu = useCallback(() => {
    setMirageContextMenu(null);
    emitSignal({ source: "ui", type: "cancel", payload: { target: "mirage_menu" }, severity: "info" });
  }, []);

  const closeGatewayPaneContextMenu = useCallback(() => {
    setGatewayPaneContextMenu(null);
    emitSignal({ source: "ui", type: "cancel", payload: { target: "gateway_menu" }, severity: "info" });
  }, []);

  const clearSavedCustomTabState = useCallback(() => {
    const tabs = useCyberdeckTabStore.getState().customTabs;
    const removedCount = tabs.length;
    terminateSurveySessionWhenTabsCleared(tabs);
    useCyberdeckTabStore.getState().setCustomTabs([]);
    useCyberdeckTabStore.setState({ mountedCustomTabIds: [] });
    useCyberdeckTabStore.getState().setActiveCustomTabId(null);

    try {
      const raw = window.localStorage.getItem(UI_STATE_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<CyberdeckUiState> | null;
      if (!parsed || typeof parsed !== "object") return;
      const nextState = { ...parsed };
      delete nextState.customTabs;
      delete nextState.activeCustomTabId;
      window.localStorage.setItem(UI_STATE_STORAGE_KEY, JSON.stringify(nextState));
    } catch {
      /* ignore */
    }

    setMessages((prev) => [
      ...prev,
      {
        role: "system",
        text:
          removedCount > 0
            ? `TAB_STATE_CLEARED // REMOVED ${removedCount} CUSTOM TAB${removedCount === 1 ? "" : "S"}`
            : "TAB_STATE_CLEARED // NO_CUSTOM_TABS_FOUND",
      },
    ]);
    playDeckSystemSound("chirp", 0.05);
    if (removedCount > 0) {
      toast.success(`Cleared ${removedCount} custom tab${removedCount === 1 ? "" : "s"}.`);
    } else {
      toast.info("No custom tabs were saved.");
    }
  }, []);

  /** Move real focus onto the rail when leaving gateway so Enter/arrows are not captured by chat/key inputs. */
  useLayoutEffect(() => {
    if (navRailContext === "tabs" && prevNavRailRef.current === "gateway") {
      serverRailRef.current?.focus({ preventScroll: true });
    }
    prevNavRailRef.current = navRailContext;
  }, [navRailContext]);

  const navRailContextRef = useRef(navRailContext);
  navRailContextRef.current = navRailContext;

  useEffect(() => {
    const onFocusIn = (e: FocusEvent) => {
      if (navRailContextRef.current !== "tabs") return;
      const el = e.target as HTMLElement | null;
      if (!el || serverRailRef.current?.contains(el)) return;
      const tag = el.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable) {
        setNavRailContext("gateway");
        setServerKeyboardHighlightId(null);
      }
    };
    document.addEventListener("focusin", onFocusIn, true);
    return () => document.removeEventListener("focusin", onFocusIn, true);
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

  useSurveyMuthurArchive({
    archiveMuthurHistoryLine,
    appendAssistantMessage: appendMuthurAssistantMessage,
    pinMuthurChatToBottom,
    focusMessageScroll: () => messageScrollRef.current?.focus({ preventScroll: true }),
  });

  useEffect(() => {
    if (isStreaming && isAudioAllowed()) {
      if (networkFeedbackDelayRef.current == null) {
        networkFeedbackDelayRef.current = window.setTimeout(() => {
          networkFeedbackDelayRef.current = null;
          if (!isAudioAllowed()) return;
          playDeckBleepBloop();
          networkFeedbackRepeatRef.current = window.setInterval(() => {
            if (!isAudioAllowed()) {
              clearNetworkFeedbackAudio();
              return;
            }
            playDeckBleepBloop();
          }, 7000);
        }, 2800);
      }
    } else {
      clearNetworkFeedbackAudio();
    }
    return () => {
      clearNetworkFeedbackAudio();
    };
  }, [clearNetworkFeedbackAudio, isStreaming]);


  // Column-scoped arrows: rail / chat scroll / gateway (providers + models). Tab rail: Escape; Enter on rail → gateway + provider hover.
  useEffect(() => {
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      if (e.key === "Escape" && !e.repeat) {
        emitSignal({ source: "ui", type: "cancel", payload: { via: "escape" }, severity: "info" });
      }

      // Browser Find (and find-next): do not intercept — keep default keyboard behavior.
      if (e.key === "F3") return;
      if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === "f" || e.key === "F" || e.key === "g" || e.key === "G"))
        return;

      const deck = cyberdeckRootRef.current;
      if (
        deck &&
        t !== document.body &&
        t !== document.documentElement &&
        !deck.contains(t)
      ) {
        return;
      }

      const inRail = !!(serverRailRef.current && serverRailRef.current.contains(t));
      const inChatCol = !!(chatColumnRef.current && chatColumnRef.current.contains(t));
      const inGateway = !!(gatewayColumnRef.current && gatewayColumnRef.current.contains(t));
      const inChatInput =
        messageInputRef.current?.element != null && t === messageInputRef.current.element;
      const isEditableTarget =
        t.isContentEditable ||
        t.tagName === "INPUT" ||
        t.tagName === "TEXTAREA" ||
        t.tagName === "SELECT";

      if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === "v" || e.key === "V")) {
        if (isEditableTarget) return;
        if (useCyberdeckTabStore.getState().server === "m") {
          e.preventDefault();
          void pasteClipboardToOperator();
          return;
        }
      }

      const sfxNav = {
        step: () => {
          if (!e.repeat) playDeckNavigationSound("step");
        },
        commit: () => {
          if (!e.repeat) playDeckNavigationSound("commit");
        },
        back: () => {
          if (!e.repeat) playDeckNavigationSound("back");
        },
      };

      // Tab: message box ↔ deck columns/surfaces; includes chat log (col2) in sequencer.
      if (e.key === "Tab" && !e.repeat) {
        const msg = messageInputRef.current?.element;
        if (!msg || msg.disabled) {
          /* fall through */
        } else if (inGateway && !inChatInput) {
          e.preventDefault();
          sfxNav.commit();
          msg.focus({ preventScroll: false });
          return;
        } else if (inRail && !inChatInput) {
          e.preventDefault();
          sfxNav.commit();
          msg.focus({ preventScroll: false });
          return;
        } else if (inChatCol && !inChatInput) {
          e.preventDefault();
          sfxNav.commit();
          msg.focus({ preventScroll: false });
          return;
        } else if (inChatInput) {
          e.preventDefault();
          sfxNav.commit();
          const next = deckTabNextRef.current;
          if (e.shiftKey) {
            if (next === "gateway") {
              messageScrollRef.current?.focus({ preventScroll: true });
              deckTabNextRef.current = "chatlog";
            } else if (next === "rail") {
              gatewayColumnRef.current?.focus({ preventScroll: true });
              deckTabNextRef.current = "gateway";
            } else {
              serverRailRef.current?.focus({ preventScroll: true });
              setNavRailContext("tabs");
              setServerKeyboardHighlightId(serverRef.current);
              deckTabNextRef.current = "rail";
            }
            return;
          }
          if (next === "gateway") {
            gatewayColumnRef.current?.focus({ preventScroll: true });
            deckTabNextRef.current = "rail";
          } else if (next === "rail") {
            serverRailRef.current?.focus({ preventScroll: true });
            setNavRailContext("tabs");
            setServerKeyboardHighlightId(serverRef.current);
            deckTabNextRef.current = "chatlog";
          } else {
            messageScrollRef.current?.focus({ preventScroll: true });
            deckTabNextRef.current = "gateway";
          }
          return;
        }
      }

      // Column 2 Escape: previous link (scrollIntoView so the move reads clearly); first link → blur + log surface, no wrap to bottom.
      if (e.key === "Escape" && inChatCol && !inRail && !inGateway) {
        const scroll = messageScrollRef.current;
        if (!scroll) return;
        const links = [...scroll.querySelectorAll<HTMLAnchorElement>("a[href]")].filter((a) =>
          scroll.contains(a),
        );
        const anchor =
          t.closest("a") instanceof HTMLAnchorElement && scroll.contains(t.closest("a")!)
            ? (t.closest("a") as HTMLAnchorElement)
            : null;
        if (anchor && links.length > 0) {
          e.preventDefault();
          const i = links.indexOf(anchor);
          if (i > 0) {
            sfxNav.step();
            const prev = links[i - 1];
            prev.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "auto" });
            prev.focus({ preventScroll: true });
          } else {
            sfxNav.back();
            anchor.blur();
            scroll.focus({ preventScroll: false });
          }
          return;
        }
        if (links.length > 0) {
          e.preventDefault();
          sfxNav.step();
          const last = links[links.length - 1];
          last.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "auto" });
          last.focus({ preventScroll: true });
          return;
        }
        if (inChatInput) {
          e.preventDefault();
          sfxNav.step();
          scroll.focus({ preventScroll: false });
          return;
        }
        if (t === scroll) {
          e.preventDefault();
          sfxNav.commit();
          messageInputRef.current?.focus({ preventScroll: false });
          return;
        }
        return;
      }

      if (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT") return;
      if (t.isContentEditable) return;

      // Escape toggles rail ↔ gateway hierarchy only in columns 1 and 3.
      if (e.key === "Escape") {
        const inOneOrThree = inRail || inGateway;
        if (!inOneOrThree) return;
        if (navRailContext === "gateway") {
          e.preventDefault();
          sfxNav.back();
          setProviderKeyboardHighlightId(null);
          setModelKeyboardHighlightId(null);
          setNavRailContext("tabs");
          setServerKeyboardHighlightId(serverRef.current);
          return;
        }
        if (navRailContext === "tabs") {
          e.preventDefault();
          sfxNav.back();
          setNavRailContext("gateway");
          setServerKeyboardHighlightId(null);
          return;
        }
      }

      const navKey =
        e.key === "ArrowDown" ||
        e.key === "ArrowUp" ||
        e.key === "Home" ||
        e.key === "End" ||
        e.key === "Enter" ||
        e.key === " ";

      if (navRailContext === "tabs") {
        if (inRail) {
          const sids: (typeof SERVER_IDS)[number][] = [...SERVER_IDS];
          const sPivot =
            serverKeyboardHighlightId ??
            ((SERVER_IDS as readonly string[]).includes(getCyberdeckSelectedRailTabId())
              ? (getCyberdeckSelectedRailTabId() as (typeof SERVER_IDS)[number])
              : sids[0]);
          let sidx = sids.indexOf(sPivot);
          if (sidx < 0) sidx = 0;

          if (e.key === "ArrowDown") {
            e.preventDefault();
            sfxNav.step();
            setServerKeyboardHighlightId(sids[(sidx + 1) % sids.length]);
            return;
          }
          if (e.key === "ArrowUp") {
            e.preventDefault();
            sfxNav.step();
            setServerKeyboardHighlightId(sids[(sidx - 1 + sids.length) % sids.length]);
            return;
          }
          if (e.key === "Home") {
            e.preventDefault();
            sfxNav.step();
            setServerKeyboardHighlightId(sids[0]);
            return;
          }
          if (e.key === "End") {
            e.preventDefault();
            sfxNav.step();
            setServerKeyboardHighlightId(sids[sids.length - 1]);
            return;
          }
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            sfxNav.commit();
            const tabChanged = handleTabClickRef.current(serverKeyboardHighlightId ?? sPivot);
            if (tabChanged) {
              setNavRailContext("gateway");
              setServerKeyboardHighlightId(null);
              setModelKeyboardHighlightId(null);
              const pid =
                (CYBERDECK_PROVIDER_IDS as readonly string[]).includes(activeProvider) ? activeProvider : CYBERDECK_PROVIDER_IDS[0];
              setProviderKeyboardHighlightId(pid);
            }
            return;
          }
        } else if (navKey && !isEditableTarget) {
          e.preventDefault();
        }
        if (!isEditableTarget) return;
      }

      if (inChatCol && !inChatInput) {
        const chatRowCount =
          messages.length + (streamText ? 1 : 0) + (isStreaming && !streamText ? 1 : 0);
        if (chatRowCount > 0) {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            sfxNav.step();
            setChatKeyboardHighlightIndex((prev) => {
              const current = prev == null ? -1 : Math.min(prev, chatRowCount - 1);
              return Math.min(current + 1, chatRowCount - 1);
            });
            return;
          }
          if (e.key === "ArrowUp") {
            e.preventDefault();
            sfxNav.step();
            setChatKeyboardHighlightIndex((prev) => {
              const current = prev == null ? chatRowCount : Math.min(prev, chatRowCount - 1);
              return Math.max(current - 1, 0);
            });
            return;
          }
          if (e.key === "Home") {
            e.preventDefault();
            sfxNav.step();
            setChatKeyboardHighlightIndex(0);
            return;
          }
          if (e.key === "End") {
            e.preventDefault();
            sfxNav.step();
            setChatKeyboardHighlightIndex(chatRowCount - 1);
            return;
          }
        }
      }

      const allowGatewayKeys =
        navRailContext === "gateway" && (inGateway || (!inChatCol && !inRail));

      if (!allowGatewayKeys) return;

      // Pi composer and gateway key fields handle Enter/arrows locally.
      if (isEditableTarget) return;

      const ids = [...CYBERDECK_PROVIDER_IDS];
      const pivot =
        providerKeyboardHighlightId ??
        (ids.includes(activeProvider as (typeof CYBERDECK_PROVIDER_IDS)[number]) ? activeProvider : ids[0]);
      let idx = ids.indexOf(pivot as (typeof CYBERDECK_PROVIDER_IDS)[number]);
      if (idx < 0) idx = 0;

      const models = modelList;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        sfxNav.step();
        if (modelKeyboardHighlightId != null && models.length > 0) {
          const mi = models.findIndex((m) => m.id === modelKeyboardHighlightId);
          if (mi >= 0) {
            setModelKeyboardHighlightId(models[(mi + 1) % models.length].id);
          }
          return;
        }
        if (idx >= ids.length - 1) {
          if (models.length > 0) {
            setProviderKeyboardHighlightId(null);
            setModelKeyboardHighlightId(models[0].id);
          } else {
            setProviderKeyboardHighlightId(ids[(idx + 1) % ids.length]);
          }
          return;
        }
        setProviderKeyboardHighlightId(ids[idx + 1]);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        sfxNav.step();
        if (modelKeyboardHighlightId != null && models.length > 0) {
          const mi = models.findIndex((m) => m.id === modelKeyboardHighlightId);
          if (mi <= 0) {
            setModelKeyboardHighlightId(null);
            setProviderKeyboardHighlightId(ids[ids.length - 1]);
          } else {
            setModelKeyboardHighlightId(models[mi - 1].id);
          }
          return;
        }
        if (idx <= 0) {
          if (models.length > 0) {
            setProviderKeyboardHighlightId(null);
            setModelKeyboardHighlightId(models[models.length - 1].id);
          } else {
            setProviderKeyboardHighlightId(ids[(idx - 1 + ids.length) % ids.length]);
          }
          return;
        }
        setProviderKeyboardHighlightId(ids[idx - 1]);
        return;
      }
      if (e.key === "Home") {
        e.preventDefault();
        sfxNav.step();
        setModelKeyboardHighlightId(null);
        setProviderKeyboardHighlightId(ids[0]);
        return;
      }
      if (e.key === "End") {
        e.preventDefault();
        sfxNav.step();
        if (models.length > 0) {
          setProviderKeyboardHighlightId(null);
          setModelKeyboardHighlightId(models[models.length - 1].id);
        } else {
          setModelKeyboardHighlightId(null);
          setProviderKeyboardHighlightId(ids[ids.length - 1]);
        }
        return;
      }
      if (e.key === "Enter" || e.key === " ") {
        if (modelKeyboardHighlightId != null) {
          e.preventDefault();
          sfxNav.commit();
          activateModelById(modelKeyboardHighlightId);
          setModelKeyboardHighlightId(null);
          return;
        }
        if (providerKeyboardHighlightId == null) return;
        e.preventDefault();
        sfxNav.commit();
        handleProviderClick(providerKeyboardHighlightId);
        setProviderKeyboardHighlightId(null);
        setModelKeyboardHighlightId(null);
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [
    activateModelById,
    activeProvider,
    modelKeyboardHighlightId,
    modelList,
    navRailContext,
    providerKeyboardHighlightId,
    handleProviderClick,
    pasteClipboardToHeap,
    pasteClipboardToOperator,
    serverKeyboardHighlightId,
  ]);

  useEffect(() => {
    const maxIndex = messages.length + (streamText ? 1 : 0) + (isStreaming && !streamText ? 1 : 0) - 1;
    setChatKeyboardHighlightIndex((prev) => {
      if (prev == null) return null;
      if (maxIndex < 0) return null;
      return Math.min(prev, maxIndex);
    });
  }, [isStreaming, messages.length, streamText]);

  useEffect(() => {
    if (chatKeyboardHighlightIndex == null) return;
    window.requestAnimationFrame(() => {
      const row = document.querySelector<HTMLElement>(`[data-chat-row="${chatKeyboardHighlightIndex}"]`);
      row?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
    });
  }, [chatKeyboardHighlightIndex]);

  useEffect(() => {
    const rail = serverRailRef.current;
    if (!rail) return;
    const onRailFocus = () => {
      setNavRailContext("tabs");
      setServerKeyboardHighlightId(serverRef.current);
    };
    rail.addEventListener("focusin", onRailFocus);
    return () => rail.removeEventListener("focusin", onRailFocus);
  }, []);

  useEffect(() => {
    const scrollToHighlight = (selector: string) => {
      window.requestAnimationFrame(() => {
        const el = document.querySelector<HTMLElement>(selector);
        el?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
      });
    };

    if (navRailContext === "tabs" && serverKeyboardHighlightId) {
      scrollToHighlight(`[data-server-tab="${serverKeyboardHighlightId}"]`);
    }
  }, [navRailContext, serverKeyboardHighlightId]);


  useEffect(() => {
    const latest = messages[messages.length - 1];
    if (!latest || latest.role !== "assistant") {
      assistantVoiceBlocksRef.current = [];
      setVoiceBlockTotal(0);
      setVoiceBlockFocusIndex(0);
    }
  }, [messages]);

  useEffect(() => {
    if (!voiceEnabled || isStreaming) return;
    if (speakQueueActiveRef.current) return;
    if (!messages || messages.length === 0) return;
    const latest = messages[messages.length - 1];
    if (!latest || latest.role !== "assistant") return;
    if (latest.text === lastSpokenAssistantTextRef.current) return;
    if (/^Working on that request\b/i.test(latest.text.trim())) return;
    const speechText = textForSpeech(latest.text);
    if (!speechText) return;
    lastSpokenAssistantTextRef.current = latest.text;
    const blocks = splitIntoSpeechBlocks(latest.text);
    assistantVoiceBlocksRef.current = blocks;
    setVoiceBlockTotal(blocks.length);
    const focus = blocks.length ? blocks.length - 1 : 0;
    setVoiceBlockFocusIndex(focus);
    if (motherTerminalRef.current.shouldBurst(speechText)) {
      void motherTerminalRef.current.unlock().then(() => {
        motherTerminalRef.current.playBurstSound(speechText.length);
      });
    }
    setVoicePlaybackBusy(true);
    void speakMother(speechText).finally(() => setVoicePlaybackBusy(false));
  }, [isStreaming, messages, speakMother, voiceEnabled]);

  useEffect(() => {
    if (!voiceEnabled) return;
    const failureCountRef = { current: 0 };
    let removeListener = () => {};
    void loadComputerUse().then((cu) => {
      removeListener = cu.addNarrationListener((narration) => {
        if (!voiceEnabled) return;
        void speakMother(narration.text)
          .then(() => {
            failureCountRef.current = 0;
          })
          .catch(() => {
            failureCountRef.current += 1;
            if (failureCountRef.current >= 3) {
              void abortMotherSpeech();
              failureCountRef.current = 0;
            }
          });
      });
    });
    return () => {
      removeListener();
      void loadComputerUse().then((cu) => cu.resumeAfterStop());
    };
  }, [voiceEnabled]);

  useEffect(() => {
    let unlocked = false;
    const unlock = () => {
      if (unlocked) return;
      unlocked = true;
      void unlockDeckKeyboardSfx();
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("touchstart", unlock);
    };
    window.addEventListener("pointerdown", unlock, { passive: true });
    window.addEventListener("keydown", unlock, { passive: true });
    window.addEventListener("touchstart", unlock, { passive: true });

    const unbind = bindDeckKeyboardSfx(window, {
      mode: "cyberdeck",
      volume: 1.25,
    });

    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("touchstart", unlock);
      unbind();
    };
  }, []);

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
    terminateSurveySessionWhenTabClosed(closingTab?.kind);
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

  useEffect(() => {
    const pushToChat = async (detail: PowerFistStackCommand | undefined) => {
      if (!detail) return;

      const toolOverride = detail.toolOverride;
      if (toolOverride) {
        const cardLine = detail.message.trim() || `POWERFIST OVERRIDE // ${detail.card.title}`;
        setMessages((prev) => [...prev, { role: "user", text: cardLine }]);
        setMessages((prev) => [
          ...prev,
          {
            role: "system",
            text: `POWERFIST OVERRIDE // ${detail.card.title} // ${toolOverride.name}`,
          },
        ]);

        const result = await runPowerfistToolOverride(toolOverride, detail.composerSupplement);
        if (!result.ok) {
          setMessages((prev) => [
            ...prev,
            {
              role: "system",
              text: `TOOL FAILURE // ${result.error || result.text || toolOverride.name}`,
            },
          ]);
          return;
        }

        setMessages((prev) => [...prev, { role: "assistant", text: result.text.trim() }]);

        if (result.operatorOpenFile) {
          const opened = await openWorkspaceFileInOperator(result.operatorOpenFile);
          if (opened) {
            flushMuthurObservation();
            await waitForOperatorDocumentReady(3000);
            setMessages((prev) => [
              ...prev,
              {
                role: "system",
                text: `OPERATOR OPEN // ${result.operatorOpenFile?.fileName} // ${result.operatorOpenFile?.filePath}`,
              },
            ]);
          }
        }

        if (result.operatorEdits && result.operatorEdits.length > 0) {
          setOperatorDocMode("edit");
          const editResult = await applyMuthurOperatorEdits(result.operatorEdits);
          if (editResult === "applied") {
            setMessages((prev) => [
              ...prev,
              {
                role: "system",
                text: "OPERATOR EDIT // MUTHUR applied — Ctrl+Z to undo in the operator pane.",
              },
            ]);
          }
        }

        if (result.codingVerify) {
          setMessages((prev) => [
            ...prev,
            { role: "system", text: formatCodingVerifySystemLine(result.codingVerify!) },
          ]);
        }
        return;
      }

      const message = detail.message.trim();
      if (!message) return;
      void handleSend(message, { preserveSelectedSurface: true });
    };
    const handlePowerFistPush = (event: Event) => {
      event.preventDefault();
      void pushToChat((event as CustomEvent<PowerFistStackCommand>).detail);
    };
    const channel =
      typeof BroadcastChannel === "undefined"
        ? null
        : new BroadcastChannel(POWERFIST_STACK_CHANNEL);
    if (channel) {
      channel.onmessage = (event: MessageEvent<PowerFistStackCommand>) => {
        void pushToChat(event.data);
      };
    }
    let deckSocket: ReturnType<typeof connectPowerfistDeckSocket> | null = null;
    let cancelled = false;
    void (async () => {
      const pairing = await fetchPowerfistDeckConnect();
      if (cancelled || !pairing.ok || !pairing.deckWsUrl) return;
      deckSocket = connectPowerfistDeckSocket({
        wsUrl: pairing.deckWsUrl,
        onStackPush: (command) => {
          void pushToChat(command);
        },
        onMissionSolve: handleSurveyMissionSolve,
      });
    })();
    window.addEventListener(POWERFIST_STACK_PUSH_EVENT, handlePowerFistPush);
    return () => {
      cancelled = true;
      window.removeEventListener(POWERFIST_STACK_PUSH_EVENT, handlePowerFistPush);
      channel?.close();
      deckSocket?.close();
    };
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
      <SurveyAutoPairHost />
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











