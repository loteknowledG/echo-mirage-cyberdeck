"use client";

import type { CSSProperties, DragEvent as ReactDragEvent, MouseEvent as ReactMouseEvent } from "react";
import { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo, startTransition } from "react";
import { flushSync } from "react-dom";
import { CopyIcon, DownloadIcon } from "@radix-ui/react-icons";
import { art } from "@/lib/TerminalArt";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { MUTHUR_PRESET } from "@/voice/muthurPreset";
import {
  buildMuthurVoiceMasterCopy,
  getInitialMuthurVoiceDials,
  muthurBrowserSpeechTuning,
  muthurMasterGain,
  restoreMuthurVoiceMasterCopy,
  saveMuthurVoiceMasterCopy,
  type MuthurVoiceDialState,
} from "@/voice/muthurVoiceSettings";
import {
  buildMuthurMemoryContext,
  clearMuthurMemory,
  createEmptyMuthurMemory,
  loadMuthurMemoryWithResult,
  recordMuthurMemoryTurn,
  saveMuthurMemory,
  type MuthurMemoryState,
} from "@/lib/muthur-memory";
import {
  OPERATOR_BROWSER_HOME_URL,
  deriveOperatorBrowserUrl,
  extractAssistantBrowserCommand,
  looksLikeAffirmativeReply,
  looksLikeBrowserSearchOffer,
  looksLikeCaptchaBlock,
  looksLikeOperatorWebIntent,
  normalizeOperatorBrowserUrl,
  parseBrowserCommand,
  parseBrowserUseModeCommand,
} from "@/lib/browser-intents";
import { useBrowserController } from "@/lib/use-browser-controller";
import { CyberdeckCustomTabBrowserSync } from "@/components/cyberdeck/cyberdeck-custom-tab-browser-sync";
import { CyberdeckWebTabFrame } from "@/components/cyberdeck/cyberdeck-web-tab-frame";
import { RegistryShowroom } from "@/app/registry/registry-showroom";
import { RegistryKitScrollFrame } from "@/app/registry/registry-kit-scroll-frame";
import { useRailTabLongPress } from "@/lib/use-rail-tab-long-press";
import { splitIntoSpeechBlocks } from "@/lib/muthur-voice-blocks";
import type { CanonicalTarget } from "@/lib/computer-use/ui-alias-registry";
import {
  loadComputerUse,
  messageMayUseComputerUse,
} from "@/features/cyberdeck/runtime/defer-computer-use";
import {
  bindDeckKeyboardSfx,
  loadDeckAudio,
  playDeckBleepBloop,
  playDeckDeclined,
  playDeckDroidDizzy400,
  playDeckDroidDizzy401,
  playDeckOutOfGas429,
  playDeckRaceReadySetGo,
  playDeckWrongDoorShut,
  playDeckNavigationSound,
  playDeckSystemSound,
  startDeckSonarLoop,
  stopDeckSonarLoop,
  unlockDeckKeyboardSfx,
} from "@/features/cyberdeck/runtime/defer-deck-audio";
import { copyTextToClipboard } from "@/lib/grok-image-prompt";
import {
  applyOperatorTextAutodetect,
  createBlankOperatorDocument,
  isOperatorDocumentSurfaceKind,
  normalizeOperatorDocumentKind,
  operatorMimeTypeForKind,
  resolveOperatorDocumentNameForKind,
  type OperatorDocumentPickerKind,
} from "@/lib/operator-document-types";
import { cleanOperatorPasteText } from "@/lib/operator-paste-cleaner";
import {
  normalizeMarkdownMechanical,
  operatorMarkdownWasHousekept,
} from "@/lib/operator-markdown-housekeeping";
import { parseConvertDocumentIntent } from "@/lib/muthur-document-conversion-intent";
import {
  parseExportMarkdownToDocxIntent,
  parseExportMarkdownToPdfIntent,
  docxFilenameFromMarkdownName,
  pdfFilenameFromMarkdownName,
  type OperatorExportFormat,
} from "@/lib/markdown-to-docx-intent";
import { parseGlyphResponseActions, resolveGlyphCommand, type GlyphApplyAction, type GlyphCommand } from "@/lib/muthur-glyph-intent";
import type { AsciiRenderRequest } from "@/lib/muthur-ascii-skill/types";
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
import {
  canNavigateOperatorFileBack,
  canNavigateOperatorFileForward,
  operatorFileHistoryBackIndex,
  operatorFileHistoryForwardIndex,
  pushOperatorFileHistory,
} from "@/lib/operator-file-history";
import {
  readFileFromFolderRoot,
  type OperatorDocFolderRoot,
} from "@/lib/operator-folder-nav";
import {
  buildOperatorSaveIntent,
  canSaveOperatorFileInPlace,
  downloadOperatorDoc,
  isPickerAbortError,
  saveOperatorFileInPlace,
  saveViaCadreApi,
  type OperatorSaveIntent,
} from "@/lib/operator-save";
import { get, set } from "idb-keyval";
import {
  CyberdeckPaneHeader,
  CyberdeckPaneHeaderSubtitle,
  CyberdeckPaneHeaderTitle,
  CyberdeckPaneHeaderValue,
} from "@/components/cyberdeck/pane-header";
import dynamic from "next/dynamic";
import { PanelLoader } from "@/features/cyberdeck/panel-loader";
import {
  CyberdeckControlTooltip,
  CyberdeckPaneTooltipProvider,
} from "@/components/cyberdeck/cyberdeck-pane-tooltip";
import { MiragePaneLayer } from "@/components/cyberdeck/mirage-pane-layer";
import { CyberdeckBootSequence } from "@/components/cyberdeck/boot-sequence";
import { EchoHeader } from "@/components/cyberdeck/echo-header";
import { MirageHeader } from "@/components/cyberdeck/mirage-header";
import { registerCyberdeckRailTab } from "@/components/cyberdeck/cyberdeck-rail-tab";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { loadDeckMode, saveDeckMode, type DeckMode } from "@/lib/deck-mode";
import { MORPHISM_ZONE_REALMORPHISM } from "@/lib/cyberdeck/morphism-zones";
import {
  LEGACY_COMPACT_AMBER,
  LEGACY_COMPACT_CONTROL,
  LEGACY_SEND_CONTROL,
  LEGACY_STOP_CONTROL,
  realmorphismActionClass,
  realmorphismControlClass,
  realmorphismMenuItemClass,
  voiceControlClass,
} from "@/lib/cyberdeck/realmorphism-control";
import { isMuted, playBeep, setMuted } from "@/lib/deck-audio";
import { loadWorkspaceState, saveWorkspaceState } from "@/lib/workspace-state";
import { useDebouncedEffect } from "@/lib/use-debounced-effect";
import { cn } from "@/lib/utils";
import { useCyberdeckTabStore, getCyberdeckSelectedRailTabId, type CyberdeckServerId } from "@/lib/cyberdeck-tab-store";
import { CyberdeckServerRail } from "@/components/cyberdeck/cyberdeck-server-rail";
import { CyberdeckTabPersistence } from "@/components/cyberdeck/cyberdeck-tab-persistence";
import {
  CyberdeckCustomTabPanes,
  CyberdeckFixedServerPane,
  CyberdeckGatewaySettingsPane,
} from "@/components/cyberdeck/cyberdeck-pane-slots";
import {
  MuthurCommandInput,
  type MuthurCommandInputHandle,
} from "@/components/cyberdeck/muthur-command-input";
import { emitSignal, useDeckSignal, type DeckSignal } from "@/lib/cyberdeck/signal-router";
import { useDeckAudioBridge } from "@/lib/cyberdeck/audio-bridge";
import { loadIdentityBundle } from "@/lib/identity/load-identity";
import type { Identity } from "@/lib/identity/identity-types";
import { loadOrchestrationBundle } from "@/lib/orchestration/load-orchestration";
import type { OrchestrationBundle } from "@/lib/orchestration/orchestration-types";
import { ENABLE_AUTOMATION, ENABLE_MODEL_PROBE } from "@/lib/cyberdeck/automation-config";
import {
  formatActionResultForChat,
  parseLegacyToolJson,
} from "@/lib/muthur/execution/parse-legacy-tool-json";
import { enqueueMuthurActions } from "@/lib/muthur/execution/use-muthur-execution-runtime";
import { formatUplinkErrorDetail } from "@/lib/cyberdeck/format-uplink-error";
import { publishMuthurObservation } from "@/lib/muthur/observation/publish-observation";
import { OBSERVE_TRANSCRIPT_PREFIX } from "@/components/muthur/observe-presence-glyph";
import {
  getMuthurHelpText,
  getMuthurHelpUnknownTopicText,
  parseMuthurClearChatIntent,
  parseMuthurHelpIntent,
} from "@/lib/muthur-help-text";
import {
  PROVIDER_CLICK_ESCALATION_MS,
  PROVIDER_LINK_REFRESH_COOLDOWN_MS,
  loadProviderModelsCache,
  providerModelsCacheKey,
  providerToneColors,
  resolveProviderVisualTone,
  saveProviderModelsCache,
  type ProviderModelRow,
} from "@/lib/cyberdeck/provider-connection";

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

const PROVIDER_IDS = ["opencode", "openrouter", "openai"] as const;
const DEFAULT_CLIENT_PROVIDER_KEYS: Record<string, string> = {
  opencode:
    (process.env.NEXT_PUBLIC_OPENCODE_API_KEY ||
      process.env.NEXT_PUBLIC_ZEN_API_KEY ||
      "").trim(),
  openrouter: (process.env.NEXT_PUBLIC_OPENROUTER_API_KEY || "").trim(),
  openai: (process.env.NEXT_PUBLIC_OPENAI_API_KEY || "").trim(),
};

const ENABLE_CARD_TABLE =
  process.env.NEXT_PUBLIC_ENABLE_CARD_TABLE === "true";

const DEFAULT_SERVER_ID = "s";

function safeServerId(id: string): string {
  if (id === "p") {
    return DEFAULT_SERVER_ID;
  }
  if (id === "ct" && !ENABLE_CARD_TABLE) {
    return DEFAULT_SERVER_ID;
  }
  return id;
}

const servers = [
  { id: "m", glyph: "Ø", label: "ØPERATOR" },
  { id: "w", glyph: "W", label: "WEB" },
  { id: "c", glyph: "C", label: "CONNECTION" },
  { id: "s", glyph: "μ", label: "MAINNET-UPLINK" },
  ...(ENABLE_CARD_TABLE ? [{ id: "ct", glyph: "◈", label: "CARD TABLE" }] : []),
  { id: "h", glyph: "π", label: "DIAGNOSTIC" },
  { id: "b", glyph: "§", label: "SETTINGS" },
] as const;

const SERVER_IDS = ENABLE_CARD_TABLE
  ? (["m", "s", "ct", "b"] as const)
  : (["m", "s", "b"] as const);

function isFixedServerTabId(id: string): id is (typeof SERVER_IDS)[number] {
  return (SERVER_IDS as readonly string[]).includes(id);
}

function contextMenuTargetIsTextField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return Boolean(target.closest("input, textarea, select"));
}

const fixedServers = [
  { id: "m", glyph: "Ø", label: "ØPERATOR" },
  { id: "s", glyph: "μ", label: "MAINNET-UPLINK" },
  ...(ENABLE_CARD_TABLE ? [{ id: "ct", glyph: "◈", label: "CARD TABLE" }] : []),
  { id: "b", glyph: "§", label: "SETTINGS" },
];

const HEAP_STORAGE_KEY = "echo-mirage-heap-items";
const CHAT_STORAGE_KEY = "echo-mirage-chat-messages-v1";
const CHAT_STREAM_STORAGE_KEY = "echo-mirage-chat-stream-text-v1";
const CHAT_UPLINK_TIMEOUT_MS = 120_000;
const MODEL_PROBE_MIN_INTERVAL_MS = 15_000;
const PROVIDER_RATE_LIMIT_COOLDOWN_MS = 90_000;
const INPUT_HISTORY_KEY = "echo-mirage-chat-history-v1";
const UI_STATE_STORAGE_KEY = "echo-mirage-ui-state-v1";

/** Cinematic sonar gain while the deck talks to providers (see AudioEngine `startDeckSonarLoop` scale). */
const CYBERDECK_SONAR_VOL_SCAN = 0.52;
const CYBERDECK_SONAR_VOL_CHAT_STREAM = 0.22;

type CyberdeckUiState = {
  server: (typeof SERVER_IDS)[number];
  navRailContext: "gateway" | "tabs";
  serverKeyboardHighlightId: (typeof SERVER_IDS)[number] | null;
  operatorSurfaceMode?: "workspace" | "browser";
  operatorBrowserUrl?: string;
  customTabs?: CustomTab[];
  activeCustomTabId?: string | null;
};

const CUSTOM_TAB_KINDS = [
  "blank",
  "document",
  "web",
  "settings",
  "connection",
  "pi",
  "diagnostics",
  "catalog",
  "operators",
  "memory-atlas",
  "voice-lab",
  "flight-log",
  "drop-bay",
  "glyph-channel",
  "rola-dex",
  "sound-profile",
  "realmorphism-kit",
  "catelog",
] as const;
type CustomTabKind = (typeof CUSTOM_TAB_KINDS)[number];

/** Gateway SYS lines; link phrases must match 
enderGatewayMessageText` splits. */
function gatewayKeySysMessage(providerId: string): string {
  if (providerId === "openai") {
    return "ENTER OPENAI KEY BELOW. create one by visiting Open AI console.";
  }
  if (providerId === "openrouter") {
    return "ENTER OPENROUTER KEY BELOW. create one by visiting OpenRouter console.";
  }
  if (providerId === "opencode") {
    return "ENTER OPENCODE KEY BELOW. create one by visiting OpenCode console.";
  }
  return `ENTER ${providerId.toUpperCase()} KEY BELOW.`;
}

const GATEWAY_KEY_SYS_TIPS = new Set(PROVIDER_IDS.map((id) => gatewayKeySysMessage(id)));

function isGatewayKeySysTip(text: string): boolean {
  return GATEWAY_KEY_SYS_TIPS.has(text.trim());
}

function providerHasClientKey(
  providerId: string,
  providerKeys: Record<string, string>,
  defaultKeyAvailableByProvider: Record<string, boolean>,
): boolean {
  return Boolean(
    providerKeys[providerId]?.trim() ||
      DEFAULT_CLIENT_PROVIDER_KEYS[providerId] ||
      defaultKeyAvailableByProvider[providerId],
  );
}

const GATEWAY_LINK_PARTS =
  /(Open AI console|OpenRouter console|OpenCode console)/g;

const GATEWAY_LINK_HREF: Record<string, string> = {
  "Open AI console": "https://platform.openai.com/settings/api-keys",
  "OpenRouter console": "https://openrouter.ai/workspaces/default/keys",
  "OpenCode console": "https://opencode.ai",
};

type DroppedOperatorAsset = {
  kind:
    | "css"
    | "html"
    | "javascript"
    | "json"
    | "markdown"
    | "pdf"
    | "python"
    | "text"
    | "typescript"
    | "code"
    | "image"
    | "video"
    | "file";
  name: string;
  mimeType: string;
  size: number;
  text?: string;
  imageSrc?: string;
};

type CustomTab = {
  id: string;
  label: string;
  glyph: string;
  kind: CustomTabKind;
  browserUrl?: string;
  asset?: DroppedOperatorAsset | null;
};

type CustomTabContextMenuAction =
  | { label: string; kind: CustomTabKind; action: "convert" }
  | { label: string; action: "settings-pane" | "connection-pane" | "kit-pane" };

const CUSTOM_TAB_CONTEXT_MENU_ACTIONS = ([
  { label: "Document", kind: "document", action: "convert" },
  { label: "Web", kind: "web", action: "convert" },
  { label: "Catalog", kind: "catalog", action: "convert" },
  { label: "Operators", kind: "operators", action: "convert" },
  { label: "Memory Atlas", kind: "memory-atlas", action: "convert" },
  { label: "Voice Lab", kind: "voice-lab", action: "convert" },
  { label: "Flight Log", kind: "flight-log", action: "convert" },
  { label: "Drop Bay", kind: "drop-bay", action: "convert" },
  { label: "Ascii", kind: "glyph-channel", action: "convert" },
  { label: "Kit", action: "kit-pane" },
  { label: "Rola Dex", kind: "rola-dex", action: "convert" },
  { label: "Sound Profile", kind: "sound-profile", action: "convert" },
  { label: "Diagnostics", kind: "diagnostics", action: "convert" },
  { label: "Pi", kind: "pi", action: "convert" },
  { label: "Settings", action: "settings-pane" },
  { label: "Connection", action: "connection-pane" },
] as CustomTabContextMenuAction[]).sort((a, b) =>
  a.label.localeCompare(b.label, undefined, { sensitivity: "base" }),
);

type CyberdeckChatHistoryMessage = {
  role: "user" | "assistant";
  content: string;
};

function isCustomTabKind(kind: unknown): kind is CustomTabKind {
  return typeof kind === "string" && normalizeCustomTabKind(kind) !== null;
}

function isRetiredCustomTabKind(kind: unknown): boolean {
  if (typeof kind !== "string") return false;
  const normalized = kind.trim().toLowerCase();
  return (
    normalized === "muthur-execution" ||
    normalized === "muthur_execution" ||
    normalized === "execution" ||
    normalized === "execution-pane"
  );
}

function sanitizeCustomTabs(value: unknown): CustomTab[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const tab = item as Partial<CustomTab>;
    if (isRetiredCustomTabKind(tab.kind)) return [];
    const id = typeof tab.id === "string" && tab.id.trim() ? tab.id.trim() : "";
    const label = typeof tab.label === "string" && tab.label.trim() ? tab.label.trim() : "TAB";
    const glyph = typeof tab.glyph === "string" && tab.glyph.trim() ? tab.glyph.trim() : "□";
    const kind = isCustomTabKind(tab.kind) ? tab.kind : "blank";
    const browserUrl = typeof tab.browserUrl === "string" && tab.browserUrl.trim() ? tab.browserUrl.trim() : undefined;
    const asset = tab.asset && typeof tab.asset === "object" ? (tab.asset as DroppedOperatorAsset) : null;

    if (!id) return [];
    return [
      {
        id,
        label,
        glyph,
        kind,
        browserUrl,
        asset,
      },
    ];
  });
}

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

const EDITABLE_TEXT_EXTENSIONS = [
  ".md",
  ".markdown",
  ".txt",
  ".json",
  ".jsonc",
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".mjs",
  ".cjs",
  ".css",
  ".html",
  ".htm",
  ".xml",
  ".yaml",
  ".yml",
  ".toml",
  ".ini",
  ".env",
  ".sh",
  ".bash",
  ".zsh",
  ".py",
  ".go",
  ".rs",
  ".java",
  ".c",
  ".cpp",
  ".h",
  ".hpp",
  ".sql",
  ".csv",
  ".tsv",
  ".log",
];

function isEditableOperatorFile(file: File) {
  const lowerName = file.name.toLowerCase();
  const lowerType = (file.type || "").toLowerCase();
  return (
    lowerType.startsWith("text/") ||
    lowerType === "application/json" ||
    lowerType === "application/xml" ||
    lowerType === "application/javascript" ||
    lowerType === "application/typescript" ||
    lowerType === "application/x-yaml" ||
    EDITABLE_TEXT_EXTENSIONS.some((ext) => lowerName.endsWith(ext))
  );
}

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

function getOperatorFileKind(file: File): DroppedOperatorAsset["kind"] {
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith(".md") || lowerName.endsWith(".markdown") || file.type === "text/markdown") {
    return "markdown";
  }
  if (
    lowerName.endsWith(".json") ||
    lowerName.endsWith(".jsonc") ||
    file.type === "application/json"
  ) {
    return "json";
  }
  if (isEditableOperatorFile(file)) {
    return "code";
  }
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  return "file";
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(typeof reader.result === "string" ? reader.result : "");
    };
    reader.onerror = () => {
      reject(reader.error || new Error("Failed to read file."));
    };
    reader.readAsDataURL(file);
  });
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

function renderGatewayMessageText(text: string) {
  const hasGatewayLink =
    typeof text === "string" &&
    (text.includes("Open AI console") ||
      text.includes("OpenRouter console") ||
      text.includes("OpenCode console"));
  if (hasGatewayLink) {
    const parts = text.split(GATEWAY_LINK_PARTS);
    return (
      <>
        {parts.map((part, idx) => {
          const href = GATEWAY_LINK_HREF[part];
          if (href) {
            return (
              <a
                key={idx}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sky-400 underline"
              >
                {part}
              </a>
            );
          }
          return <span key={idx}>{part}</span>;
        })}
      </>
    );
  }
  return text;
}

function textForSpeech(value: string) {
  const raw = typeof value === "string" ? value : "";
  if (!raw.trim()) return "";
  return raw
    .replace(/#/g, "")
    .replace(/[*\/\\]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCustomTabGlyph(label: string, glyph?: string) {
  const trimmedGlyph = (glyph || "").trim();
  if (trimmedGlyph) return trimmedGlyph.slice(0, 2);
  const trimmedLabel = label.trim();
  return trimmedLabel ? trimmedLabel[0].toUpperCase() : "□";
}

function normalizeCustomTabKind(kind: string) {
  const nextKind = kind.trim().toLowerCase();
  if (nextKind === "catelog") {
    return "catalog" as CustomTabKind;
  }
  if (nextKind === "catalog") {
    return "catalog" as CustomTabKind;
  }
  if (nextKind === "diagnostic") {
    return "diagnostics" as CustomTabKind;
  }
  if (nextKind === "memoryatlas" || nextKind === "memory_atlas") {
    return "memory-atlas" as CustomTabKind;
  }
  if (nextKind === "voicelab" || nextKind === "voice_lab") {
    return "voice-lab" as CustomTabKind;
  }
  if (nextKind === "flightlog" || nextKind === "flight_log") {
    return "flight-log" as CustomTabKind;
  }
  if (nextKind === "dropbay" || nextKind === "drop_bay") {
    return "drop-bay" as CustomTabKind;
  }
  if (
    nextKind === "glyph" ||
    nextKind === "glyph-channel" ||
    nextKind === "glyph_channel" ||
    nextKind === "glyphchannel"
  ) {
    return "glyph-channel" as CustomTabKind;
  }
  if (
    nextKind === "preview" ||
    nextKind === "rola-dex" ||
    nextKind === "rola_dex" ||
    nextKind === "roladex"
  ) {
    return "rola-dex" as CustomTabKind;
  }
  if (
    nextKind === "sound-profile" ||
    nextKind === "sound_profile" ||
    nextKind === "soundprofile"
  ) {
    return "sound-profile" as CustomTabKind;
  }
  if (
    nextKind === "realmorphism-kit" ||
    nextKind === "realmorphism_kit" ||
    nextKind === "realmorphismkit" ||
    nextKind === "realmorphism"
  ) {
    return "realmorphism-kit" as CustomTabKind;
  }
  if (CUSTOM_TAB_KINDS.includes(nextKind as CustomTabKind)) {
    return nextKind as CustomTabKind;
  }
  return null;
}

function buildCyberdeckChatHistory(messages: Array<{ role: string; text: string }>, limit = 8) {
  return messages
    .filter((message) => message.role === "user" || message.role === "assistant")
    .map((message) => ({
      role: message.role,
      content: message.text.trim(),
    }))
    .filter((message) => Boolean(message.content))
    .slice(-limit);
}

function defaultCustomTabGlyphForKind(kind: CustomTabKind) {
  if (kind === "web") return "W";
  if (kind === "document") return "D";
  if (kind === "settings") return "S";
  if (kind === "connection") return "C";
  if (kind === "catalog") return "K";
  if (kind === "operators") return "O";
  if (kind === "memory-atlas") return "M";
  if (kind === "voice-lab") return "V";
  if (kind === "flight-log") return "F";
  if (kind === "drop-bay") return "⬇";
  if (kind === "glyph-channel") return "⟁";
  if (kind === "rola-dex") return "▧";
  if (kind === "sound-profile") return "♪";
  if (kind === "pi" || kind === "diagnostics") return "π";
  return "□";
}

function defaultCustomTabLabelForKind(kind: CustomTabKind) {
  if (kind === "memory-atlas") return "MEMORY ATLAS";
  if (kind === "voice-lab") return "VOICE LAB";
  if (kind === "flight-log") return "FLIGHT LOG";
  if (kind === "drop-bay") return "DROP BAY";
  if (kind === "glyph-channel") return "⟁ GLYPH";
  if (kind === "rola-dex") return "Rola Dex";
  if (kind === "sound-profile") return "Sound Profile";
  return kind.toUpperCase();
}

function parseCustomTabCommand(input: string) {
  const text = input.trim();
  if (!text) return null;

  const clearMatch = text.match(/^(?:\/tab|tab:)?\s*(?:clear|reset)(?:\s+tab)?(?:\s+state)?$/i);
  if (clearMatch) {
    return {
      kind: "clear" as const,
    };
  }

  const createMatch = text.match(
    /^(?:\/tab|tab:)?\s*(?:(?:create|make|add)(?:\s+a)?(?:\s+new)?|new)\s+tab(?:\s+(?:named|called|as|with name)\s+(.+?))?(?:\s+glyph\s+(.+))?$/i,
  );
  if (createMatch) {
    const label = (createMatch[1] || "").trim();
    const glyph = (createMatch[2] || "").trim();
    return {
      kind: "create" as const,
      label: label || "NEW TAB",
      glyph: normalizeCustomTabGlyph(label || "NEW TAB", glyph),
    };
  }

  const renameMatch = text.match(
    /^(?:\/tab|tab:)?\s*(?:rename|name|label|set)\s+tab(?:\s+(?:to|as|with name)\s+)?(.+?)(?:\s+glyph\s+(.+))?$/i,
  );
  if (renameMatch) {
    const label = (renameMatch[1] || "").trim();
    const glyph = (renameMatch[2] || "").trim();
    if (!label) return null;
    return {
      kind: "rename" as const,
      label,
      glyph: normalizeCustomTabGlyph(label, glyph),
    };
  }

  const convertMatch = text.match(
    /^(?:\/tab|tab:)?\s*(?:(?:convert|turn|make|set)(?:\s+this)?(?:\s+tab)?(?:\s+(?:to|into|as)\s+)?|(?:set|make)\s+tab\s+(?:to|as)?\s+)(blank|document|web|settings|connection|pi|diagnostics|diagnostic|catelog|catalog|operators|memory-atlas|voice-lab|flight-log|drop-bay|dropbay|glyph-channel|glyph|rola-dex|preview|roladex|sound-profile|soundprofile)(?:\s+tab)?(?:\s+(?:named|called)\s+(.+?))?(?:\s+glyph\s+(.+))?$/i,
  );
  if (convertMatch) {
    const surfaceKind = normalizeCustomTabKind(convertMatch[1] || "");
    if (!surfaceKind) return null;
    const label = (convertMatch[2] || "").trim();
    const glyph = (convertMatch[3] || "").trim();
    return {
      kind: "convert" as const,
      surfaceKind,
      label: label || undefined,
      glyph: glyph || undefined,
    };
  }

  return null;
}

export default function CyberdeckApp() {
  type ChatMessage = { role: string; text: string; toolTrace?: string };
  // Start on the operator tab; disconnected users are redirected to MAINNET-UPLINK after hydration.
  // Tab rail + pane visibility: zustand store (page must not subscribe).
  useEffect(() => {
    registerCyberdeckRailTab();
  }, []);


  const [inputHistory, setInputHistory] = useState<string[]>([]);
  const [canSendInput, setCanSendInput] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatHydrated, setChatHydrated] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [streamToolTrace, setStreamToolTrace] = useState("");
  const [generatedUI, setGeneratedUI] = useState<string | null>(null);
  const [droppedMarkdown, setDroppedMarkdown] = useState<string | null>(null);
  const [droppedMarkdownName, setDroppedMarkdownName] = useState<string>("");
  const [operatorDroppedAsset, setOperatorDroppedAsset] = useState<DroppedOperatorAsset | null>(() =>
    createBlankOperatorDocument(),
  );
  const [operatorSurfaceMode, setOperatorSurfaceMode] = useState<"workspace" | "browser">("workspace");
  const [operatorBrowserEngine, setOperatorBrowserEngine] = useState("UNKNOWN");
  const [operatorDocMode, setOperatorDocMode] = useState<"view" | "edit">("edit");
  const [operatorDocNameDraft, setOperatorDocNameDraft] = useState(
    () => createBlankOperatorDocument().name,
  );
  const [operatorFileHistory, setOperatorFileHistory] = useState<string[]>([]);
  const [operatorFileHistoryIndex, setOperatorFileHistoryIndex] = useState(-1);
  const [operatorActiveFilePath, setOperatorActiveFilePath] = useState<string | null>(null);
  const [glyphModeActive, setGlyphModeActive] = useState(false);
  const operatorFileHistoryRef = useRef<string[]>([]);
  const operatorFileHistoryIndexRef = useRef(-1);
  const operatorFolderRootsRef = useRef<OperatorDocFolderRoot[]>([]);
  const [operatorFolderRootsCount, setOperatorFolderRootsCount] = useState(0);
  const operatorFileHistoryLoadersRef = useRef<Map<string, () => Promise<void>>>(new Map());
  const [operatorBrowserUrl, setOperatorBrowserUrl] = useState(OPERATOR_BROWSER_HOME_URL);
  const [operatorBrowserSnapshot, setOperatorBrowserSnapshot] = useState("");
  const [isMarkdownDragOver, setIsMarkdownDragOver] = useState(false);
  const [isOperatorDragOver, setIsOperatorDragOver] = useState(false);
  const [railTabContextMenu, setRailTabContextMenu] = useState<
    | { variant: "custom"; tabId: string; x: number; y: number }
    | { variant: "fixed"; serverId: (typeof SERVER_IDS)[number]; x: number; y: number }
    | null
  >(null);

  const [showCardTablePane, setShowCardTablePane] = useState(false);
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  /** Right-click menu for the main chat / Echo Mirage pane (viewport-clamped like rail tabs). */
  const [mirageContextMenu, setMirageContextMenu] = useState<{ x: number; y: number } | null>(null);
  /** Right-click menu for gateway column surfaces (settings, operator, connection, custom tabs). */
  const [gatewayPaneContextMenu, setGatewayPaneContextMenu] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [isMobileLayout, setIsMobileLayout] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(max-width: 768px)").matches;
  });
  const [chatKeyboardHighlightIndex, setChatKeyboardHighlightIndex] = useState<number | null>(null);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [voicePlaybackBusy, setVoicePlaybackBusy] = useState(false);
  const [voiceBlockFocusIndex, setVoiceBlockFocusIndex] = useState(0);
  const [voiceBlockTotal, setVoiceBlockTotal] = useState(0);
  const [voiceDial, setVoiceDial] = useState<MuthurVoiceDialState>(getInitialMuthurVoiceDials);
  const [voiceHealth, setVoiceHealth] = useState<"idle" | "backend" | "fallback" | "off">("idle");
  const [muthurMemory, setMuthurMemory] = useState<MuthurMemoryState>(() => createEmptyMuthurMemory());
  const [muthurMemoryHydrated, setMuthurMemoryHydrated] = useState(false);
  const [muthurMemoryLoadError, setMuthurMemoryLoadError] = useState<string | null>(null);
  const [heapEntries, setHeapEntries] = useState<HeapEntry[]>([]);
  const [heapNameDraft, setHeapNameDraft] = useState("");
  const [heapTextDraft, setHeapTextDraft] = useState("");
  const [heapHydrated, setHeapHydrated] = useState(false);
  const [deckMode, setDeckMode] = useState<DeckMode>("realmorphism");
  const [audioMuted, setAudioMutedState] = useState<boolean>(() => isMuted());
  const [workspaceHydrated, setWorkspaceHydrated] = useState(false);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [orchestration, setOrchestration] = useState<OrchestrationBundle | null>(null);

  const [activeProvider, setActiveProvider] = useState<string>("opencode");
  /** Keyboard focus ring for provider list; Enter commits to `activeProvider`. */
  const [providerKeyboardHighlightId, setProviderKeyboardHighlightId] = useState<string | null>(null);
  /** Escape from gateway → tab rail; Escape from tab rail → gateway. Arrows move highlight while on rail. */
  const [navRailContext, setNavRailContext] = useState<"gateway" | "tabs">("gateway");
  const [serverKeyboardHighlightId, setServerKeyboardHighlightId] = useState<(typeof SERVER_IDS)[number] | null>(null);
  /** Gateway column: keyboard highlight on model rows (arrows move providers + models as one column). */
  const [modelKeyboardHighlightId, setModelKeyboardHighlightId] = useState<string | null>(null);
  const [providerKeys, setProviderKeys] = useState<Record<string, string>>({});
  const [didHydrateProviderState, setDidHydrateProviderState] = useState(false);
  const [defaultKeyAvailableByProvider, setDefaultKeyAvailableByProvider] = useState<Record<string, boolean>>({
    opencode: false,
    openrouter: false,
    openai: false,
  });
  const [modelList, setModelList] = useState<{ id: string }[]>([]);
  const [modelCacheByProvider, setModelCacheByProvider] = useState<Record<string, ProviderModelRow[]>>({});
  const [credentialReplaceProvider, setCredentialReplaceProvider] = useState<string | null>(null);
  const [gatewayKeyDraft, setGatewayKeyDraft] = useState("");
  const [deckUiHydrated, setDeckUiHydrated] = useState(false);
  const [modelByProvider, setModelByProvider] = useState<Record<string, string>>({});
  const [modelFetchStatusByProvider, setModelFetchStatusByProvider] = useState<
    Record<string, "idle" | "retrieving" | "invalid-key" | "error" | "ready">
  >(() => ({
    opencode: "idle",
    openrouter: "idle",
    openai: "idle",
  }));
  const [rateLimitedProviders, setRateLimitedProviders] = useState<Set<string>>(new Set());
  const [modelHealthByProvider, setModelHealthByProvider] = useState<
    Record<string, Record<string, string>>
  >({ opencode: {}, openrouter: {}, openai: {} });
  const [verifiedProviders, setVerifiedProviders] = useState<Record<string, boolean>>({
    opencode: false,
    openrouter: false,
    openai: false,
  });
  const [probeInFlightByProvider, setProbeInFlightByProvider] = useState<Record<string, string>>({
    opencode: "",
    openrouter: "",
    openai: "",
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<MuthurCommandInputHandle>(null);
  const messageScrollRef = useRef<HTMLDivElement>(null);
  const serverRailRef = useRef<HTMLElement | null>(null);
  const chatColumnRef = useRef<HTMLDivElement>(null);
  const gatewayColumnRef = useRef<HTMLDivElement>(null);
  const gatewayConnectionPanelRef = useRef<HTMLDivElement>(null);
  const gatewayBlankSettingsRef = useRef<HTMLDivElement>(null);
  const cyberdeckRootRef = useRef<HTMLDivElement>(null);
  const chatAbortRef = useRef<AbortController | null>(null);
  const modelProbeAbortRef = useRef<AbortController | null>(null);
  const modelProbeCacheRef = useRef<Record<string, { status: string; at: number }>>({});
  const modelProbeLastAtRef = useRef<Record<string, number>>({});
  const providerRateLimitUntilRef = useRef<Record<string, number>>({});
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
  const operatorEditorRef = useRef<HTMLTextAreaElement | null>(null);
  const operatorKindManualRef = useRef(false);
  const operatorBrowserRef = useRef<HTMLWebViewElement | null>(null);
  const operatorNameInputRef = useRef<HTMLInputElement | null>(null);
  const networkFeedbackDelayRef = useRef<number | null>(null);
  const networkFeedbackRepeatRef = useRef<number | null>(null);
  const chatSonarDelayRef = useRef<number | null>(null);
  const chatSonarActiveRef = useRef(false);
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
  /** Forward Tab from message box cycles: gateway (right) → rail (left) → chat log (col2) → … */
  const deckTabNextRef = useRef<"gateway" | "rail" | "chatlog">("gateway");
  const prevNavRailRef = useRef<"gateway" | "tabs">("gateway");
  const uiFocusRestoredRef = useRef(false);
  const providerClickTrackerRef = useRef({ providerId: "", count: 0, lastClickAt: 0 });
  const providerRefreshAtRef = useRef<Record<string, number>>({});
  const providerBootstrapRef = useRef(false);

  const handleCanSendInputChange = useCallback((canSend: boolean) => {
    setCanSendInput((prev) => (prev === canSend ? prev : canSend));
  }, []);

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
    (btn: (typeof servers)[number]) => {
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
    async (actions: GlyphApplyAction[]) => {
      for (const action of actions) {
        if (action.kind === "set") {
          await setRawGlyphChannelText(action.text, action.merge ?? "replace");
          continue;
        }
        if (action.kind === "ascii-skill") {
          await renderAsciiSkillToChannel(action.request);
          continue;
        }
        await renderGlyphToChannel({
          engine: action.engine,
          text: action.text,
          font: action.font,
          merge: action.merge,
          decorate: action.decorate,
        });
      }
    },
    [renderAsciiSkillToChannel, renderGlyphToChannel, setRawGlyphChannelText],
  );

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

  const providers = [
    { id: "opencode" as const, name: "OPENCODE" },
    { id: "openrouter" as const, name: "OPENROUTER" },
    { id: "openai" as const, name: "OPENAI" },
  ] as const;
  const modelID = modelByProvider[activeProvider] || "";
  const providerModelFetchStatus = modelFetchStatusByProvider[activeProvider] || "idle";
  const scanActivityActive =
    Boolean(probeInFlightByProvider[activeProvider]) || providerModelFetchStatus === "retrieving";
  const networkActivityActive =
    Boolean(probeInFlightByProvider[activeProvider]) ||
    providerModelFetchStatus === "retrieving" ||
    isStreaming;
  const hasProviderAuth = providerHasClientKey(
    activeProvider,
    providerKeys,
    defaultKeyAvailableByProvider,
  );
  const providerLinkReady = providerModelFetchStatus === "ready";
  const isConnected = hasProviderAuth && providerLinkReady && Boolean(modelID);
  const connectionState: "offline" | "connecting" | "connected" = scanActivityActive
    ? "connecting"
      : isConnected
        ? "connected"
        : "offline";
  const inactiveTextColor = "#7a7a7a";
  const inactiveSubtleTextColor = "#6a6a6a";
  const activeTextGlow = "0 0 8px rgba(0, 255, 0, 0.22)";
  const amberTextGlow = "0 0 8px rgba(255, 170, 0, 0.22)";
  const inactiveTextGlow = "0 0 6px rgba(180, 180, 180, 0.14)";

  useDeckAudioBridge();

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

  const toggleDeckMode = useCallback(() => {
    setDeckMode((prev) => {
      const next = prev === "ascii" ? "realmorphism" : "ascii";
      emitSignal({
        source: "system",
        type: "mode_changed",
        payload: { mode: next === "ascii" ? "ASCII" : "REALMORPHISM" },
        severity: "info",
      });
      return next;
    });
  }, []);

  const toggleAudioMuted = useCallback(() => {
    const nextMuted = !audioMuted;
    setMuted(nextMuted);
    setAudioMutedState(nextMuted);
    if (!nextMuted) {
      playBeep();
    }
    emitSignal({
      source: "audio",
      type: "setting_changed",
      payload: { key: "muted", value: nextMuted },
      severity: "info",
    });
  }, [audioMuted]);

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

  const synthesizeMirageChunk = useCallback(async (text: string, voiceTuning: MuthurVoiceDialState) => {
    const res = await fetch("/api/cyberdeck-voice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        voiceTuning,
        apiKey: providerKeys.openai || "",
      }),
    });

    const contentType = res.headers.get("content-type") || "";
    const isAudio = contentType.startsWith("audio/");
    const isJson = contentType.includes("application/json");

    if (isAudio) {
      lastVoiceErrorRef.current = "";
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
      const voices = synth.getVoices();
      const preferred = voices.find((voice) => {
        const name = voice.name.toLowerCase();
        if (wantsMuthur) {
          return (
            name.includes("zira") ||
            name.includes("aria") ||
            name.includes("susan") ||
            name.includes("sonia") ||
            name.includes("female")
          );
        }
        return name.includes("jenny");
      });

      if (wantsMuthur && !preferred) {
        return false;
      }

      if (preferred) {
        utterance.voice = preferred;
      }
      utterance.lang = preferred?.lang || "en-US";
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
      const result = await synthesizeMirageChunk(text, currentVoiceDial);
      if (speakId !== speakSequenceRef.current) return false;
      if (result.kind === "audio") {
        setVoiceHealth("backend");
        await playMirageBuffer(result.audio);
        if (speakId !== speakSequenceRef.current) return false;
        return true;
      }
      setVoiceHealth("fallback");
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
    setDeckMode(loadDeckMode());
  }, []);

  useEffect(() => {
    saveDeckMode(deckMode);
  }, [deckMode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const warmPanes = () => {
      void import("@/features/cyberdeck/pane-chunks").then((mod) => {
        for (const kind of mod.PREFETCH_PANE_KINDS) {
          mod.prefetchCyberdeckPane(kind);
        }
      });
    };
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(warmPanes, { timeout: 8000 });
      return () => window.cancelIdleCallback(id);
    }
    const timer = window.setTimeout(warmPanes, 2000);
    return () => window.clearTimeout(timer);
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
    try {
      const stored = window.localStorage.getItem(CHAT_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as unknown;
        if (Array.isArray(parsed)) {
          const restored = parsed
            .filter((item): item is ChatMessage => {
              if (!item || typeof item !== "object") return false;
              const candidate = item as Partial<ChatMessage>;
              return typeof candidate.role === "string" && typeof candidate.text === "string";
            })
            .map((item) => ({
              role: item.role,
              text: item.text,
              ...(typeof item.toolTrace === "string" && item.toolTrace.trim()
                ? { toolTrace: item.toolTrace.trim() }
                : {}),
            }));
          setMessages(restored);
        }
      }
      const storedStreamText = window.localStorage.getItem(CHAT_STREAM_STORAGE_KEY);
      if (typeof storedStreamText === "string") {
        setStreamText(storedStreamText);
      }
      const storedHistory = window.localStorage.getItem(INPUT_HISTORY_KEY);
      if (storedHistory) {
        try {
          const parsed = JSON.parse(storedHistory);
          if (Array.isArray(parsed) && parsed.every((item) => typeof item === "string")) {
            setInputHistory(parsed);
          }
        } catch { /* ignore */ }
      }
    } catch {
      /* ignore chat restore errors */
    } finally {
      setChatHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!chatHydrated) return;
    try {
      window.localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
    } catch {
      /* ignore */
    }
  }, [messages, chatHydrated]);

  useEffect(() => {
    if (!chatHydrated) return;
    try {
      window.localStorage.setItem(CHAT_STREAM_STORAGE_KEY, streamText);
    } catch {
      /* ignore */
    }
  }, [streamText, chatHydrated]);

  useEffect(() => {
    if (!chatHydrated) return;
    if (inputHistory.length === 0) {
      try {
        window.localStorage.removeItem(INPUT_HISTORY_KEY);
      } catch { /* ignore */ }
      return;
    }
    try {
      window.localStorage.setItem(INPUT_HISTORY_KEY, JSON.stringify(inputHistory.slice(-50)));
    } catch {
      /* ignore */
    }
  }, [inputHistory, chatHydrated]);

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
        if (parsed?.operatorSurfaceMode === "workspace" || parsed?.operatorSurfaceMode === "browser") {
          setOperatorSurfaceMode(parsed.operatorSurfaceMode);
          restored = true;
        }
        if (typeof parsed?.operatorBrowserUrl === "string" && parsed.operatorBrowserUrl.trim()) {
          setOperatorBrowserUrl(parsed.operatorBrowserUrl);
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
    const id = window.requestAnimationFrame(() => {
      if (navRailContext === "tabs") {
        serverRailRef.current?.focus({ preventScroll: true });
      } else {
        gatewayColumnRef.current?.focus({ preventScroll: true });
      }
      uiFocusRestoredRef.current = true;
    });
    return () => window.cancelAnimationFrame(id);
  }, [deckUiHydrated, navRailContext]);

  const operatorSurfaceIsDocument = isOperatorDocumentSurfaceKind(operatorDroppedAsset?.kind);

  const { captureOperatorBrowserSnapshot, openOperatorBrowser, performBrowserCommand } = useBrowserController({
    operatorBrowserRef,
    operatorBrowserUrl,
    setOperatorBrowserUrl,
    setOperatorSurfaceMode,
    setServer: (next) => useCyberdeckTabStore.getState().setServer(next),
    setOperatorBrowserSnapshot,
  });

  const publishOperatorObservation = useCallback(() => {
    if (!deckUiHydrated) return;
    const { server, customTabs, activeCustomTabId } = useCyberdeckTabStore.getState();
    const activeCustomTab = customTabs.find((tab) => tab.id === activeCustomTabId) ?? null;
    const visibleAsset = activeCustomTab?.asset ?? (operatorSurfaceMode === "workspace" ? operatorDroppedAsset : null);
    void publishMuthurObservation({
      route: "/cyberdeck",
      surface: "cyberdeck",
      observing: true,
      observingPanelId: activeCustomTab?.id ?? server,
      observingSubsystem: activeCustomTab?.kind ?? server,
      activeTab: activeCustomTab?.label ?? server,
      activePane: activeCustomTab?.kind ?? server,
      visibleDocument: visibleAsset?.name ?? null,
      documentExcerpt: typeof visibleAsset?.text === "string" ? visibleAsset.text.slice(0, 800) : null,
      selectedProperty: null,
      selectedUnit: null,
      visibleLogs: messages.slice(-6).map((message) => `${message.role.toUpperCase()} // ${message.text.slice(0, 300)}`),
      activeTickets: [],
      operationalMode: "OBSERVE",
      transcriptState: isStreaming ? "STREAMING" : "STANDBY",
      operationalWarnings: [],
      continuityIndicators: [
        `SURFACE // ${operatorSurfaceMode.toUpperCase()}`,
        `DOCUMENT // ${operatorDocMode.toUpperCase()}`,
        ...(operatorActiveFilePath ? [`PATH // ${operatorActiveFilePath}`] : []),
        ...(operatorSurfaceMode === "browser" ? [`URL // ${operatorBrowserUrl}`] : []),
      ],
    });
  }, [
    deckUiHydrated,
    isStreaming,
    messages,
    operatorActiveFilePath,
    operatorBrowserUrl,
    operatorDocMode,
    operatorDroppedAsset,
    operatorSurfaceMode,
  ]);

  useEffect(() => {
    publishOperatorObservation();
    return useCyberdeckTabStore.subscribe(() => publishOperatorObservation());
  }, [publishOperatorObservation]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setOperatorBrowserEngine(window.echoMirageBrowser ? "PLAYWRIGHT" : "WEBVIEW_DOM_FALLBACK");
  }, []);

  const setOperatorTextAsset = useCallback((asset: DroppedOperatorAsset) => {
    let prepared = asset;
    if (asset.text) {
      const cleanedText = cleanOperatorPasteText(asset.text);
      if (cleanedText !== asset.text) {
        prepared = {
          ...asset,
          text: cleanedText,
          size: new Blob([cleanedText]).size,
        };
      }
    }
    let next = operatorKindManualRef.current ? prepared : applyOperatorTextAutodetect(prepared);
    if (next.text && normalizeOperatorDocumentKind(next.kind) === "markdown") {
      const housekept = normalizeMarkdownMechanical(next.text);
      if (housekept !== next.text) {
        next = {
          ...next,
          text: housekept,
          size: new Blob([housekept]).size,
        };
      }
    }
    setOperatorDroppedAsset(next);
    setOperatorDocNameDraft(next.name || "");
    return operatorMarkdownWasHousekept(asset.text || "", next.text || "");
  }, []);

  const openOperatorFile = useCallback(
    async (filePath: string, load: () => Promise<void>, fromHistory = false) => {
      operatorFileHistoryLoadersRef.current.set(filePath, () => openOperatorFile(filePath, load, true));

      if (!fromHistory && filePath !== operatorActiveFilePath) {
        const pushed = pushOperatorFileHistory(
          operatorFileHistoryRef.current,
          operatorFileHistoryIndexRef.current,
          filePath,
          operatorActiveFilePath,
        );
        if (pushed) {
          operatorFileHistoryRef.current = pushed.history;
          operatorFileHistoryIndexRef.current = pushed.historyIndex;
          setOperatorFileHistory(pushed.history);
          setOperatorFileHistoryIndex(pushed.historyIndex);
        }
      }

      setOperatorActiveFilePath(filePath);
      await load();
    },
    [operatorActiveFilePath],
  );

  const navigateOperatorFileHistory = useCallback(
    (direction: "back" | "forward") => {
      const history = operatorFileHistoryRef.current;
      const idx = operatorFileHistoryIndexRef.current;
      const nextIdx =
        direction === "back"
          ? operatorFileHistoryBackIndex(idx)
          : operatorFileHistoryForwardIndex(history, idx);
      if (nextIdx === null) return;

      const path = history[nextIdx];
      if (!path) return;

      operatorFileHistoryIndexRef.current = nextIdx;
      setOperatorFileHistoryIndex(nextIdx);
      setOperatorActiveFilePath(path);

      const loader = operatorFileHistoryLoadersRef.current.get(path);
      if (loader) void loader();
    },
    [],
  );

  const openConvertedMarkdownInOperator = useCallback(
    async (filePath: string) => {
      setMessages((prev) => [
        ...prev,
        { role: "system", text: `MUTHUR_CONVERT // ${filePath}` },
      ]);
      try {
        const res = await fetch("/api/convert-document-to-markdown", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filePath }),
        });
        const payload = (await res.json()) as {
          ok?: boolean;
          markdown?: string;
          outputPath?: string;
          sourcePath?: string;
          error?: string;
        };

        if (!res.ok || !payload.ok) {
          throw new Error(payload.error || `Conversion failed (${res.status})`);
        }

        if (!payload.markdown) {
          throw new Error("Conversion completed but returned no markdown.");
        }

        const markdown = payload.markdown;

        const outputName =
          payload.outputPath?.split(/[/\\]/).pop() ||
          filePath.replace(/\.(pdf|docx)$/i, ".md").split(/[/\\]/).pop() ||
          "converted.md";
        const convertHistoryPath = `convert://${filePath}`;
        await openOperatorFile(convertHistoryPath, async () => {
          operatorKindManualRef.current = false;
          setOperatorTextAsset({
            kind: "markdown",
            name: outputName,
            mimeType: "text/markdown",
            size: new Blob([markdown]).size,
            text: markdown,
          });
          useCyberdeckTabStore.getState().setServer("m");
          setNavRailContext("gateway");
          setOperatorSurfaceMode("workspace");
          setOperatorDocMode("view");
        });
        toast.success(`Converted ${filePath} → markdown in operator.`);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            text: `Converted **${filePath}** to markdown.\n\nOutput: \`${payload.outputPath || outputName}\`\n\nOpened in OperatorMarkdownViewer as \`text/markdown\`.`,
          },
        ]);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Document conversion failed.";
        toast.error(message);
        setMessages((prev) => [
          ...prev,
          { role: "system", text: `MUTHUR_CONVERT // FAILED // ${message}` },
        ]);
      }
    },
    [openOperatorFile, setOperatorTextAsset],
  );

  const handleOperatorDocumentKindChange = useCallback((nextKind: OperatorDocumentPickerKind) => {
    operatorKindManualRef.current = true;
    setOperatorDroppedAsset((prev) => {
      if (!prev) return prev;
      const name = resolveOperatorDocumentNameForKind(nextKind, prev.text || "", prev.name);
      return {
        ...prev,
        kind: nextKind,
        mimeType: operatorMimeTypeForKind(nextKind),
        name,
      };
    });
  }, []);

  useEffect(() => {
    if (!operatorDroppedAsset) return;
    if (document.activeElement === operatorNameInputRef.current) return;
    setOperatorDocNameDraft(operatorDroppedAsset.name);
  }, [operatorDroppedAsset?.kind, operatorDroppedAsset?.name]);

  const handleOperatorDocumentTextChange = useCallback((nextText: string) => {
    setOperatorDroppedAsset((prev) => {
      if (!prev) return prev;
      const name =
        prev.kind === "markdown"
          ? resolveOperatorDocumentNameForKind("markdown", nextText, prev.name)
          : prev.name;
      return {
        ...prev,
        text: nextText,
        name,
        size: new Blob([nextText]).size,
      };
    });
  }, []);

  useLayoutEffect(() => {
    if (!operatorSurfaceIsDocument || operatorDocMode !== "edit") return;
    const el = operatorEditorRef.current;
    if (!el) return;
    el.style.height = "auto";
    const minHeight = Math.max(el.scrollHeight, el.clientHeight);
    el.style.height = `${minHeight}px`;
  }, [operatorDocMode, operatorDroppedAsset?.text, operatorSurfaceIsDocument]);

  useEffect(() => {
    if (!operatorSurfaceIsDocument || operatorDocMode !== "edit") return;
    operatorNameInputRef.current?.focus({ preventScroll: true });
    operatorNameInputRef.current?.select();
  }, [operatorDocMode, operatorSurfaceIsDocument]);

  const commitOperatorDocName = useCallback(() => {
    if (!operatorDroppedAsset) return;
    const nextName = operatorDocNameDraft.trim();
    if (!nextName) {
      setOperatorDocNameDraft(operatorDroppedAsset.name);
      return;
    }
    if (nextName === operatorDroppedAsset.name) return;
    setOperatorDroppedAsset((prev) => (prev ? { ...prev, name: nextName } : prev));
    setOperatorDocNameDraft(nextName);
  }, [operatorDocNameDraft, operatorDroppedAsset]);

  const clearOperatorDocument = useCallback(() => {
    operatorKindManualRef.current = false;
    setOperatorActiveFilePath(null);
    operatorFileHistoryRef.current = [];
    operatorFileHistoryIndexRef.current = -1;
    operatorFileHistoryLoadersRef.current.clear();
    setOperatorFileHistory([]);
    setOperatorFileHistoryIndex(-1);
    setOperatorTextAsset({
      kind: "text",
      name: "",
      mimeType: "text/plain",
      size: 0,
      text: "",
    });
    setOperatorDocNameDraft("");
    setOperatorDocMode("view");
  }, [setOperatorTextAsset]);

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

  const copyOperatorDocToClipboard = useCallback(async () => {
    const text = operatorDroppedAsset?.text || "";
    if (!operatorSurfaceIsDocument || !text.trim()) {
      toast.error("Operator document has no text.");
      return;
    }

    try {
      await copyTextToClipboard(text);
      toast.success(`Copied "${operatorDroppedAsset?.name || "Operator document"}" to clipboard.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not copy operator document.");
    }
  }, [operatorDroppedAsset?.name, operatorDroppedAsset?.text, operatorSurfaceIsDocument]);

  const completeOperatorSave = useCallback(
    async (
      intent: OperatorSaveIntent,
      options: {
        pickerPromise?: Promise<SaveFilePickerHandle> | null;
      },
    ) => {
      const electronSave = (window as Window & { echoMirageSave?: EchoMirageSaveApi }).echoMirageSave;
      const pickerFn = (window as Window & {
        showSaveFilePicker?: (options?: SaveFilePickerOptions) => Promise<SaveFilePickerHandle>;
      }).showSaveFilePicker;

      const writePickerResult = async (pickerPromise: Promise<SaveFilePickerHandle>) => {
        const handle = await pickerPromise;
        const writable = await handle.createWritable();
        await writable.write(intent.text);
        await writable.close();
        toast.success(
          intent.cadreTarget?.constitutionalPrefix
            ? `Saved ${intent.suggestedFilename} (Cadre folder: ${intent.cadreTarget.relativeDirectory})`
            : `Saved "${intent.suggestedFilename}".`,
        );
      };

      try {
        if (electronSave) {
          const result = await electronSave.showDialog({
            defaultRelativePath: intent.suggestedSavePath,
            content: intent.text,
          });
          if (!result.canceled && result.filePath) {
            toast.success(
              intent.cadreTarget?.constitutionalPrefix
                ? `Saved to Cadre route // ${intent.cadreTarget.relativeDirectory} // ${result.filePath}`
                : `Saved "${result.filePath}".`,
            );
            return;
          }
          if (result.canceled && !result.error) {
            toast.info("Save canceled.");
            return;
          }
          if (result.error) {
            toast.error(`Native save failed: ${result.error}`);
          }
        }

        if (await saveViaCadreApi(intent, false)) {
          toast.success(`Saved to ${intent.suggestedSavePath}`);
          return;
        }

        if (options.pickerPromise) {
          await writePickerResult(options.pickerPromise);
          return;
        }

        if (typeof pickerFn === "function") {
          await writePickerResult(
            pickerFn({
              suggestedName: intent.suggestedFilename,
              types: intent.fileTypes,
              excludeAcceptAllOption: false,
            }),
          );
          return;
        }

        downloadOperatorDoc(intent);
        toast.success(
          intent.cadreTarget?.constitutionalPrefix
            ? `Downloaded ${intent.suggestedFilename} (browser download — target ${intent.suggestedSavePath})`
            : `Downloaded "${intent.suggestedFilename}".`,
        );
      } catch (err) {
        if (isPickerAbortError(err)) {
          toast.info("Save canceled.");
          return;
        }
        try {
          if (await saveViaCadreApi(intent, true)) {
            toast.success(`Saved to ${intent.suggestedSavePath}`);
            return;
          }
        } catch (apiErr) {
          toast.error(apiErr instanceof Error ? apiErr.message : "Cadre save failed");
          return;
        }
        downloadOperatorDoc(intent);
        toast.info(`Saved via download as ${intent.suggestedFilename}`);
      }
    },
    [],
  );

  const saveOperatorDocAsFile = useCallback(() => {
    const text = operatorDroppedAsset?.text || "";
    if (!operatorSurfaceIsDocument || !text.trim()) {
      toast.error("Operator document has no text.");
      return;
    }

    const intent = buildOperatorSaveIntent({
      text,
      kind: operatorDroppedAsset?.kind,
      mimeType: operatorDroppedAsset?.mimeType || "text/plain",
      currentName: operatorDroppedAsset?.name,
      headerName: operatorDocNameDraft,
      sourceFilePath: operatorActiveFilePath,
    });

    const electronSave = (window as Window & { echoMirageSave?: EchoMirageSaveApi }).echoMirageSave;
    const pickerFn = (window as Window & {
      showSaveFilePicker?: (options?: SaveFilePickerOptions) => Promise<SaveFilePickerHandle>;
    }).showSaveFilePicker;

    let pickerPromise: Promise<SaveFilePickerHandle> | null = null;
    if (!electronSave && typeof pickerFn === "function") {
      try {
        pickerPromise = pickerFn({
          suggestedName: intent.suggestedFilename,
          types: intent.fileTypes,
          excludeAcceptAllOption: false,
        });
      } catch (pickerErr) {
        void completeOperatorSave(intent, { pickerPromise: null }).catch((err) => {
          toast.error(err instanceof Error ? err.message : "Could not save operator document.");
        });
        return;
      }
    }

    void completeOperatorSave(intent, { pickerPromise }).catch((err) => {
      toast.error(err instanceof Error ? err.message : "Could not save operator document.");
    });
  }, [
    completeOperatorSave,
    operatorActiveFilePath,
    operatorDocNameDraft,
    operatorDroppedAsset?.kind,
    operatorDroppedAsset?.mimeType,
    operatorDroppedAsset?.name,
    operatorDroppedAsset?.text,
    operatorSurfaceIsDocument,
  ]);

  const saveOperatorDocInPlace = useCallback(async () => {
    const text = operatorDroppedAsset?.text || "";
    if (!operatorSurfaceIsDocument || !text.trim()) {
      toast.error("Operator document has no text.");
      return;
    }
    if (!operatorActiveFilePath) {
      toast.error("No open file to save.");
      return;
    }

    const result = await saveOperatorFileInPlace(
      operatorActiveFilePath,
      text,
      operatorFolderRootsRef.current,
    );
    if (!result.ok) {
      toast.error(result.error || "Could not save file.");
      return;
    }
    toast.success(`Saved "${operatorActiveFilePath.split("/").pop()}".`);
  }, [
    operatorActiveFilePath,
    operatorDroppedAsset?.text,
    operatorSurfaceIsDocument,
  ]);

  const saveOperatorDocument = useCallback(() => {
    if (
      canSaveOperatorFileInPlace(operatorActiveFilePath, operatorFolderRootsRef.current)
    ) {
      void saveOperatorDocInPlace();
      return;
    }
    saveOperatorDocAsFile();
  }, [operatorActiveFilePath, saveOperatorDocAsFile, saveOperatorDocInPlace]);

  const exportOperatorMarkdown = useCallback(async (format: OperatorExportFormat) => {
    const text = operatorDroppedAsset?.text || "";
    if (!operatorSurfaceIsDocument || !text.trim()) {
      toast.error("Operator document has no text.");
      return;
    }
    if (normalizeOperatorDocumentKind(operatorDroppedAsset?.kind) !== "markdown") {
      toast.error(`Export ${format.toUpperCase()} requires a markdown document.`);
      return;
    }

    const baseName = operatorDocNameDraft || operatorDroppedAsset?.name || "document.md";
    try {
      const { exportMarkdownToDocx, exportMarkdownToPdf } = await import(
        "@/lib/markdown-to-docx-export"
      );
      if (format === "docx") {
        const suggestedFilename = docxFilenameFromMarkdownName(baseName);
        const result = await exportMarkdownToDocx({ markdown: text, suggestedFilename });
        toast.success(
          result.outputPath
            ? `Exported DOCX to ${result.outputPath}`
            : `Exported "${result.filename}".`,
        );
      } else {
        const suggestedFilename = pdfFilenameFromMarkdownName(baseName);
        const result = await exportMarkdownToPdf({ markdown: text, suggestedFilename });
        toast.success(
          result.outputPath
            ? `Exported PDF to ${result.outputPath}`
            : `Exported "${result.filename}".`,
        );
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `${format.toUpperCase()} export failed.`);
    }
  }, [
    operatorDocNameDraft,
    operatorDroppedAsset?.kind,
    operatorDroppedAsset?.name,
    operatorDroppedAsset?.text,
    operatorSurfaceIsDocument,
  ]);

  const exportMarkdownFileToDocx = useCallback(async (filePath: string) => {
    setMessages((prev) => [...prev, { role: "system", text: `MUTHUR_EXPORT_DOCX // ${filePath}` }]);
    try {
      const res = await fetch("/api/convert-markdown-to-docx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filePath }),
      });
      const payload = (await res.json()) as {
        ok?: boolean;
        outputPath?: string;
        suggestedFilename?: string;
        error?: string;
      };
      if (!res.ok || !payload.ok) {
        throw new Error(payload.error || `DOCX export failed (${res.status})`);
      }
      toast.success(`Exported ${filePath} → ${payload.outputPath || payload.suggestedFilename || "docx"}`);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: `Exported **${filePath}** to DOCX.\n\nOutput: \`${payload.outputPath || payload.suggestedFilename}\``,
        },
      ]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "DOCX export failed.");
      setMessages((prev) => [
        ...prev,
        { role: "system", text: "MUTHUR_EXPORT_DOCX // FAILED" },
      ]);
    }
  }, []);

  const exportMarkdownFileToPdf = useCallback(async (filePath: string) => {
    setMessages((prev) => [...prev, { role: "system", text: `MUTHUR_EXPORT_PDF // ${filePath}` }]);
    try {
      const res = await fetch("/api/convert-markdown-to-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filePath }),
      });
      const payload = (await res.json()) as {
        ok?: boolean;
        outputPath?: string;
        suggestedFilename?: string;
        error?: string;
      };
      if (!res.ok || !payload.ok) {
        throw new Error(payload.error || `PDF export failed (${res.status})`);
      }
      toast.success(`Exported ${filePath} → ${payload.outputPath || payload.suggestedFilename || "pdf"}`);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: `Exported **${filePath}** to PDF.\n\nOutput: \`${payload.outputPath || payload.suggestedFilename}\``,
        },
      ]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "PDF export failed.");
      setMessages((prev) => [
        ...prev,
        { role: "system", text: "MUTHUR_EXPORT_PDF // FAILED" },
      ]);
    }
  }, []);

  const pasteClipboardToOperator = useCallback(async () => {
    operatorKindManualRef.current = false;
    try {
      const clipboardText = await readEchoMirageClipboardText();

      if (!clipboardText.trim()) {
        toast.error("Clipboard has no text.");
        return;
      }

      const pasteHistoryPath = `paste://${Date.now()}`;
      let strippedWrapper = false;
      await openOperatorFile(pasteHistoryPath, async () => {
        strippedWrapper = setOperatorTextAsset({
          kind: "text",
          name: operatorDroppedAsset?.name ?? "",
          mimeType: "text/plain",
          size: new Blob([clipboardText]).size,
          text: clipboardText,
        });
      });
      setOperatorSurfaceMode("workspace");
      setOperatorDocMode("edit");
      toast.success(
        strippedWrapper
          ? "Pasted into operator — stripped chat code-fence wrapper."
          : "Pasted clipboard into a new operator draft.",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not paste clipboard text.");
    }
  }, [openOperatorFile, operatorDroppedAsset?.name, setOperatorTextAsset]);

  const loadOperatorAssetFromFile = useCallback(async (file: File) => {
    operatorKindManualRef.current = false;
    const kind = getOperatorFileKind(file);
    const mimeType = file.type || "application/octet-stream";
    const baseAsset = {
      kind,
      name: file.name,
      mimeType,
      size: file.size,
    } satisfies Pick<DroppedOperatorAsset, "kind" | "name" | "mimeType" | "size">;

    if (kind === "image") {
      try {
        const imageSrc = await readFileAsDataUrl(file);
        setOperatorDroppedAsset({ ...baseAsset, imageSrc });
      } catch {
        setOperatorDroppedAsset(baseAsset);
      }
      setOperatorSurfaceMode("workspace");
      setOperatorDocMode("view");
      return;
    }

    if (kind === "video") {
      setOperatorDroppedAsset(baseAsset);
      setOperatorSurfaceMode("workspace");
      setOperatorDocMode("view");
      return;
    }

    if (
      kind === "markdown" ||
      kind === "code" ||
      kind === "text" ||
      kind === "json" ||
      isEditableOperatorFile(file)
    ) {
      try {
        const text = await file.text();
        setOperatorTextAsset({ ...baseAsset, text });
      } catch {
        setOperatorDroppedAsset(baseAsset);
      }
      setOperatorSurfaceMode("workspace");
      setOperatorDocMode("view");
      return;
    }

    setOperatorDroppedAsset(baseAsset);
    setOperatorSurfaceMode("workspace");
    setOperatorDocMode("view");
  }, [setOperatorTextAsset]);

  const reloadOperatorFolderFile = useCallback(
    async (filePath: string) => {
      const rootName = filePath.split("/")[0];
      const root = operatorFolderRootsRef.current.find((entry) => entry.name === rootName);
      if (!root) return;
      const file = await readFileFromFolderRoot(root, filePath);
      if (!file) return;
      await loadOperatorAssetFromFile(file);
    },
    [loadOperatorAssetFromFile],
  );

  const openOperatorFolderFile = useCallback(
    async (filePath: string, file: File) => {
      await openOperatorFile(filePath, async () => {
        const rootName = filePath.split("/")[0];
        const root = operatorFolderRootsRef.current.find((entry) => entry.name === rootName);
        if (root) {
          const fresh = await readFileFromFolderRoot(root, filePath);
          await loadOperatorAssetFromFile(fresh || file);
          return;
        }
        await loadOperatorAssetFromFile(file);
      });
    },
    [loadOperatorAssetFromFile, openOperatorFile],
  );

  const handleOperatorFolderRootsChange = useCallback((roots: OperatorDocFolderRoot[]) => {
    operatorFolderRootsRef.current = roots;
    setOperatorFolderRootsCount(roots.length);
  }, []);

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
        operatorKindManualRef.current = false;
        const text = entry.text || "";
        setOperatorTextAsset({
          kind: "text",
          name: entry.name,
          mimeType: "text/plain",
          size: new Blob([text]).size,
          text,
        });
        setOperatorSurfaceMode("workspace");
        setOperatorDocMode("view");
        useCyberdeckTabStore.getState().setServer("m");
        setNavRailContext("gateway");
      });
    },
    [openOperatorFile, setOperatorTextAsset],
  );

  const deleteHeapEntry = useCallback((id: string) => {
    setHeapEntries((prev) => prev.filter((entry) => entry.id !== id));
  }, []);

  useEffect(() => {
    const onContextAction = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      if (detail === "save-operator") {
        saveOperatorDocument();
        return;
      }
      if (detail === "paste-operator") {
        void pasteClipboardToOperator();
        return;
      }
      if (detail === "copy-operator") {
        void copyOperatorDocToClipboard();
      }
    };

    window.addEventListener("echo-mirage-context-action", onContextAction);
    return () => window.removeEventListener("echo-mirage-context-action", onContextAction);
  }, [copyOperatorDocToClipboard, pasteClipboardToOperator, saveOperatorDocument]);

  const selectProvider = useCallback((id: string) => {
    setActiveProvider(id);
    try {
      localStorage.setItem("active_provider", id);
    } catch {
      /* ignore */
    }
    playDeckSystemSound("chirp", 0.05);
  }, []);

  const closeRailTabContextMenu = useCallback(() => {
    setRailTabContextMenu(null);
    emitSignal({ source: "ui", type: "cancel", payload: { target: "rail_tab_menu" }, severity: "info" });
  }, []);

  const closeMirageContextMenu = useCallback(() => {
    setMirageContextMenu(null);
    emitSignal({ source: "ui", type: "cancel", payload: { target: "mirage_menu" }, severity: "info" });
  }, []);

  const closeGatewayPaneContextMenu = useCallback(() => {
    setGatewayPaneContextMenu(null);
    emitSignal({ source: "ui", type: "cancel", payload: { target: "gateway_menu" }, severity: "info" });
  }, []);

  const handleTabClick = useCallback(
    (id: string) => {
      const { customTabs, activeCustomTabId, server } = useCyberdeckTabStore.getState();
      const isCustomTab = customTabs.some((tab) => tab.id === id);
      const willChange = isCustomTab
        ? activeCustomTabId !== id
        : activeCustomTabId !== null || server !== id;

      // Paint rail + panes in the same frame as the click (before audio / page setState).
      flushSync(() => {
        if (isCustomTab) {
          if (willChange) useCyberdeckTabStore.getState().selectTab(id, true);
        } else {
          useCyberdeckTabStore.getState().selectTab(id, false);
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
      } else {
        playDeckSystemSound("click", 0.02);
      }

      startTransition(() => {
        closeRailTabContextMenu();
        closeMirageContextMenu();
        closeGatewayPaneContextMenu();
        setNavRailContext("gateway");
        setServerKeyboardHighlightId(null);
      });
    },
    [closeGatewayPaneContextMenu, closeMirageContextMenu, closeRailTabContextMenu],
  );

  const createBlankTab = useCallback(() => {
    closeRailTabContextMenu();
    closeMirageContextMenu();
    closeGatewayPaneContextMenu();
    const nextIndex = useCyberdeckTabStore.getState().customTabs.length + 1;
    const id = `tab-${crypto.randomUUID()}`;
    const tab: CustomTab = {
      id,
      label: `TAB ${nextIndex}`,
      glyph: String(nextIndex % 10 || nextIndex),
      kind: "blank",
    };
    useCyberdeckTabStore.getState().setCustomTabs((prev) => [...prev, tab]);
    useCyberdeckTabStore.getState().setActiveCustomTabId(id);
    setNavRailContext("gateway");
    playDeckSystemSound("chirp", 0.05);
  }, [closeGatewayPaneContextMenu, closeMirageContextMenu, closeRailTabContextMenu]);

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

  const deleteActiveTab = useCallback(() => {
    closeRailTabContextMenu();
    closeMirageContextMenu();
    closeGatewayPaneContextMenu();
    const activeCustomTabId = useCyberdeckTabStore.getState().activeCustomTabId;
    if (!activeCustomTabId) return;
    useCyberdeckTabStore.getState().setCustomTabs((prev) => prev.filter((tab) => tab.id !== activeCustomTabId));
    useCyberdeckTabStore.setState((state) => ({
      mountedCustomTabIds: state.mountedCustomTabIds.filter((id) => id !== activeCustomTabId),
    }));
    useCyberdeckTabStore.getState().setActiveCustomTabId(null);
    playDeckSystemSound("click", 0.02);
  }, [closeGatewayPaneContextMenu, closeMirageContextMenu, closeRailTabContextMenu]);

  const clearSavedCustomTabState = useCallback(() => {
    const removedCount = useCyberdeckTabStore.getState().customTabs.length;
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
    const media = window.matchMedia("(max-width: 768px)");
    const apply = () => setIsMobileLayout(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

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

  // Hydrate keys / models / active provider from localStorage (weyland-compatible keys)
  useEffect(() => {
    const nextKeys: Record<string, string> = {};
    const caches: Record<string, ProviderModelRow[]> = {};
    const statusUpdates: Record<string, "idle" | "retrieving" | "invalid-key" | "error" | "ready"> =
      {};
    const verifiedUpdates: Record<string, boolean> = {};
    for (const id of PROVIDER_IDS) {
      const stored = localStorage.getItem(`key_${id}`);
      const fallback = DEFAULT_CLIENT_PROVIDER_KEYS[id] || "";
      const value = (stored || fallback || "").trim();
      if (value) nextKeys[id] = value;
      const cached = loadProviderModelsCache(id);
      if (cached.length > 0) {
        caches[id] = cached;
        if (value) {
          statusUpdates[id] = "ready";
          verifiedUpdates[id] = true;
        }
      }
    }
    setProviderKeys(nextKeys);
    setModelCacheByProvider(caches);
    if (Object.keys(statusUpdates).length > 0) {
      setModelFetchStatusByProvider((prev) => ({ ...prev, ...statusUpdates }));
      setVerifiedProviders((prev) => ({ ...prev, ...verifiedUpdates }));
    }
    const ap = localStorage.getItem("active_provider");
    const resolvedActive =
      ap && (PROVIDER_IDS as readonly string[]).includes(ap) ? ap : "opencode";
    if (ap && (PROVIDER_IDS as readonly string[]).includes(ap)) setActiveProvider(ap);
    setModelByProvider((prev) => {
      const n = { ...prev };
      for (const id of PROVIDER_IDS) {
        const m = localStorage.getItem(`ascii_model_${id}`);
        if (m) n[id] = m;
      }
      return n;
    });
    const bootModels = caches[resolvedActive];
    if (bootModels?.length) setModelList(bootModels);
    setDidHydrateProviderState(true);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamText]);

  useEffect(() => {
    if (scanActivityActive) {
      startDeckSonarLoop(3200, CYBERDECK_SONAR_VOL_SCAN);
    } else {
      stopDeckSonarLoop();
    }
    return () => stopDeckSonarLoop();
  }, [scanActivityActive]);

  useEffect(() => {
    if (isStreaming) {
      if (chatSonarDelayRef.current == null) {
        chatSonarDelayRef.current = window.setTimeout(() => {
          startDeckSonarLoop(3200, CYBERDECK_SONAR_VOL_CHAT_STREAM);
          chatSonarActiveRef.current = true;
          chatSonarDelayRef.current = null;
        }, 7000);
      }
      if (networkFeedbackDelayRef.current == null) {
        networkFeedbackDelayRef.current = window.setTimeout(() => {
          playDeckBleepBloop();
          networkFeedbackRepeatRef.current = window.setInterval(() => {
            playDeckBleepBloop();
          }, 7000);
        }, 2800);
      }
    } else {
      if (chatSonarDelayRef.current !== null) {
        window.clearTimeout(chatSonarDelayRef.current);
        chatSonarDelayRef.current = null;
      }
      if (chatSonarActiveRef.current && !scanActivityActive) {
        stopDeckSonarLoop();
      }
      chatSonarActiveRef.current = false;
      if (scanActivityActive) {
        startDeckSonarLoop(3200, CYBERDECK_SONAR_VOL_SCAN);
      }
      if (networkFeedbackDelayRef.current !== null) {
        window.clearTimeout(networkFeedbackDelayRef.current);
        networkFeedbackDelayRef.current = null;
      }
      if (networkFeedbackRepeatRef.current !== null) {
        window.clearInterval(networkFeedbackRepeatRef.current);
        networkFeedbackRepeatRef.current = null;
      }
    }
    return () => {
      if (chatSonarDelayRef.current !== null) {
        window.clearTimeout(chatSonarDelayRef.current);
        chatSonarDelayRef.current = null;
      }
      if (networkFeedbackDelayRef.current !== null) {
        window.clearTimeout(networkFeedbackDelayRef.current);
        networkFeedbackDelayRef.current = null;
      }
      if (networkFeedbackRepeatRef.current !== null) {
        window.clearInterval(networkFeedbackRepeatRef.current);
        networkFeedbackRepeatRef.current = null;
      }
      if (chatSonarActiveRef.current && !scanActivityActive) {
        stopDeckSonarLoop();
      }
      chatSonarActiveRef.current = false;
    };
  }, [isStreaming, scanActivityActive]);

  // After keys hydrate: prompt only when this provider truly has no client key (gateway field handles entry).
  useEffect(() => {
    if (!didHydrateProviderState) return;
    if (providerHasClientKey(activeProvider, providerKeys, defaultKeyAvailableByProvider)) return;
    const tip = gatewayKeySysMessage(activeProvider);
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last?.role === "system" && last.text === tip) return prev;
      return [...prev, { role: "system", text: tip }];
    });
  }, [activeProvider, defaultKeyAvailableByProvider, didHydrateProviderState, providerKeys]);

  // Drop stale key prompts from saved chat once a key is present.
  useEffect(() => {
    if (!didHydrateProviderState || !hasProviderAuth) return;
    setMessages((prev) => {
      const next = prev.filter((m) => !(m.role === "system" && isGatewayKeySysTip(m.text)));
      return next.length === prev.length ? prev : next;
    });
  }, [didHydrateProviderState, hasProviderAuth]);

  const setModelHealth = useCallback((provider: string, model: string, status: string) => {
    setModelHealthByProvider((prev) => ({
      ...prev,
      [provider]: { ...(prev[provider] || {}), [model]: status },
    }));
  }, []);

  const probeSelectedModel = useCallback(
    async (provider: string, model: string, key: string) => {
      if (!provider || !model || !ENABLE_MODEL_PROBE) return;

      const cacheKey = `${provider}::${model}`;
      const cached = modelProbeCacheRef.current[cacheKey];
      if (cached && Date.now() - cached.at < 120_000) {
        setModelHealth(provider, model, cached.status);
        return;
      }

      const lastProbeAt = modelProbeLastAtRef.current[provider] || 0;
      if (Date.now() - lastProbeAt < MODEL_PROBE_MIN_INTERVAL_MS) {
        return;
      }
      modelProbeLastAtRef.current[provider] = Date.now();

      if (modelProbeAbortRef.current) {
        modelProbeAbortRef.current.abort();
      }
      const abortCtl = new AbortController();
      modelProbeAbortRef.current = abortCtl;

      setProbeInFlightByProvider((prev) => ({ ...prev, [provider]: model }));
      setModelHealth(provider, model, "testing");
      try {
        const res = await fetch("/api/cyberdeck-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: abortCtl.signal,
          body: JSON.stringify({ probe: true, provider, apiKey: key, model }),
        });
        const data = (await res.json()) as {
          ok?: boolean;
          valid?: boolean;
          rateLimited?: boolean;
          status?: number;
        };
        const httpStatus = data.status ?? res.status;
        const modelRateLimited = httpStatus === 429;

        if (!res.ok || data.ok === false) {
          const failHealth = modelRateLimited ? "amber" : "grey";
          if (modelRateLimited) {
            providerRateLimitUntilRef.current[provider] = Date.now() + PROVIDER_RATE_LIMIT_COOLDOWN_MS;
          } else if (httpStatus === 502 || httpStatus === 503) {
            setRateLimitedProviders((prev) => new Set(prev).add(provider));
          }
          const line = `MODEL_TEST ${provider.toUpperCase()}/${model}: HTTP_${httpStatus}${
            modelRateLimited
              ? " // MODEL_RATE_LIMIT"
              : httpStatus === 502 || httpStatus === 503
                ? " // OPERATOR_ACTION_REQUIRED"
                : " // FAILURE"
          }`;
          playModelTestErrorSound(line);
          setModelHealth(provider, model, failHealth);
          modelProbeCacheRef.current[cacheKey] = { status: failHealth, at: Date.now() };
          if (!modelRateLimited) {
            setVerifiedProviders((prev) => ({ ...prev, [provider]: false }));
          }
          setMessages((prev) => [
            ...prev,
            {
              role: "system",
              text: line,
            },
          ]);
          return;
        }

        const valid = Boolean(data.valid);
        const health = valid ? "green" : "amber";
        setModelHealth(provider, model, health);
        modelProbeCacheRef.current[cacheKey] = { status: health, at: Date.now() };
        setRateLimitedProviders((prev) => {
          const next = new Set(prev);
          next.delete(provider);
          return next;
        });
        delete providerRateLimitUntilRef.current[provider];
        const isVerified = valid || provider === "opencode";
        setVerifiedProviders((prev) => ({ ...prev, [provider]: isVerified }));
        const line = valid
          ? `MODEL_TEST ${provider.toUpperCase()}/${model}: VALID_RESPONSE`
          : `MODEL_TEST ${provider.toUpperCase()}/${model}: EMPTY_PROBE // transport OK, content empty`;
        playModelTestErrorSound(line);
        setMessages((prev) => [
          ...prev,
          {
            role: "system",
            text: line,
          },
        ]);
      } catch (err) {
        if (abortCtl.signal.aborted) return;
        playModelTestErrorSound(`MODEL_TEST ${provider.toUpperCase()}/${model}: FAILURE`);
        setModelHealth(provider, model, "grey");
        setVerifiedProviders((prev) => ({ ...prev, [provider]: false }));
        setMessages((prev) => [
          ...prev,
          {
            role: "system",
            text: `MODEL_TEST ${provider.toUpperCase()}/${model}: ${String((err as Error)?.message || err)}`,
          },
        ]);
      } finally {
        if (modelProbeAbortRef.current === abortCtl) {
          modelProbeAbortRef.current = null;
        }
        setProbeInFlightByProvider((prev) => {
          if (prev[provider] !== model) return prev;
          return { ...prev, [provider]: "" };
        });
      }
    },
    [playModelTestErrorSound, setModelHealth, setRateLimitedProviders, setVerifiedProviders],
  );

  const fetchModelsForProvider = useCallback(
    async (provider: string, options?: { force?: boolean }) => {
      const force = options?.force === true;
      if (rateLimitedProviders.has(provider)) return;
      const currentKey = (providerKeys[provider] || DEFAULT_CLIENT_PROVIDER_KEYS[provider] || "").trim();
      if (!currentKey) return;

      const cachedFromState = modelCacheByProvider[provider];
      const cached =
        cachedFromState && cachedFromState.length > 0
          ? cachedFromState
          : loadProviderModelsCache(provider);

      if (!force && cached.length > 0) {
        setModelCacheByProvider((prev) => ({ ...prev, [provider]: cached }));
        setModelFetchStatusByProvider((prev) => ({ ...prev, [provider]: "ready" }));
        setVerifiedProviders((prev) => ({ ...prev, [provider]: true }));
        setModelList((prevList) => (activeProvider === provider ? cached : prevList));
        return;
      }

      setModelFetchStatusByProvider((prev) => ({ ...prev, [provider]: "retrieving" }));

      try {
        const res = await fetch("/api/cyberdeck-models", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ provider, apiKey: currentKey }),
        });
        if (!res.ok) {
          const errJson = (await res.json().catch(() => ({}))) as {
            authSource?: "user" | "default" | "none";
            code?: string;
          };
          if (errJson.authSource === "none" || errJson.code === "NO_PROVIDER_KEY") {
            setDefaultKeyAvailableByProvider((prev) => ({ ...prev, [provider]: false }));
            setModelFetchStatusByProvider((prev) => ({ ...prev, [provider]: "idle" }));
            return;
          }
          if (res.status === 429 || res.status === 502 || res.status === 503) {
            if (res.status === 429) {
              providerRateLimitUntilRef.current[provider] = Date.now() + PROVIDER_RATE_LIMIT_COOLDOWN_MS;
            } else {
              setRateLimitedProviders((prev) => new Set(prev).add(provider));
            }
            setModelFetchStatusByProvider((prev) => ({ ...prev, [provider]: "error" }));
            setVerifiedProviders((prev) => ({ ...prev, [provider]: false }));
            setMessages((prev) => [
              ...prev,
              {
                role: "system",
                text: `UPLINK_HALTED // ${provider.toUpperCase()} // HTTP_${res.status} // OPERATOR_ACTION_REQUIRED`,
              },
            ]);
            return;
          }
          const invalid = res.status === 401 || res.status === 403;
          setModelFetchStatusByProvider((prev) => ({
            ...prev,
            [provider]: invalid ? "invalid-key" : "error",
          }));
          setVerifiedProviders((prev) => ({ ...prev, [provider]: false }));
          if (invalid && providerKeys[provider]) {
            setProviderKeys((prev) => {
              const next = { ...prev };
              delete next[provider];
              return next;
            });
            localStorage.removeItem(`key_${provider}`);
            setModelCacheByProvider((prev) => {
              const next = { ...prev };
              delete next[provider];
              return next;
            });
            localStorage.removeItem(providerModelsCacheKey(provider));
            setMessages((prev) => [
              ...prev,
              { role: "system", text: `INVALID_KEY // ${provider.toUpperCase()} AUTH_REJECTED` },
            ]);
          }
          return;
        }
        const json = (await res.json()) as {
          data?: { id: string }[];
          authSource?: "user" | "default";
        };
        const raw = Array.isArray(json.data) ? json.data : [];
        setDefaultKeyAvailableByProvider((prev) => ({
          ...prev,
          [provider]: json.authSource === "default",
        }));
        setModelCacheByProvider((prev) => ({ ...prev, [provider]: raw }));
        saveProviderModelsCache(provider, raw);
        setModelFetchStatusByProvider((prev) => ({ ...prev, [provider]: "ready" }));
        setVerifiedProviders((prev) => ({ ...prev, [provider]: true }));
        setModelList((prevList) => (activeProvider === provider ? raw : prevList));
        setModelByProvider((prev) => {
          const current = prev[provider] || "";
          const hasCurrent = current && raw.some((m) => m.id === current);
          const nextModel = hasCurrent ? current : raw[0]?.id || "";
          if (nextModel) {
            localStorage.setItem(`ascii_model_${provider}`, nextModel);
          }
          return { ...prev, [provider]: nextModel };
        });
      } catch {
        setModelFetchStatusByProvider((prev) => ({ ...prev, [provider]: "error" }));
        setVerifiedProviders((prev) => ({ ...prev, [provider]: false }));
        setModelList((prevList) => (activeProvider === provider ? [] : prevList));
      }
    },
    [activeProvider, modelCacheByProvider, providerKeys, rateLimitedProviders],
  );

  const providerHasKey = useCallback(
    (providerId: string) =>
      providerHasClientKey(providerId, providerKeys, defaultKeyAvailableByProvider),
    [defaultKeyAvailableByProvider, providerKeys],
  );

  const syncModelListFromCache = useCallback(
    (providerId: string) => {
      const cached =
        modelCacheByProvider[providerId]?.length
          ? modelCacheByProvider[providerId]
          : loadProviderModelsCache(providerId);
      if (cached.length > 0) {
        setModelList(cached);
        setModelCacheByProvider((prev) =>
          prev[providerId]?.length ? prev : { ...prev, [providerId]: cached },
        );
        return;
      }
      setModelList([]);
      if (providerHasKey(providerId) && !rateLimitedProviders.has(providerId)) {
        void fetchModelsForProvider(providerId);
      }
    },
    [fetchModelsForProvider, modelCacheByProvider, providerHasKey, rateLimitedProviders],
  );

  const refreshProviderModelsDebounced = useCallback(
    (providerId: string) => {
      const now = Date.now();
      const last = providerRefreshAtRef.current[providerId] || 0;
      if (now - last < PROVIDER_LINK_REFRESH_COOLDOWN_MS) {
        toast.info("Refresh cooldown — wait before refreshing again.");
        return;
      }
      providerRefreshAtRef.current[providerId] = now;
      if (!providerHasKey(providerId)) return;
      void fetchModelsForProvider(providerId, { force: true });
    },
    [fetchModelsForProvider, providerHasKey],
  );

  const handleProviderClick = useCallback(
    (id: string) => {
      const now = Date.now();
      const tracker = providerClickTrackerRef.current;
      const sameBurst =
        tracker.providerId === id && now - tracker.lastClickAt < PROVIDER_CLICK_ESCALATION_MS;

      if (id !== activeProvider) {
        tracker.providerId = id;
        tracker.count = 1;
        tracker.lastClickAt = now;
        setCredentialReplaceProvider(null);
        selectProvider(id);
        syncModelListFromCache(id);
        return;
      }

      if (!sameBurst) {
        tracker.providerId = id;
        tracker.count = 1;
        tracker.lastClickAt = now;
        return;
      }

      tracker.count += 1;
      tracker.lastClickAt = now;

      if (tracker.count === 2) {
        refreshProviderModelsDebounced(id);
        return;
      }
      if (tracker.count >= 3) {
        setCredentialReplaceProvider(id);
        setGatewayKeyDraft("");
      }
    },
    [activeProvider, refreshProviderModelsDebounced, selectProvider, syncModelListFromCache],
  );

  const submitGatewayKey = useCallback(async () => {
    const trimmed = gatewayKeyDraft.trim();
    if (!trimmed) return;
    const provider = credentialReplaceProvider ?? activeProvider;
    setProviderKeys((prev) => ({ ...prev, [provider]: trimmed }));
    try {
      localStorage.setItem(`key_${provider}`, trimmed);
    } catch {
      /* ignore */
    }
    setCredentialReplaceProvider(null);
    setGatewayKeyDraft("");
    setRateLimitedProviders((prev) => {
      if (!prev.has(provider)) return prev;
      const next = new Set(prev);
      next.delete(provider);
      return next;
    });
    await fetchModelsForProvider(provider, { force: true });
  }, [activeProvider, credentialReplaceProvider, fetchModelsForProvider, gatewayKeyDraft]);

  const activateModelById = useCallback(
    (modelId: string) => {
      const key = providerKeys[activeProvider];
      if (!modelId) return;
      setModelByProvider((prev) => ({ ...prev, [activeProvider]: modelId }));
      try {
        localStorage.setItem(`ascii_model_${activeProvider}`, modelId);
      } catch {
        /* ignore */
      }
      playDeckSystemSound("click", 0.02);
      if (ENABLE_MODEL_PROBE) {
        void probeSelectedModel(activeProvider, modelId, key || "");
      }
    },
    [activeProvider, probeSelectedModel, providerKeys],
  );

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
            handleTabClick(serverKeyboardHighlightId ?? sPivot);
            setNavRailContext("gateway");
            setServerKeyboardHighlightId(null);
            setModelKeyboardHighlightId(null);
            const pid =
              (PROVIDER_IDS as readonly string[]).includes(activeProvider) ? activeProvider : PROVIDER_IDS[0];
            setProviderKeyboardHighlightId(pid);
            return;
          }
        } else if (navKey) {
          e.preventDefault();
        }
        return;
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

      const ids = [...PROVIDER_IDS];
      const pivot =
        providerKeyboardHighlightId ??
        (ids.includes(activeProvider as (typeof PROVIDER_IDS)[number]) ? activeProvider : ids[0]);
      let idx = ids.indexOf(pivot as (typeof PROVIDER_IDS)[number]);
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
    handleTabClick,
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
      return;
    }
    if (providerKeyboardHighlightId) {
      scrollToHighlight(`[data-provider-row="${providerKeyboardHighlightId}"]`);
      return;
    }
    if (modelKeyboardHighlightId) {
      scrollToHighlight(`[data-model-row="${modelKeyboardHighlightId}"]`);
    }
  }, [modelKeyboardHighlightId, navRailContext, providerKeyboardHighlightId, serverKeyboardHighlightId]);


  useEffect(() => {
    setModelKeyboardHighlightId((prev) => {
      if (prev == null) return null;
      if (!modelList.some((m) => m.id === prev)) return null;
      return prev;
    });
  }, [activeProvider, modelList]);

  // Bootstrap active provider link once after hydrate (cache-first; fetch only if missing).
  useEffect(() => {
    if (!didHydrateProviderState || providerBootstrapRef.current) return;
    providerBootstrapRef.current = true;
    const cached =
      modelCacheByProvider[activeProvider]?.length
        ? modelCacheByProvider[activeProvider]
        : loadProviderModelsCache(activeProvider);
    if (cached.length > 0) {
      setModelList(cached);
      return;
    }
    if (providerKeys[activeProvider] || defaultKeyAvailableByProvider[activeProvider]) {
      void fetchModelsForProvider(activeProvider);
    }
  }, [
    activeProvider,
    defaultKeyAvailableByProvider,
    didHydrateProviderState,
    fetchModelsForProvider,
    modelCacheByProvider,
    providerKeys,
  ]);

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

  const handleSend = async (messageText?: string) => {
    const userMessage = (messageText ?? messageInputRef.current?.getValue() ?? "").trim();
    if (!userMessage) return;

    if (parseMuthurClearChatIntent(userMessage)) {
      abortMotherSpeech();
      if (chatAbortRef.current) {
        chatAbortRef.current.abort();
        chatAbortRef.current = null;
      }
      setIsStreaming(false);
      setStreamText("");
      setStreamToolTrace("");
      setMessages([]);
      setChatKeyboardHighlightIndex(null);
      setGeneratedUI(null);
      screenshotRef.current = null;
      messageInputRef.current?.clear();
      try {
        window.localStorage.removeItem(CHAT_STORAGE_KEY);
        window.localStorage.removeItem(CHAT_STREAM_STORAGE_KEY);
      } catch {
        // ignore storage errors
      }
      return;
    }

    if (isStreaming) return;
    const providerCooldownUntil = providerRateLimitUntilRef.current[activeProvider] || 0;
    if (providerCooldownUntil && Date.now() < providerCooldownUntil) {
      setMessages((prev) => [
        ...prev,
        {
          role: "system",
          text: `SEND_COOLDOWN // ${activeProvider.toUpperCase()} // WAIT_${Math.ceil((providerCooldownUntil - Date.now()) / 1000)}S`,
        },
      ]);
      return;
    }
    if (rateLimitedProviders.has(activeProvider)) {
      setMessages((prev) => [
        ...prev,
        {
          role: "system",
          text: `SEND_BLOCKED // ${activeProvider.toUpperCase()} // RATE_LIMIT // OPERATOR_ACTION_REQUIRED`,
        },
      ]);
      return;
    }

    const tabCommand = parseCustomTabCommand(userMessage);
    setInputHistory((prev) => [...prev, userMessage]);
    messageInputRef.current?.clear();
    setMessages((prev) => [...prev, { role: "user", text: userMessage }]);
    setIsStreaming(true);
    setStreamText("");
    setStreamToolTrace("");
    setGeneratedUI(null);

    const glyphCommand = resolveGlyphCommand(userMessage);
    if (glyphCommand) {
      try {
        await handleGlyphOperatorCommand(glyphCommand);
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          {
            role: "system",
            text: `GLYPH // FAILED // ${err instanceof Error ? err.message : "Glyph command failed"}`,
          },
        ]);
      }
      setIsStreaming(false);
      return;
    }

    if (tabCommand?.kind === "create") {
      const id = `tab-${crypto.randomUUID()}`;
      const tab: CustomTab = {
        id,
        label: tabCommand.label,
        glyph: tabCommand.glyph,
        kind: "blank",
      };
      useCyberdeckTabStore.getState().setCustomTabs((prev) => [...prev, tab]);
      useCyberdeckTabStore.getState().setActiveCustomTabId(id);
      setNavRailContext("tabs");
      setMessages((prev) => [
        ...prev,
        {
          role: "system",
          text: `TAB_CREATED // ${tab.label} // GLYPH ${tab.glyph}`,
        },
      ]);
      setIsStreaming(false);
      return;
    }

    if (tabCommand?.kind === "clear") {
      clearSavedCustomTabState();
      setIsStreaming(false);
      return;
    }

    if (tabCommand?.kind === "convert") {
      const activeCustomTabId = useCyberdeckTabStore.getState().activeCustomTabId;
      if (!activeCustomTabId) {
        setMessages((prev) => [
          ...prev,
          { role: "system", text: "TAB_CONVERT_SKIPPED // SELECT_A_CUSTOM_TAB_FIRST" },
        ]);
        setIsStreaming(false);
        return;
      }

      convertCustomTab(activeCustomTabId, tabCommand.surfaceKind, {
        label: tabCommand.label,
        glyph: tabCommand.glyph,
      });
      setIsStreaming(false);
      return;
    }

    if (/^(?:\/tab|tab:)?\s*(?:delete|remove|close)\s+tab(?:\s+(?:active|current|selected))?$/i.test(userMessage)) {
      const activeCustomTabId = useCyberdeckTabStore.getState().activeCustomTabId;
      if (activeCustomTabId) {
        deleteActiveTab();
        setMessages((prev) => [
          ...prev,
          { role: "system", text: "TAB_REMOVED // ACTIVE_CUSTOM_TAB" },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "system", text: "TAB_REMOVE_SKIPPED // NO_ACTIVE_CUSTOM_TAB" },
        ]);
      }
      setIsStreaming(false);
      return;
    }

    const settingsCmd = userMessage.trim().toLowerCase();
    if (settingsCmd === "settings" || settingsCmd === "/settings") {
      handleModelLabelClick("b");
      setMessages((prev) => [
        ...prev,
        { role: "system", text: "SETTINGS_SURFACE // CONFIG_PLANE" },
      ]);
      setIsStreaming(false);
      return;
    }

    const helpIntent = parseMuthurHelpIntent(userMessage);
    if (helpIntent) {
      const helpText =
        helpIntent.kind === "unknown"
          ? getMuthurHelpUnknownTopicText(helpIntent.topic)
          : getMuthurHelpText(helpIntent.topic);
      setMessages((prev) => [...prev, { role: "assistant", text: helpText }]);
      setIsStreaming(false);
      return;
    }

    const muthurReviewMatch = userMessage.match(/^\/muthur\s+review\s*$/i);
    if (muthurReviewMatch) {
      setMessages((prev) => [
        ...prev,
        { role: "system", text: "⚡ MUTHUR_REVIEW // FETCHING_CHANGES..." },
      ]);
      setIsStreaming(true);
      setStreamText("⚡ MUTHUR is analyzing changes...");
      try {
        const res = await fetch("/api/git-diff");
        if (!res.ok) throw new Error("Failed to get diff");
        const { diff } = await res.json() as { diff: string };
        
        if (!diff) {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", text: `REVIEW OUTCOME: BLOCKED

SUMMARY: No changes detected in the repository.

SCOPE REVIEWED: None - no git diff available.

FINDINGS: None.

VALIDATION: Not applicable.

RISK LEVEL: N/A

DOCTRINE CHECK: Cannot verify - no changes present.

RECOMMENDED ACTION: Make code changes first before requesting review.

CONFIDENCE: 1.00` },
          ]);
        } else {
          setMessages((prev) => [
            ...prev,
            { role: "system", text: "⚡ MUTHUR_REVIEW // DIFF_RETRIEVED // ANALYZING..." },
          ]);
          setStreamText("⚡ MUTHUR analyzing changes...\n\n" + diff.slice(0, 500) + (diff.length > 500 ? "\n... (diff truncated)" : ""));
          
          const reviewPrompt = `You are MUTHUR, the Echo Mirage operational AI. You must produce a STRUCTURED REVIEW of code changes.

IMPORTANT: You MUST follow the output format below. NEVER respond with just "Review complete." - you must provide a full structured report.

OUTPUT FORMAT:
\`\`\`
REVIEW OUTCOME: [PASS|REVISE|FAIL|BLOCKED]

SUMMARY:
[Brief explanation of what changed]

SCOPE REVIEWED:
[Files and artifacts reviewed]

FINDINGS:
1. [Finding description]
   Severity: [LOW|MEDIUM|HIGH|CRITICAL]
   Evidence: [file path, diff reference, or observed behavior]
   Recommendation: [fix or "none"]

VALIDATION:
- pnpm exec tsc --noEmit: [PASS|FAIL|NOT RUN]
- pnpm build: [PASS|FAIL|NOT RUN]
- Manual validation: [PASS|FAIL|NOT RUN]

RISK LEVEL: [LOW|MEDIUM|HIGH|CRITICAL]

DOCTRINE CHECK:
- explicit operational ownership: [PASS|FAIL|N/A]
- interruptibility: [PASS|FAIL|N/A]
- visible handoff: [PASS|FAIL|N/A]
- no hidden active systems: [PASS|FAIL|N/A]
- memory may recall, documents decide: [PASS|FAIL|N/A]
- human-supervised control transfer: [PASS|FAIL|N/A]

RECOMMENDED ACTION: [merge|revise before merge|block until fixed|run missing validation|request human decision]

CONFIDENCE: [0.00 to 1.00]
\`\`\`

RULES:
1. If no diff is available, output REVIEW OUTCOME: BLOCKED
2. If diff exists but no tests run, outcome should be REVISE (unless documentation-only)
3. If validation fails, outcome must be FAIL
4. If validation passes and no risks found, outcome may be PASS
5. NEVER say "Review complete." without the full structured report
6. If your response doesn't contain "REVIEW OUTCOME:", it will be rejected

Here are the code changes to review:
${diff}`;

          const reviewRes = await fetch("/api/cyberdeck-chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message: reviewPrompt,
              provider: activeProvider,
              apiKey: providerKeys[activeProvider] || "",
              model: modelID,
              memoryContext: "",
              browserContext: "",
              history: [],
            }),
          });
          
          if (reviewRes.ok) {
            const reader = reviewRes.body?.getReader();
            if (reader) {
              const decoder = new TextDecoder();
              let reviewText = "";
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                reviewText += decoder.decode(value, { stream: true });
              }
              
              if (!reviewText.includes("REVIEW OUTCOME:")) {
                setMessages((prev) => [
                  ...prev,
                  { role: "system", text: "⚠️ MUTHUR_REVIEW // INVALID_FORMAT" },
                ]);
                setStreamText("");
              } else {
                setMessages((prev) => [
                  ...prev,
                  { role: "assistant", text: "✅ " + reviewText },
                ]);
                setStreamText("");
              }
            } else {
              setMessages((prev) => [
                ...prev,
                { role: "system", text: "MUTHUR_REVIEW // FAILED // NO_STREAM" },
              ]);
              setStreamText("");
            }
          } else {
            setMessages((prev) => [
              ...prev,
              { role: "system", text: "MUTHUR_REVIEW // FAILED // API_ERROR" },
            ]);
            setStreamText("");
          }
        }
      } catch {
        setMessages((prev) => [
          ...prev,
          { role: "system", text: "MUTHUR_REVIEW // FAILED // ERROR" },
        ]);
        setStreamText("");
      } finally {
        setIsStreaming(false);
      }
      return;
    }

    const convertIntent = parseConvertDocumentIntent(userMessage);
    if (convertIntent) {
      setIsStreaming(false);
      await openConvertedMarkdownInOperator(convertIntent.filePath);
      return;
    }

    const exportDocxIntent = parseExportMarkdownToDocxIntent(userMessage);
    if (exportDocxIntent) {
      setIsStreaming(false);
      if (exportDocxIntent.fromOperator) {
        await exportOperatorMarkdown("docx");
      } else if (exportDocxIntent.filePath) {
        await exportMarkdownFileToDocx(exportDocxIntent.filePath);
      }
      return;
    }

    const exportPdfIntent = parseExportMarkdownToPdfIntent(userMessage);
    if (exportPdfIntent) {
      setIsStreaming(false);
      if (exportPdfIntent.fromOperator) {
        await exportOperatorMarkdown("pdf");
      } else if (exportPdfIntent.filePath) {
        await exportMarkdownFileToPdf(exportPdfIntent.filePath);
      }
      return;
    }

    const muthurReadMatch = userMessage.match(/^\/muthur\s+read\s+(.+)$/i);
    if (muthurReadMatch) {
      const filePath = muthurReadMatch[1].trim();
      setMessages((prev) => [
        ...prev,
        { role: "system", text: `MUTHUR_READ // ${filePath}` },
      ]);
      setIsStreaming(false);
      try {
        const res = await fetch(`/api/read-file?path=${encodeURIComponent(filePath)}`);
        if (!res.ok) throw new Error("Failed to read file");
        const { content } = await res.json() as { content: string };
        setMessages((prev) => [
          ...prev,
          { role: "assistant", text: `Here's the content of ${filePath}:\n\n\`\`\`\n${content.slice(0, 4000)}\n\`\`\`\n${content.length > 4000 ? "\n...(truncated)" : ""}` },
        ]);
      } catch {
        setMessages((prev) => [
          ...prev,
          { role: "system", text: `MUTHUR_READ // FAILED // FILE_NOT_FOUND_OR_ERROR` },
        ]);
      }
      return;
    }

    const muthurHistoryMatch = userMessage.match(/^\/muthur\s+history\s*$/i);
    if (muthurHistoryMatch) {
      setMessages((prev) => [
        ...prev,
        { role: "system", text: "MUTHUR_HISTORY // FETCHING..." },
      ]);
      setIsStreaming(false);
      try {
        const res = await fetch("/api/git-log");
        if (!res.ok) throw new Error("Failed to get history");
        const { log } = await res.json() as { log: string };
        if (!log) {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", text: "No commit history found." },
          ]);
        } else {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", text: `Recent commits:\n\n${log.slice(0, 3000)}` },
          ]);
        }
      } catch {
        setMessages((prev) => [
          ...prev,
          { role: "system", text: "MUTHUR_HISTORY // FAILED // ERROR" },
        ]);
      }
      return;
    }

    const muthurStatusMatch = userMessage.match(/^\/muthur\s+status\s*$/i);
    if (muthurStatusMatch) {
      setIsStreaming(false);
      const statusText = `
⚡ MUTHUR STATUS REPORT
========================
Provider: ${activeProvider.toUpperCase()}
Model: ${modelID || "NOT SELECTED"}
API Key: ${providerKeys[activeProvider] ? "✓ CONFIGURED" : "✗ MISSING"}
Model Status: ${modelFetchStatusByProvider[activeProvider] || "idle"}
Verified: ${verifiedProviders[activeProvider] ? "✓ YES" : "✗ NO"}
Rate Limited: ${rateLimitedProviders.has(activeProvider) ? "⚠️ YES" : "✓ NO"}
Connection: ${connectionState.toUpperCase()}

Last Messages: ${messages.slice(-3).map(m => `[${m.role.substring(0,3)}] ${m.text.substring(0,30)}...`).join("\n")}
`;
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: statusText },
      ]);
      return;
    }

    if (messageMayUseComputerUse(userMessage)) {
      const {
        detectSelfStatusIntent,
        detectInspectIntent,
        detectObserveIntent,
        detectStopObserveIntent,
        detectPauseObserveIntent,
        detectResumeObserveIntent,
        detectExecDeckShowIntent,
        detectExecDeckPrepareIntent,
        detectExecDeckClearIntent,
        detectExecDeckPushIntent,
        detectExecDeckExecuteIntent,
        detectExecDeckDescribeStagedIntent,
        formatStatusText,
        getLastSurfaceClassification,
        formatSurfaceResponse,
        stopObservation,
        getEventCount,
        pauseObservation,
        resumeObservation,
        startObservation,
        getNextPendingQuestion,
        answerQuestion,
        openDeck,
        isObserving,
        recordEvent,
        isDeckOpen,
        describeDeck,
        buildReviewerHand,
        prepareHand,
        getCardTableState,
        clearDeck,
        narrate,
        pushHandToStack,
        attemptExecute,
        isTeachingDemoTrigger,
        runTeachingDemo,
        runComputerUseBridgeAction,
        resolveUiTarget,
      } = await loadComputerUse();

    if (detectSelfStatusIntent(userMessage)) {
      const statusText = formatStatusText();
      setMessages((prev) => [...prev, { role: "assistant", text: statusText }]);
      setMuthurMemory((current) => recordMuthurMemoryTurn(current, userMessage, statusText));
      setIsStreaming(false);
      return;
    }

    if (detectInspectIntent(userMessage)) {
      const lastSurface = getLastSurfaceClassification();
      if (lastSurface) {
        let response = formatSurfaceResponse(lastSurface);
        if (screenshotRef.current && lastSurface.surface === "unknown") {
          response += " Screenshot captured — surface type unclassified. Consider reviewing the image content manually.";
          screenshotRef.current = null;
        }
        setMessages((prev) => [...prev, { role: "assistant", text: response }]);
        setMuthurMemory((current) => recordMuthurMemoryTurn(current, userMessage, response));
      } else {
        const response = "Screenshot capture is not available in this environment. Please paste a screenshot image using the attachment button, then ask me to inspect it.";
        setMessages((prev) => [...prev, { role: "assistant", text: response }]);
        setMuthurMemory((current) => recordMuthurMemoryTurn(current, userMessage, response));
      }
      setIsStreaming(false);
      return;
    }

    if (detectStopObserveIntent(userMessage)) {
      const session = stopObservation();
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: `Workflow observation stopped. ${getEventCount()} events recorded.`,
        },
      ]);
      setIsStreaming(false);
      return;
    }

    if (detectPauseObserveIntent(userMessage)) {
      pauseObservation();
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: "Workflow observation paused." },
      ]);
      setIsStreaming(false);
      return;
    }

    if (detectResumeObserveIntent(userMessage)) {
      resumeObservation();
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: "Workflow observation resumed." },
      ]);
      setIsStreaming(false);
      return;
    }

    if (detectObserveIntent(userMessage)) {
      const session = startObservation();
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: "Workflow observation started. Say 'MUTHUR, pause workflow observation' to pause, or 'MUTHUR, stop workflow observation' to end.",
        },
      ]);
      setIsStreaming(false);
      return;
    }

    const answerMap: Record<string, string> = {
      yes: "yes",
      no: "no",
      skip: "skip",
      "record this": "record_this",
      "ignore this": "ignore_this",
      optional: "optional",
      recovery: "recovery",
      "mark as recovery": "recovery",
      "yes record": "record_this",
      "no skip": "skip",
    };
    const lower = userMessage.toLowerCase().trim();
    for (const [trigger, answer] of Object.entries(answerMap)) {
      if (lower === trigger || lower === `muthur, ${trigger}`) {
        const pending = getNextPendingQuestion();
        if (pending) {
          answerQuestion(pending.id, answer as "yes" | "no" | "skip" | "record_this" | "ignore_this" | "optional" | "recovery");
          const questionsLeft = getNextPendingQuestion();
          let response = `Recorded.`;
          if (questionsLeft) {
            response += ` Next: ${questionsLeft.question}`;
          }
          setMessages((prev) => [...prev, { role: "assistant", text: response }]);
          setIsStreaming(false);
          return;
        }
      }
    }

    if (detectExecDeckShowIntent(userMessage)) {
      openDeck();
      if (isObserving()) recordEvent("execution_deck_opened", "Deck Opened", userMessage);
      useCyberdeckTabStore.getState().setServer(safeServerId("ct") as (typeof SERVER_IDS)[number]);
      useCyberdeckTabStore.getState().setActiveCustomTabId(null);
      if (isDeckOpen()) {
        const desc = describeDeck();
        setMessages((prev) => [...prev, { role: "assistant", text: `Card Table displayed. ${desc}` }]);
        setMuthurMemory((current) => recordMuthurMemoryTurn(current, userMessage, `Card Table displayed. ${desc}`));
      }
      setIsStreaming(false);
      return;
    }

if (detectExecDeckPrepareIntent(userMessage)) {
      openDeck();
      const cards = buildReviewerHand();
      const hand = prepareHand("Reviewer Hand", cards);
      useCyberdeckTabStore.getState().setServer(safeServerId("ct") as (typeof SERVER_IDS)[number]);
      useCyberdeckTabStore.getState().setActiveCustomTabId(null);
      const desc = describeDeck();
      if (isObserving()) recordEvent("hand_prepared", "Reviewer Hand", `${cards.length} cards staged: ${cards.map((c) => c.title).join(", ")}`);
      narrate("HAND_PREPARED");
      setMessages((prev) => [...prev, { role: "assistant", text: desc }]);
      setMuthurMemory((current) => recordMuthurMemoryTurn(current, userMessage, desc));
      setIsStreaming(false);
      return;
    }

    if (detectExecDeckDescribeStagedIntent(userMessage)) {
      const state = getCardTableState();
      if (!state.stagedHand || state.stagedHand.cards.length === 0) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", text: "No staged hand. Ask MUTHUR to prepare a reviewer hand." },
        ]);
      } else {
        const lines: string[] = [];
        lines.push(`## Staged Hand: ${state.stagedHand.name}`);
        for (const card of state.stagedHand.cards) {
          lines.push(`  [ ] ${card.title} — ${card.purpose} (${card.riskLevel} risk)${card.requiredConfirmation ? " [CONF REQUIRED]" : ""}`);
        }
        setMessages((prev) => [
          ...prev,
          { role: "assistant", text: lines.join("\n") },
        ]);
      }
      useCyberdeckTabStore.getState().setServer(safeServerId("ct") as (typeof SERVER_IDS)[number]);
      useCyberdeckTabStore.getState().setActiveCustomTabId(null);
      setIsStreaming(false);
      return;
    }

    if (detectExecDeckClearIntent(userMessage)) {
      clearDeck();
      if (isObserving()) recordEvent("stack_cleared", "Card Table", userMessage);
      narrate("CARD_TABLE_CLEARED");
      useCyberdeckTabStore.getState().setServer(safeServerId("s") as (typeof SERVER_IDS)[number]);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: "Card table cleared. All cards discarded." },
      ]);
      setIsStreaming(false);
      return;
    }

    if (detectExecDeckPushIntent(userMessage)) {
      openDeck();
      const result = pushHandToStack();
      useCyberdeckTabStore.getState().setServer(safeServerId("ct") as (typeof SERVER_IDS)[number]);
      useCyberdeckTabStore.getState().setActiveCustomTabId(null);
      if (result.pushed > 0) {
        if (isObserving()) recordEvent("hand_pushed_to_stack", "Hand Pushed", `${result.pushed} cards pushed to stack, depth now ${result.stackDepth}`);
        narrate("HAND_PUSHED_TO_STACK");
      }
      const desc = describeDeck();
      setMessages((prev) => [...prev, { role: "assistant", text: desc }]);
      setMuthurMemory((current) => recordMuthurMemoryTurn(current, userMessage, desc));
      setIsStreaming(false);
      return;
    }

    if (detectExecDeckExecuteIntent(userMessage)) {
      openDeck();
      const result = attemptExecute();
      useCyberdeckTabStore.getState().setServer(safeServerId("ct") as (typeof SERVER_IDS)[number]);
      useCyberdeckTabStore.getState().setActiveCustomTabId(null);
      if (!result.success && isObserving()) {
        recordEvent("execution_attempt_blocked", "Execute Blocked", result.reason);
      }
      narrate("EXECUTION_DISABLED");
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: result.reason },
      ]);
      setIsStreaming(false);
      return;
    }

    if (isTeachingDemoTrigger(userMessage)) {
      void runTeachingDemo();
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: "Starting guided teaching demo. Follow the highlighted regions with your cursor." },
      ]);
      setIsStreaming(false);
      return;
    }

    const runPointerCommand = async (): Promise<boolean> => {
      const text = userMessage.toLowerCase();
      const wantsClear = /\bclear\s+(?:the\s+)?(?:indicator|indicators|pointer|pointers|marker|markers)\b/.test(text);
      const wantsIndicate = /\bindicate\b/.test(text);
      const wantsHighlight = /\bhighlight\b/.test(text);

      if (!wantsClear && !wantsIndicate && !wantsHighlight) return false;

      if (wantsClear) {
        const result = await runComputerUseBridgeAction({ name: "clear_indicators" });
        if (result.success) {
          recordEvent("clear_indicators", "Indicators cleared", userMessage);
        }
        setMessages((prev) => [
          ...prev,
          {
            role: "system",
            text: result.success
              ? "INDICATE_CLEAR // ACTIVE_MARKERS 0"
              : `INDICATE_CLEAR_FAILED // ${result.error ?? "UNKNOWN"}`,
          },
        ]);
        setIsStreaming(false);
        return true;
      }

      const findVisibleTextTarget = (label: string): HTMLElement | null => {
        const candidates = Array.from(
          document.querySelectorAll<HTMLElement>('[data-pointer-target], button, [role="button"], h1, h2, h3, span'),
        );
        return candidates.find((candidate) => {
          if (!candidate.textContent?.toLowerCase().includes(label)) return false;
          const rect = candidate.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0 && rect.bottom >= 0 && rect.right >= 0;
        }) ?? null;
      };

const resolved = resolveUiTarget(userMessage);
      if (!resolved.success) {
        setMessages((prev) => [
          ...prev,
          { role: "system", text: "INDICATE_SKIPPED // TARGET_NOT_RECOGNIZED" },
        ]);
        setIsStreaming(false);
        return true;
      }

      const getTargetElement = (target: CanonicalTarget): HTMLElement | null => {
        switch (target) {
          case "COMMAND_INPUT":
            return messageInputRef.current?.element ?? null;
          case "VOICE_LAB":
            return (
              document.querySelector<HTMLElement>('[data-pointer-target="voice-lab"]') ??
              findVisibleTextTarget("voice lab") ??
              gatewayColumnRef.current
            );
          case "LEFT_CONSOLE":
            return document.querySelector<HTMLElement>('[data-pointer-target="left-console"]') ?? null;
          case "RIGHT_PANEL":
            return document.querySelector<HTMLElement>('[data-pointer-target="right-panel"]') ?? null;
          case "CENTER_STAGE":
            return findVisibleTextTarget("main") ?? null;
          default:
            return null;
        }
      };

      const target = getTargetElement(resolved.target);
      if (!target) {
        setMessages((prev) => [
          ...prev,
          { role: "system", text: `INDICATE_SKIPPED // TARGET_NOT_VISIBLE // ${resolved.target}` },
        ]);
        setIsStreaming(false);
        return true;
      }

      const rect = target.getBoundingClientRect();
      const position = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };
      const result = await runComputerUseBridgeAction({
        name: wantsHighlight ? "indicate_highlight" : "indicate_point",
        params: {
          position,
          width: Math.max(48, Math.min(rect.width, 420)),
          height: Math.max(32, Math.min(rect.height, 220)),
          label: resolved.target === "VOICE_LAB" ? "Voice Lab" : "Command input",
          ttlMs: 30_000,
        },
      });
      if (result.success) {
        const actionType = wantsHighlight ? "indicate_highlight" : "indicate_point";
        recordEvent(actionType, resolved.target, userMessage);
      }
      setMessages((prev) => [
        ...prev,
        {
          role: "system",
          text: result.success
            ? `INDICATE_${wantsHighlight ? "HIGHLIGHT" : "POINT"} // ${resolved.target}`
            : `INDICATE_FAILED // ${result.error ?? "UNKNOWN"}`,
        },
      ]);
      setIsStreaming(false);
      return true;
    };

    if (await runPointerCommand()) {
      return;
    }
    }

    const browserCommand =
      parseBrowserCommand(userMessage) ||
      (operatorSurfaceMode === "browser" ? parseBrowserUseModeCommand(userMessage) : null);
    if (browserCommand) {
      const actionResult = await performBrowserCommand(browserCommand);
      const engineMatch = actionResult.match(/ENGINE:\s*([A-Z0-9_ -]+)/i);
      if (engineMatch?.[1]) {
        setOperatorBrowserEngine(engineMatch[1].trim().toUpperCase().replace(/\s+/g, "_"));
      }
      const captchaBlocked = looksLikeCaptchaBlock(actionResult) || actionResult.includes("CAPTCHA_BLOCKED");
      setMessages((prev) => [
        ...prev,
        {
          role: "system",
          text:
            captchaBlocked
              ? `BROWSER_BLOCKED // CAPTCHA // MANUAL_COMPLETION_REQUIRED\n${actionResult}`
              : browserCommand.kind === "snapshot"
                ? `BROWSER_SNAPSHOT // ${actionResult}`
                : `BROWSER_ACTION // ${browserCommand.kind.toUpperCase()} // ${actionResult}`,
        },
      ]);
      setIsStreaming(false);
      return;
    }

    // Gateway key registration (weyland: set key + LS, model fetch effect validates)
    if (!hasProviderAuth) {
      handleModelLabelClick("s");
      setProviderKeys((prev) => ({ ...prev, [activeProvider]: userMessage }));
      try {
        localStorage.setItem(`key_${activeProvider}`, userMessage);
      } catch {
        /* ignore */
      }
      setMessages((prev) => [
        ...prev,
        { role: "system", text: `KEY FOR ${activeProvider.toUpperCase()} REGISTERED // VALIDATING_LINK` },
      ]);
      void fetchModelsForProvider(activeProvider, { force: true });
      setIsStreaming(false);
      return;
    }

    if (!modelID) {
      handleModelLabelClick("s");
      setMessages((prev) => [
        ...prev,
        { role: "system", text: "NO_MODEL_SELECTED // WAIT_FOR_MODELS_OR_CHECK_KEY" },
      ]);
      setIsStreaming(false);
      return;
    }

    let browserContextForRequest =
      operatorSurfaceMode === "browser" ? operatorBrowserSnapshot || `URL: ${operatorBrowserUrl}` : "";
    if (looksLikeOperatorWebIntent(userMessage)) {
      browserContextForRequest =
        (await openOperatorBrowser(deriveOperatorBrowserUrl(userMessage))) ||
        browserContextForRequest ||
        `URL: ${operatorBrowserUrl}`;
    }

    let uplinkTimedOut = false;
    try {
      const abortCtl = new AbortController();
      chatAbortRef.current = abortCtl;
      const uplinkTimeout = window.setTimeout(() => {
        uplinkTimedOut = true;
        abortCtl.abort();
      }, CHAT_UPLINK_TIMEOUT_MS);
      const memoryContext = buildMuthurMemoryContext(muthurMemoryRef.current, userMessage);
      const history = buildCyberdeckChatHistory(messages);
      const latestAssistantMessage =
        [...messages].reverse().find((message) => message.role === "assistant")?.text || "";
      const glyphContext = await buildGlyphContextSnapshot();
      let res: Response;
      try {
        res = await fetch("/api/cyberdeck-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: abortCtl.signal,
          body: JSON.stringify({
            message: userMessage,
            provider: activeProvider,
            apiKey: providerKeys[activeProvider] || "",
            model: modelID,
            memoryContext,
            browserContext: browserContextForRequest,
            glyphContext,
            history,
          }),
        });
      } finally {
        window.clearTimeout(uplinkTimeout);
      }

      if (!res.ok) {
        let rawDetail = "";
        try {
          const ct = res.headers.get("content-type") || "";
          if (ct.includes("application/json")) {
            const payload = (await res.json()) as { error?: string; message?: string };
            rawDetail = String(payload?.error || payload?.message || "").trim();
          } else {
            rawDetail = (await res.text()).trim();
          }
        } catch {
          /* ignore parse errors */
        }
        const detail = formatUplinkErrorDetail(res.status, rawDetail);
        const statusLine = `API error ${res.status}`;
        throw new Error(detail ? `${statusLine}: ${detail}` : statusLine);
      }

      const muthurToolsHeader = res.headers.get("x-muthur-tools-used")?.trim() ?? "";
      setStreamToolTrace(muthurToolsHeader);

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = "";
      let streamDisplayText = "";
      let streamFlushRaf = 0;

      const flushStreamDisplay = () => {
        streamFlushRaf = 0;
        setStreamText(streamDisplayText);
      };

      const scheduleStreamFlush = () => {
        if (streamFlushRaf !== 0) return;
        streamFlushRaf = window.requestAnimationFrame(flushStreamDisplay);
      };

      if (reader) {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          fullText += chunk;
          streamDisplayText = fullText.replace(/^=+\s*$/gm, "").replace(/^=+$\n?/g, "");
          scheduleStreamFlush();
        }
      }

      if (streamFlushRaf !== 0) {
        window.cancelAnimationFrame(streamFlushRaf);
        streamFlushRaf = 0;
      }
      setStreamText(streamDisplayText);

      const allowBrowserDirective =
        ENABLE_AUTOMATION &&
        looksLikeAffirmativeReply(userMessage) &&
        looksLikeBrowserSearchOffer(latestAssistantMessage);

      const assistantBrowserCommand = allowBrowserDirective
        ? extractAssistantBrowserCommand(fullText)
        : null;
      if (assistantBrowserCommand) {
        const actionResult = await performBrowserCommand(assistantBrowserCommand);
        const engineMatch = actionResult.match(/ENGINE:\s*([A-Z0-9_ -]+)/i);
        if (engineMatch?.[1]) {
          setOperatorBrowserEngine(engineMatch[1].trim().toUpperCase().replace(/\s+/g, "_"));
        }
        setMessages((prev) => [
          ...prev,
          {
            role: "system",
            text: `BROWSER_ACTION // ${assistantBrowserCommand.kind.toUpperCase()} // ${actionResult}`,
          },
        ]);
        setMuthurMemory((current) => recordMuthurMemoryTurn(current, userMessage, actionResult));
        setStreamText("");
        return;
      }

      // Clean up fullText - remove excessive === lines and trim
      const glyphResponse = parseGlyphResponseActions(fullText);
      const cleanedText = glyphResponse.displayText
        .replace(/^=+$\n?/g, "")
        .trim();

      const legacyAction = parseLegacyToolJson(cleanedText);
      if (legacyAction && !cleanedText.includes("[EXEC:")) {
        setMessages((prev) => [
          ...prev,
          {
            role: "system",
            text: `⚡ EXECUTION // ${legacyAction.type.toUpperCase()} // QUEUED`,
          },
        ]);
        setIsStreaming(true);
        setStreamText("⚡ Running execution loop…");

        try {
          const execData = await enqueueMuthurActions([legacyAction], {
            wait: true,
            mode: "execute",
            taskLabel: "legacy-json-tool",
          });
          const results = Array.isArray(execData.results) ? execData.results : [];
          const first = results[0] as
            | {
                status?: string;
                type?: string;
                payload?: Record<string, unknown>;
                result?: {
                  success: boolean;
                  stdout?: string;
                  stderr?: string;
                  exit_code?: number;
                  duration_ms: number;
                };
                error?: string;
              }
            | undefined;

          if (!first) {
            setMessages((prev) => [
              ...prev,
              {
                role: "assistant",
                text: "EXECUTION BLOCKED // Action requires operator approval.",
              },
            ]);
            setStreamText("");
            setIsStreaming(false);
            return;
          }

          const toolResultMessage = formatActionResultForChat({
            type: first.type ?? legacyAction.type,
            payload: first.payload ?? legacyAction.payload,
            status: first.status ?? "unknown",
            result: first.result,
            error: first.error,
          });

          if (!ENABLE_AUTOMATION) {
            setMessages((prev) => [
              ...prev,
              { role: "assistant", text: toolResultMessage },
            ]);
          } else {
            const reviewRes = await fetch("/api/cyberdeck-chat", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                message: `A tool was executed via the MUTHUR execution loop. Give a brief summary.\n\n${toolResultMessage}`,
                provider: activeProvider,
                apiKey: providerKeys[activeProvider] || "",
                model: modelID,
                memoryContext: "",
                browserContext: "",
                history: [],
              }),
            });

            if (reviewRes.ok) {
              const reader = reviewRes.body?.getReader();
              if (reader) {
                const decoder = new TextDecoder();
                let finalSummary = "";
                while (true) {
                  const { done, value } = await reader.read();
                  if (done) break;
                  finalSummary += decoder.decode(value, { stream: true });
                }
                const cleanSummary = finalSummary.replace(/^=+\s*$/gm, "").replace(/^=+$\n?/g, "").trim();
                setMessages((prev) => [
                  ...prev,
                  { role: "assistant", text: cleanSummary },
                ]);
              }
            } else {
              setMessages((prev) => [
                ...prev,
                { role: "assistant", text: toolResultMessage },
              ]);
            }
          }
        } catch (e) {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", text: `EXECUTION FAILED: ${(e as Error).message}` },
          ]);
        }

        setStreamText("");
        setIsStreaming(false);
        return;
      }
      
      setMessages((prev) => [...prev, { role: "assistant", text: cleanedText }]);
      setMuthurMemory((current) => recordMuthurMemoryTurn(current, userMessage, fullText));

      if (glyphResponse.actions.length > 0) {
        try {
          await applyGlyphActionsFromMuthur(glyphResponse.actions);
          setMessages((prev) => [
            ...prev,
            {
              role: "system",
              text: `⟁ GLYPH // ${glyphResponse.actions.length} directive(s) applied to ASCII pane`,
            },
          ]);
        } catch (err) {
          setMessages((prev) => [
            ...prev,
            {
              role: "system",
              text: `⟁ GLYPH // FAILED // ${err instanceof Error ? err.message : "Glyph directive failed"}`,
            },
          ]);
        }
      }
      
      // Check for MUTHUR exec commands like [EXEC: typecheck] or [EXEC: read path=src/app/page.tsx]
      const execMatch = fullText.match(/\[EXEC:(\w+)(?:\s+(.*))?\]/i);
      if (execMatch) {
        const command = execMatch[1].toLowerCase();
        
        const args: Record<string, string> = {};
        if (execMatch[2]) {
          execMatch[2].split(" ").forEach(part => {
            const [key, val] = part.split("=");
            if (key && val) args[key] = val;
          });
        }
        try {
          const execRes = await fetch("/api/muthur-command", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ command, args }),
          });
          const execResult = await execRes.json();
          setMessages((prev) => [
            ...prev,
            { role: "system", text: `⚡ EXEC[${command.toUpperCase()}] // ${JSON.stringify(execResult).slice(0, 200)}` },
          ]);
        } catch (e) {
          setMessages((prev) => [
            ...prev,
            { role: "system", text: `⚡ EXEC[${command.toUpperCase()}] // ERROR: ${(e as Error).message}` },
          ]);
        }
      }
      
      setStreamText("");

      if (activeProvider && modelID) {
        setVerifiedProviders((prev) => ({ ...prev, [activeProvider]: true }));
        setModelHealth(activeProvider, modelID, "green");
        setModelFetchStatusByProvider((prev) => ({ ...prev, [activeProvider]: "ready" }));
        setRateLimitedProviders((prev) => {
          const next = new Set(prev);
          next.delete(activeProvider);
          return next;
        });
      }

      try {
        const jsonMatch = fullText.match(/^\{[\s\S]*\}$/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.type === "providers") {
            const providersList = parsed.data
              .map(
                (p: { id: string; name: string; description: string; status: string }) =>
                  `${p.name} (${p.status}) - ${p.description}`,
              )
              .join("\n");
            setGeneratedUI(`[PROVIDERS]\n\n${providersList}`);
            return;
          }
          if (parsed.type === "models") {
            const modelsList = parsed.data
              .map(
                (m: { id: string; name: string; provider: string; status: string }) =>
                  `${m.name} [${m.provider}] - ${m.status}`,
              )
              .join("\n");
            setGeneratedUI(`[AVAILABLE MODELS]\n\n${modelsList}`);
            return;
          }
          if (parsed.type === "status") {
            const { provider, model, connection, memory } = parsed.data;
            setGeneratedUI(
              `[CONNECTION STATUS]\n\nProvider: ${provider}\nModel: ${model}\nStatus: ${connection}\nMemory: ${memory}`,
            );
            return;
          }
        }
      } catch {
        /* not JSON */
      }

      if (fullText.includes("[UI]")) {
        const uiMatch = fullText.match(/\[UI\]([\s\S]*?)\[\/UI\]/);
        if (uiMatch) setGeneratedUI(uiMatch[1].trim());
      }
    } catch (err) {
      const msg = String(err);
      if (msg.includes("AbortError")) {
        setMessages((prev) => [
          ...prev,
          {
            role: "system",
            text: uplinkTimedOut
              ? "UPLINK_TIMEOUT // PROVIDER_OR_NETWORK // OPERATOR_ACTION_REQUIRED"
              : "REQUEST_ABORTED // STREAM_HALTED",
          },
        ]);
        setStreamText("");
        return;
      }
      if (msg.includes("timed out")) {
        setMessages((prev) => [
          ...prev,
          {
            role: "system",
            text: "UPLINK_TIMEOUT // PROVIDER_OR_NETWORK // OPERATOR_ACTION_REQUIRED",
          },
        ]);
        setStreamText("");
        return;
      }
      if (msg.includes("API error")) {
        playDeckWrongDoorShut();
        const status = msg.match(/API error\s+(\d{3})/i)?.[1] || "UNKNOWN";
        const modelLabel = modelID || "UNSET_MODEL";
        const haltStatuses = new Set(["429", "502", "503"]);
        if (haltStatuses.has(status)) {
          if (status === "429") {
            providerRateLimitUntilRef.current[activeProvider] = Date.now() + PROVIDER_RATE_LIMIT_COOLDOWN_MS;
          } else {
            setRateLimitedProviders((prev) => new Set(prev).add(activeProvider));
          }
        }
        const hint =
          status === "401" || status === "403"
            ? "CHECK_API_KEY"
            : status === "429"
              ? "RATE_LIMIT // OPERATOR_ACTION_REQUIRED"
              : status === "500"
                ? "UPLINK_INTERNAL_ERROR // CHECK_DEV_TERMINAL // RETRY"
              : status === "502" || status === "503"
                ? "PROVIDER_UNAVAILABLE // OPERATOR_ACTION_REQUIRED"
                : "CHECK_PROVIDER_MODEL_OR_NETWORK";
        setMessages((prev) => [
          ...prev,
          {
            role: "system",
            text: `API_FAILURE // ${activeProvider.toUpperCase()} / ${modelLabel} // HTTP_${status} // ${hint}`,
          },
        ]);
        setStreamText("");
        return;
      }
      setMessages((prev) => [...prev, { role: "error", text: msg.slice(0, 280) }]);
    } finally {
      chatAbortRef.current = null;
      setStreamToolTrace("");
      setIsStreaming(false);
    }
  };

  const handleStop = useCallback(() => {
    abortMotherSpeech();
    void loadComputerUse().then((cu) => {
      cu.emergencyStop();
      cu.cancelTeachingWatchdog();
    });
    if (chatAbortRef.current) {
      chatAbortRef.current.abort();
    }
    setIsStreaming(false);
  }, [abortMotherSpeech]);

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
      gatewayConnectionPanelRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    } else {
      gatewayBlankSettingsRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    }
  }, [activeProvider, modelID]);

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

  useEffect(() => {
    if (!ENABLE_AUTOMATION) return;
    if (!didHydrateProviderState || startupRailResolvedRef.current) return;
    if (hasProviderAuth) {
      useCyberdeckTabStore.getState().setActiveCustomTabId(null);
      useCyberdeckTabStore.getState().setServer("m");
      startupRailResolvedRef.current = true;
      return;
    }
    if (connectionState === "offline") {
      handleModelLabelClick("s");
      offlineAutoOpenedRef.current = true;
      startupRailResolvedRef.current = true;
    }
  }, [connectionState, didHydrateProviderState, handleModelLabelClick, hasProviderAuth]);

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

    if (didHydrateProviderState && connectionState === "offline" && !offlineAutoOpenedRef.current && !hasProviderAuth) {
      handleModelLabelClick("s");
      offlineAutoOpenedRef.current = true;
      return;
    }
    if (connectionState !== "offline") {
      offlineAutoOpenedRef.current = false;
    }
  }, [activeProvider, connectionState, didHydrateProviderState, handleModelLabelClick, hasProviderAuth, modelID]);

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

  const handleOperatorDragOver = useCallback((e: ReactDragEvent<HTMLDivElement>) => {
    if (serverRef.current !== "m") return;
    e.preventDefault();
    setIsOperatorDragOver(true);
  }, []);

  const handleOperatorDragLeave = useCallback((e: ReactDragEvent<HTMLDivElement>) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsOperatorDragOver(false);
  }, []);

  const handleOperatorDrop = useCallback(async (e: ReactDragEvent<HTMLDivElement>) => {
    const activeServer = serverRef.current;
    if (activeServer !== "m") return;

    e.preventDefault();
    setIsOperatorDragOver(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      const dropPath = `drop://${file.name}#${file.lastModified}`;
      await openOperatorFile(dropPath, () => loadOperatorAssetFromFile(file));
      return;
    }

    const uriList = e.dataTransfer.getData("text/uri-list");
    if (uriList) {
      const uris = uriList.split("\n").filter((u) => u.trim() && !u.startsWith("#"));
      if (uris.length > 0) {
        const uri = uris[0];
        if (uri.startsWith("file://")) {
          const filePath = uri.startsWith("file:///")
            ? uri.slice(8)
            : uri.startsWith("file://localhost/")
              ? uri.slice("file://localhost".length)
              : uri.slice(7);
          try {
            const response = await fetch(uri);
            if (response.ok) {
              const blob = await response.blob();
              const fileName = filePath.split("/").pop() || "dropped-image";
              const droppedFile = new File([blob], fileName, { type: blob.type || "image/png" });
              await loadOperatorAssetFromFile(droppedFile);
              return;
            }
          } catch {
            // fallback: try reading as text path
          }
        }
      }
    }

    const textPath = e.dataTransfer.getData("text/plain");
    if (textPath && textPath.startsWith("/")) {
      try {
        const response = await fetch(`file://${textPath}`);
        if (response.ok) {
          const blob = await response.blob();
          const fileName = textPath.split("/").pop() || "dropped-image";
          const droppedFile = new File([blob], fileName, { type: blob.type || "image/png" });
          await loadOperatorAssetFromFile(droppedFile);
          return;
        }
      } catch {
        // ignore
      }
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
      if (nextKind === "document") {
        const sourceTab = useCyberdeckTabStore.getState().customTabs.find((t) => t.id === tabId);
        const sourceAsset = sourceTab?.asset as DroppedOperatorAsset | null | undefined;
        flushSync(() => {
          if (sourceAsset) {
            operatorKindManualRef.current = false;
            setOperatorDroppedAsset(sourceAsset);
            setOperatorDocNameDraft(sourceAsset.name);
            setOperatorSurfaceMode("workspace");
            setOperatorDocMode("view");
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
    [updateCustomTab],
  );


  const customTabBrowserNavigate = useCallback(
    (tabId: string, nextUrl: string) => {
      const normalizedUrl = normalizeOperatorBrowserUrl(nextUrl);
      updateCustomTab(tabId, (tab) => ({
        ...tab,
        kind: "web",
        browserUrl: normalizedUrl,
        asset: undefined,
      }));
    },
    [updateCustomTab],
  );

  const loadCustomTabAssetFromFile = useCallback(
    async (tabId: string, file: File) => {
      const kind = getOperatorFileKind(file);
      const baseAsset: DroppedOperatorAsset = {
        kind,
        name: file.name,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
      };

      let nextAsset = baseAsset;
      if (kind === "image") {
        try {
          const imageSrc = await readFileAsDataUrl(file);
          nextAsset = { ...baseAsset, imageSrc };
        } catch {
          nextAsset = baseAsset;
        }
      } else if (kind === "markdown" || kind === "code" || kind === "text" || kind === "json") {
        try {
          const text = await file.text();
          nextAsset = { ...baseAsset, text };
        } catch {
          nextAsset = baseAsset;
        }
      }

      updateCustomTab(tabId, (tab) => ({
        ...tab,
        kind: "document",
        asset: nextAsset,
        browserUrl: undefined,
      }));
      useCyberdeckTabStore.getState().setActiveCustomTabId(tabId);
      setNavRailContext("tabs");
      setMessages((prev) => [
        ...prev,
        { role: "system", text: `TAB_WORKSPACE // ${file.name} // DOCUMENT` },
      ]);
    },
    [updateCustomTab],
  );

  const handleCustomTabDrop = useCallback(
    async (e: ReactDragEvent<HTMLDivElement>, tabId: string) => {
      e.preventDefault();
      e.stopPropagation();
      const file = e.dataTransfer.files?.[0];
      if (!file) return;
      await loadCustomTabAssetFromFile(tabId, file);
    },
    [loadCustomTabAssetFromFile],
  );

  const openRailTabContextMenu = useCallback(
    (tabId: string, clientX: number, clientY: number) => {
      if (getCyberdeckSelectedRailTabId() !== tabId || typeof window === "undefined") return;
      closeMirageContextMenu();
      closeGatewayPaneContextMenu();

      const menuWidth = 176;
      const menuHeight = isFixedServerTabId(tabId) ? 132 : 520;
      const padding = 8;
      const x = Math.min(clientX, Math.max(padding, window.innerWidth - menuWidth - padding));
      const y = Math.min(clientY, Math.max(padding, window.innerHeight - menuHeight - padding));

      setRailTabContextMenu(
        isFixedServerTabId(tabId)
          ? { variant: "fixed", serverId: tabId, x, y }
          : { variant: "custom", tabId, x, y },
      );
    },
    [closeGatewayPaneContextMenu, closeMirageContextMenu],
  );

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

  const openOrFocusModuleTab = useCallback(
    (target:
      | "memory-atlas"
      | "catalog"
      | "operators"
      | "flight-log"
      | "voice-lab"
      | "glyph-channel"
      | "rola-dex"
      | "sound-profile"
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
        target !== "sound-profile" &&
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

  useEffect(() => {
    if (!railTabContextMenu) return;
    if (railTabContextMenu.variant !== "custom") return;
    return useCyberdeckTabStore.subscribe((state) => {
      if (state.activeCustomTabId !== railTabContextMenu.tabId) {
        closeRailTabContextMenu();
      }
    });
  }, [closeRailTabContextMenu, railTabContextMenu]);

  useEffect(() => {
    if (!railTabContextMenu) return;
    if (railTabContextMenu.variant !== "fixed") return;
    return useCyberdeckTabStore.subscribe((state) => {
      const selected = state.activeCustomTabId ?? state.server;
      if (railTabContextMenu.serverId !== selected) {
        closeRailTabContextMenu();
      }
    });
  }, [closeRailTabContextMenu, railTabContextMenu]);

  useEffect(() => {
    if (operatorSurfaceMode !== "browser") return;
    const view = operatorBrowserRef.current;
    if (!view) return;

    const syncSnapshot = () => {
      void captureOperatorBrowserSnapshot();
    };

    view.addEventListener("dom-ready", syncSnapshot as EventListener);
    view.addEventListener("did-stop-loading", syncSnapshot as EventListener);
    view.addEventListener("page-title-updated", syncSnapshot as EventListener);
    syncSnapshot();

    return () => {
      view.removeEventListener("dom-ready", syncSnapshot as EventListener);
      view.removeEventListener("did-stop-loading", syncSnapshot as EventListener);
      view.removeEventListener("page-title-updated", syncSnapshot as EventListener);
    };
  }, [captureOperatorBrowserSnapshot, operatorSurfaceMode, operatorBrowserUrl]);

  useEffect(() => {
    if (!railTabContextMenu && !mirageContextMenu && !gatewayPaneContextMenu) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeRailTabContextMenu();
        closeMirageContextMenu();
        closeGatewayPaneContextMenu();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    closeGatewayPaneContextMenu,
    closeMirageContextMenu,
    closeRailTabContextMenu,
    gatewayPaneContextMenu,
    mirageContextMenu,
    railTabContextMenu,
  ]);

  const renderCustomTabSurface = useCallback(
    (tab: CustomTab) => {
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
              <CyberdeckWebTabFrame
                key={webUrl}
                url={webUrl}
                webviewRef={operatorBrowserRef}
              />
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
            onVoiceToggle={toggleVoiceEnabled}
            deckMode={deckMode}
            onDeckModeToggle={toggleDeckMode}
            audioMuted={audioMuted}
            onAudioMuteToggle={toggleAudioMuted}
            identity={identity}
          />,
        );
      }

      if (tab.kind === "connection") {
        return shell(
          <div className="grid flex-1 gap-3 overflow-auto p-3">
            <div className="rounded-sm border border-[#1c1c1c] bg-black/80 p-3 font-mono text-[10px] leading-snug text-[#8a8a8a]">
              CONNECTION TAB // STATUS
              <div className="mt-2 text-[#cfcfcf]">
                STATE: {connectionState.toUpperCase()}
                <br />
                PROVIDER: {activeProvider.toUpperCase()}
                <br />
                MODEL: {modelID || "UNSET"}
              </div>
            </div>
          </div>,
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
            heapCount={heapEntries.length}
            chatCount={messages.length + (streamText ? 1 : 0)}
          />,
        );
      }

      if (tab.kind === "pi") {
        return shell(<ActivatedCyberdeckPane kind="pi" server={server} />);
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
          <ActivatedCyberdeckPane
            kind="voice-lab"
            voiceEnabled={voiceEnabled}
            onVoiceToggle={toggleVoiceEnabled}
          />,
        );
      }

      if (tab.kind === "flight-log") {
        return shell(<ActivatedCyberdeckPane kind="flight-log" />);
      }

      if (tab.kind === "drop-bay") {
        return shell(<ActivatedCyberdeckPane kind="drop-bay" />);
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

      if (tab.kind === "sound-profile") {
        return (
          <div
            className="flex h-full min-h-0 min-w-0 w-full max-w-full flex-1 flex-col overflow-hidden bg-black"
            data-pointer-target="sound-profile"
          >
            <ActivatedCyberdeckPane kind="sound-profile" />
          </div>
        );
      }

      return shell(
        <div className="flex min-h-0 flex-1 items-center justify-center p-6 font-mono text-[10px] tracking-[0.08em] text-[#8a8a8a]">
          BLANK TAB // USE CHAT COMMANDS TO CONVERT TO DOCUMENT, WEB, CATALOG, OPERATORS, MEMORY-ATLAS, VOICE-LAB, FLIGHT-LOG, GLYPH-CHANNEL, ROLA-DEX, SOUND-PROFILE, SETTINGS, CONNECTION, DIAGNOSTICS, OR PI.
        </div>,
      );
    },
    [
      activeProvider,
      connectionState,
      customTabBrowserNavigate,
      handleCustomTabDrop,
      heapEntries.length,
      messages,
      messages.length,
      modelID,
      muthurMemory,
      muthurMemoryHydrated,
      muthurMemoryLoadError,
      operatorBrowserEngine,
      providerModelFetchStatus,
      streamText,
      toggleDeckMode,
      toggleVoiceEnabled,
      updateCustomTab,
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
      <CyberdeckBootSequence />
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
      <CyberdeckCustomTabBrowserSync
        operatorBrowserRef={operatorBrowserRef}
        updateCustomTab={updateCustomTab}
      />
      <LazyIndicateOverlay />
      {railTabContextMenu || mirageContextMenu || gatewayPaneContextMenu ? (
        <div
          className="fixed inset-0 z-[90]"
          onContextMenu={(event) => {
            event.preventDefault();
            event.stopPropagation();
            closeRailTabContextMenu();
            closeMirageContextMenu();
            closeGatewayPaneContextMenu();
          }}
          onPointerDown={() => {
            closeRailTabContextMenu();
            closeMirageContextMenu();
            closeGatewayPaneContextMenu();
          }}
        >
          {railTabContextMenu ? (
          <div
            role="menu"
            aria-label={
              railTabContextMenu.variant === "fixed" ? "Fixed server tab actions" : "Tab actions"
            }
            className="absolute max-h-[70vh] min-w-44 overflow-y-auto rounded border border-[#2d2d2d] bg-black/95 p-1 shadow-[0_12px_30px_rgba(0,0,0,0.65)]"
            style={{ left: railTabContextMenu.x, top: railTabContextMenu.y }}
            onPointerDown={(event) => event.stopPropagation()}
            onContextMenu={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
          >
            {railTabContextMenu.variant === "fixed" ? (
              <>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    const id = railTabContextMenu.serverId;
                    closeRailTabContextMenu();
                    focusFixedServerPanel(id);
                  }}
                  className={realmorphismMenuItemClass(deckMode)}
                >
                  {railTabContextMenu.serverId === "m"
                    ? "Focus operator panel"
                    : railTabContextMenu.serverId === "s"
                      ? "Focus connection panel"
                      : railTabContextMenu.serverId === "ct"
                        ? "Focus card table"
                        : "Focus settings panel"}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    const id = railTabContextMenu.serverId;
                    closeRailTabContextMenu();
                    void navigator.clipboard
                      .writeText(id)
                      .then(() => toast.success(`Copied server id: ${id}`))
                      .catch(() => toast.error("Could not copy."));
                  }}
                  className={realmorphismMenuItemClass(deckMode)}
                >
                  Copy server id
                </button>
                <div className="my-1 h-px bg-[#232323]" />
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    closeRailTabContextMenu();
                    openRealmorphismKitTab();
                  }}
                  className={realmorphismMenuItemClass(deckMode)}
                >
                  Open Realmorphism kit
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    const id = railTabContextMenu.tabId;
                    closeRailTabContextMenu();
                    openRealmorphismKitTab(id);
                  }}
                  className={realmorphismMenuItemClass(deckMode)}
                >
                  Open Realmorphism kit
                </button>
                <div className="my-1 h-px bg-[#232323]" />
                {CUSTOM_TAB_CONTEXT_MENU_ACTIONS.map((action) =>
                  action.action === "convert" ? (
                    <button
                      key={action.label}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        convertCustomTab(railTabContextMenu.tabId, action.kind);
                        closeRailTabContextMenu();
                      }}
                      className={realmorphismMenuItemClass(deckMode)}
                    >
                      {action.label}
                    </button>
                  ) : action.action === "settings-pane" ? (
                    <button
                      key="settings-pane"
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        closeRailTabContextMenu();
                        handleModelLabelClick("b");
                      }}
                      className={realmorphismMenuItemClass(deckMode)}
                    >
                      {action.label}
                    </button>
                  ) : action.action === "kit-pane" ? (
                    <button
                      key="kit-pane"
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        const id = railTabContextMenu.tabId;
                        closeRailTabContextMenu();
                        openRealmorphismKitTab(id);
                      }}
                      className={realmorphismMenuItemClass(deckMode)}
                    >
                      {action.label}
                    </button>
                  ) : (
                    <button
                      key="connection-pane"
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        closeRailTabContextMenu();
                        handleModelLabelClick("s");
                      }}
                      className={realmorphismMenuItemClass(deckMode)}
                    >
                      {action.label}
                    </button>
                  ),
                )}
                <div className="my-1 h-px bg-[#232323]" />
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    deleteActiveTab();
                    closeRailTabContextMenu();
                  }}
                  className={realmorphismMenuItemClass(deckMode, true)}
                >
                  Delete
                </button>
              </>
            )}
          </div>
          ) : mirageContextMenu ? (
            <div
              role="menu"
              aria-label="Mirage chat actions"
              className="absolute min-w-44 rounded border border-[#2d2d2d] bg-black/95 p-1 shadow-[0_12px_30px_rgba(0,0,0,0.65)]"
              style={{ left: mirageContextMenu.x, top: mirageContextMenu.y }}
              onPointerDown={(event) => event.stopPropagation()}
              onContextMenu={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  closeMirageContextMenu();
                  replayFullLastAssistant();
                }}
                className={realmorphismMenuItemClass(deckMode)}
              >
                Speak last message
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  closeMirageContextMenu();
                  void copyMirageLastAssistant();
                }}
                className={realmorphismMenuItemClass(deckMode)}
              >
                Copy last assistant message
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  closeMirageContextMenu();
                  void copyMirageSelectionOrLastMessage();
                }}
                className={realmorphismMenuItemClass(deckMode)}
              >
                Copy selection or last message
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  closeMirageContextMenu();
                  handleModelLabelClick("b");
                }}
                className={realmorphismMenuItemClass(deckMode)}
              >
                Open Settings
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  closeMirageContextMenu();
                  handleModelLabelClick("s");
                }}
                className={realmorphismMenuItemClass(deckMode)}
              >
                Open connection panel
              </button>
            </div>
          ) : gatewayPaneContextMenu ? (
            <div
              role="menu"
              aria-label="Gateway pane actions"
              className="absolute min-w-44 rounded border border-[#2d2d2d] bg-black/95 p-1 shadow-[0_12px_30px_rgba(0,0,0,0.65)]"
              style={{ left: gatewayPaneContextMenu.x, top: gatewayPaneContextMenu.y }}
              onPointerDown={(event) => event.stopPropagation()}
              onContextMenu={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  closeGatewayPaneContextMenu();
                  void copyMirageSelectionOrLastMessage();
                }}
                className={realmorphismMenuItemClass(deckMode)}
              >
                Copy selection or last message
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  closeGatewayPaneContextMenu();
                  handleModelLabelClick("b");
                }}
                className={realmorphismMenuItemClass(deckMode)}
              >
                Open Settings
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  closeGatewayPaneContextMenu();
                  handleModelLabelClick("s");
                }}
                className={realmorphismMenuItemClass(deckMode)}
              >
                Open connection panel
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  closeGatewayPaneContextMenu();
                  openOrFocusDiagnosticsTab();
                }}
                className={realmorphismMenuItemClass(deckMode)}
              >
                Open Diagnostics tab
              </button>
            </div>
) : null
            }
          </div>
      ) : null}
      <CyberdeckServerRail
        railRef={serverRailRef}
        fixedServers={fixedServers}
        navRailContext={navRailContext}
        serverKeyboardHighlightId={serverKeyboardHighlightId}
        railGlyphForServer={railGlyphForServer}
        railGlyphForCustomTab={(tab) => railGlyphForCustomTab(tab as CustomTab)}
        onTabClick={handleTabClick}
        onCreateBlankTab={createBlankTab}
        onRailContextMenu={handleRailTabContextMenu}
        createRailTabLongPressHandlers={createRailTabLongPressHandlers}
        consumeClickIfLongPress={consumeClickIfLongPress}
        onPointerNavReset={() => {
          setNavRailContext("gateway");
          setServerKeyboardHighlightId(null);
        }}
      />

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden" data-morphism={MORPHISM_ZONE_REALMORPHISM}>
        <ResizablePanelGroup
          key={isMobileLayout ? "mobile-vertical" : "desktop-horizontal"}
          orientation={isMobileLayout ? "vertical" : "horizontal"}
          memoryKey="cyberdeck-content-split"
          className="h-full min-h-0 min-w-0 flex-1"
        >
          {/* COL 2 (flipped): main terminal / chat — Weyland col3 */}
          <ResizablePanel
            defaultSize={isMobileLayout ? 72 : 55}
            minSize={0}
            className="h-full min-h-0 overflow-hidden"
          >
          <div
            ref={chatColumnRef}
            onContextMenu={handleMiragePaneContextMenu}
            className={`cyberdeck-net-pane cyberdeck-chat-app left flex h-full max-h-full min-h-0 flex-col overflow-hidden border-b border-gray-800 bg-black max-md:flex-1 max-md:min-h-0 md:min-w-0 md:border-b-0 ${
              networkActivityActive ? "is-net-active" : ""
            }`}
          >
            {!isMobileLayout ? (
              <div className="border-b border-[#1a1a1a] px-2 py-1">
                <EchoHeader />
              </div>
            ) : null}
            <div
              ref={messageScrollRef}
              tabIndex={-1}
              className="cyberdeck-chat-content custom-scrollbar flex min-h-0 flex-1 basis-0 flex-col overflow-y-auto p-4 outline-none focus-visible:ring-1 focus-visible:ring-green-500/25"
            >
              {isMobileLayout ? (
                <div className="mb-2">
                  <EchoHeader />
                </div>
              ) : null}
              <div className="message-log space-y-3">
                {messages.map((m, i) => {
                  const isModelConnectedLine =
                    m.role === "system" && typeof m.text === "string" && m.text.includes("MODEL_CONNECTED");
                  const isSystemFailureLine =
                    m.role === "system" &&
                    typeof m.text === "string" &&
                    /(failure|failuer|failed|invalid_key|auth_rejected|uplink_error|api\s*error|http_[45]\d{2}|empty_response|rate_limit)/i.test(
                      m.text,
                    );
                  const isObserveResponse =
                    m.role === "assistant" &&
                    (m.toolTrace?.includes("observe_operator_pane") ||
                      /observe_operator_pane|READ_ONLY_OBSERVATION|Operator panel observed/i.test(m.text));
                  return (
                    <div
                      key={i}
                      data-chat-row={i}
                      className={`nav-row py-1 text-xs ${
                        chatKeyboardHighlightIndex === i ? "nav-row-kb-hover" : ""
                      }`}
                    >
                    <span
                      className={
                        m.role === "user"
                          ? "text-gray-600"
                          : m.role === "assistant"
                            ? "text-green-400"
                            : m.role === "system"
                              ? isModelConnectedLine
                                ? "text-green-400"
                                : isSystemFailureLine
                                  ? "text-red-400"
                                  : "text-amber-400/90"
                              : "text-red-400"
                      }
                    >
                      [
                      {m.role === "user"
                        ? "USR"
                        : m.role === "assistant"
                          ? "AI"
                          : m.role === "system"
                            ? "SYS"
                            : "ERR"}
                      ]{" "}
                    </span>
                    <span
                      className={
                        isModelConnectedLine
                          ? "font-medium text-green-300"
                          : isSystemFailureLine
                            ? "font-medium text-red-300"
                            : "text-gray-300"
                      }
                      style={
                        isModelConnectedLine
                          ? { textShadow: "0 0 10px rgba(34, 197, 94, 0.45)" }
                          : isSystemFailureLine
                            ? { textShadow: "0 0 8px rgba(248, 113, 113, 0.35)" }
                            : undefined
                      }
                    >
                      {m.role === "system" ? (
                        <span className="whitespace-pre-wrap">{renderGatewayMessageText(m.text)}</span>
                      ) : (
                        <>
                          {m.role === "assistant" && m.toolTrace ? (
                            <span className="mb-0.5 block font-mono text-[10px] leading-snug text-amber-500/90">
                              // TOOLS:{" "}
                              {m.toolTrace
                                .split(",")
                                .map((t) => t.trim())
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
                          ) : null}
                          {isObserveResponse ? (
                            <span className="mb-0.5 block font-mono text-[10px] leading-snug text-cyan-300">
                              {OBSERVE_TRANSCRIPT_PREFIX}
                            </span>
                          ) : null}
                          <span className="whitespace-pre-wrap">{m.text}</span>
                        </>
                      )}
                    </span>
                  </div>
                  );
                })}
                {streamText && (
                  <div
                    data-chat-row={messages.length}
                    className={`nav-row py-1 text-xs ${
                      chatKeyboardHighlightIndex === messages.length ? "nav-row-kb-hover" : ""
                    }`}
                  >
                    <span className="text-green-400">[AI] </span>
                    <span className="text-gray-300">
                      {streamToolTrace ? (
                        <span className="mb-0.5 block font-mono text-[10px] leading-snug text-amber-500/90">
                          // TOOLS:{" "}
                          {streamToolTrace
                            .split(",")
                            .map((t) => t.trim())
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      ) : null}
                      {streamToolTrace?.includes("observe_operator_pane") ? (
                        <span className="mb-0.5 block font-mono text-[10px] leading-snug text-cyan-300">
                          {OBSERVE_TRANSCRIPT_PREFIX}
                        </span>
                      ) : null}
                      <span className="text-green-300">{streamText}</span>
                    </span>
                    <span className="animate-pulse">█</span>
                  </div>
                )}
                  {isStreaming && !streamText && (
                    <div
                      data-chat-row={messages.length}
                      className={`nav-row py-1 text-xs text-green-500/90 ${
                        chatKeyboardHighlightIndex === messages.length ? "nav-row-kb-hover" : ""
                      }`}
                    >
                      <span className="cyberdeck-cogitating">
                        <span className="animate-pulse">█</span>
                        <span className="cyberdeck-cogitating-text">⚡ MUTHUR COGITATING...</span>
                      </span>
                    </div>
                  )}
                <div ref={messagesEndRef} />
              </div>
            </div>

            <footer className="cyberdeck-message-box realmorphism-host-surface shrink-0 border-t bg-black p-0">
              <div className="m-2 rounded-sm border border-green-900/70 bg-black transition-colors transition-shadow focus-within:border-green-500/80 focus-within:shadow-[0_0_0_1px_rgba(34,197,94,0.45),0_0_18px_rgba(34,197,94,0.2)]">
                <div className="relative flex items-center px-2 py-2">
                  <span className="pointer-events-none absolute left-3 text-lg font-bold text-green-500">$</span>
                  <MuthurCommandInput
                    ref={messageInputRef}
                    inputHistory={inputHistory}
                    hasProviderAuth={hasProviderAuth}
                    glyphModeActive={glyphModeActive}
                    isStreaming={isStreaming}
                    chatHydrated={chatHydrated}
                    onSubmit={(text) => void handleSend(text)}
                    onCanSendChange={handleCanSendInputChange}
                    onFocusExtra={() => setChatKeyboardHighlightIndex(null)}
                    onPasteImage={handlePasteImageToChat}
                  />
                </div>
                <div className="flex items-center justify-between px-3 py-2">
                  <button
                    type="button"
                    onClick={() => handleModelLabelClick("s")}
                    className={`min-w-0 truncate text-[10px] font-mono ${
                      connectionState === "connected"
                        ? "text-green-300"
                        : connectionState === "connecting"
                          ? "text-amber-300"
                          : "text-gray-500"
                    } cursor-pointer hover:underline`}
                    title="Open provider connection panel"
                  >
                    {modelID
                      ? modelID.split("/").pop()
                      : "NO_MODEL"}{" "}
                    {isStreaming ? "STREAMING" : ""}
                  </button>
                  <div className="flex items-center gap-2">
                    <CyberdeckPaneTooltipProvider delayDuration={300} disableHoverableContent>
                    <CyberdeckControlTooltip label={voiceEnabled ? "Voice on" : "Voice off"}>
                    <button
                      type="button"
                      onClick={toggleVoiceEnabled}
                      aria-label={voiceEnabled ? "Voice on" : "Voice off"}
                      aria-pressed={voiceEnabled && voiceHealth === "backend"}
                      className={voiceControlClass(deckMode, voiceEnabled, voiceHealth)}
                    >
                      {voiceEnabled ? (
                        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" aria-hidden="true">
                          <path
                            d="M5 10V14H8L12 18V6L8 10H5Z"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <path
                            d="M16 9C16.9 9.7 17.5 10.8 17.5 12C17.5 13.2 16.9 14.3 16 15"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                          />
                          <path
                            d="M18.5 7C20 8.3 21 10.1 21 12C21 13.9 20 15.7 18.5 17"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                          />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" aria-hidden="true">
                          <path
                            d="M5 10V14H8L12 18V6L8 10H5Z"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <path d="M15 9L21 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                          <path d="M21 9L15 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                          </svg>
                        )}
                      </button>
                    </CyberdeckControlTooltip>
                    {voiceEnabled && voiceBlockTotal > 0 ? (
                      <>
                        <span
                          className="hidden min-w-[2.5rem] text-right font-mono text-[9px] text-gray-600 sm:inline"
                          title="Paragraph position (◀ = speak one earlier paragraph only)"
                        >
                          {voiceBlockTotal > 1 ? `${voiceBlockFocusIndex + 1}/${voiceBlockTotal}` : `${voiceBlockTotal}`}
                        </span>
                        <CyberdeckControlTooltip label="Stop speech (Esc)" disabled={!voicePlaybackBusy}>
                        <button
                          type="button"
                          onClick={() => abortMotherSpeech()}
                          disabled={!voicePlaybackBusy}
                          aria-label="Stop speech"
                          className={realmorphismControlClass(deckMode, {
                            size: "compact",
                            amber: true,
                            legacyClassName: LEGACY_COMPACT_AMBER,
                          })}
                        >
                          ‖
                        </button>
                        </CyberdeckControlTooltip>
                        <CyberdeckControlTooltip
                          label="Earlier paragraph (more context)"
                          disabled={voiceBlockFocusIndex <= 0}
                        >
                        <button
                          type="button"
                          onClick={() => {
                            if (voiceBlockFocusIndex <= 0) return;
                            const next = voiceBlockFocusIndex - 1;
                            abortMotherSpeech();
                            speakVoiceBlockAtIndex(next);
                          }}
                          disabled={voiceBlockFocusIndex <= 0}
                          aria-label="Speak earlier paragraph"
                          className={realmorphismControlClass(deckMode, {
                            size: "compact",
                            signal: true,
                            legacyClassName: LEGACY_COMPACT_CONTROL,
                          })}
                        >
                          ◀
                        </button>
                        </CyberdeckControlTooltip>
                        <CyberdeckControlTooltip label="Replay entire last reply">
                        <button
                          type="button"
                          onClick={() => {
                            abortMotherSpeech();
                            replayFullLastAssistant();
                          }}
                          aria-label="Replay full response"
                          className={realmorphismControlClass(deckMode, {
                            size: "compact",
                            signal: true,
                            legacyClassName: LEGACY_COMPACT_CONTROL,
                          })}
                        >
                          ↻
                        </button>
                        </CyberdeckControlTooltip>
                      </>
                    ) : null}
                    {!isStreaming ? (
                      <CyberdeckControlTooltip label="Send" disabled={!canSendInput}>
                      <button
                        type="button"
                        onClick={() => void handleSend()}
                        disabled={!canSendInput}
                        aria-label="Send"
                        className={realmorphismControlClass(deckMode, {
                          size: "send",
                          signal: true,
                          legacyClassName: LEGACY_SEND_CONTROL,
                        })}
                      >
                        <svg
                          viewBox="0 0 24 24"
                          width="16"
                          height="16"
                          fill="none"
                          aria-hidden="true"
                          className="h-4 w-4 shrink-0 transform-none transition-[color,opacity] duration-150 ease-out"
                        >
                          <path
                            d="M3 11.5L20.5 3.5L13.5 20.5L11.2 13.8L3 11.5Z"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <path d="M11.3 13.7L20.4 3.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                        </svg>
                      </button>
                      </CyberdeckControlTooltip>
                    ) : (
                      <CyberdeckControlTooltip label="Stop">
                      <button
                        type="button"
                        onClick={handleStop}
                        aria-label="Stop"
                        aria-pressed
                        className={realmorphismControlClass(deckMode, {
                          size: "icon",
                          amber: true,
                          legacyClassName: LEGACY_STOP_CONTROL,
                        })}
                      >
                        <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true">
                          <rect x="6.5" y="6.5" width="11" height="11" rx="1.2" />
                        </svg>
                      </button>
                      </CyberdeckControlTooltip>
                    )}
                    </CyberdeckPaneTooltipProvider>
                  </div>
                </div>
              </div>
            </footer>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle stacked={isMobileLayout} />

        {/* COL 3 (flipped): gateway nav — Weyland col2 */}
        <ResizablePanel
          defaultSize={isMobileLayout ? 28 : 45}
          minSize={isMobileLayout ? 0 : 0.01}
          className="h-full min-h-0"
        >
          <div
            ref={gatewayColumnRef}
            tabIndex={-1}
            aria-label="Gateway"
            onContextMenu={handleGatewayPaneContextMenu}
            onDragOver={handleThirdColumnDragOver}
            onDragLeave={handleThirdColumnDragLeave}
            onDrop={handleThirdColumnDrop}
            className={`cyberdeck-net-pane right flex h-full min-w-0 flex-col border-gray-800 bg-black outline-none focus-visible:ring-2 focus-visible:ring-green-500/35 focus-visible:ring-offset-2 focus-visible:ring-offset-black ${
              networkActivityActive ? "is-net-active" : ""
            } ${isMarkdownDragOver ? "ring-2 ring-amber-500/50 ring-inset" : ""}`}
          >
            <MirageHeader />
            <p className="sr-only">
              Command. Catalog. Operators. Memory Atlas. Voice Lab. Flight Log. ⟁ Glyph. Settings. Craftwerk Cyberdeck
              Corporation. ChatGPT // Lead. Cursor // Dev. Codex // Test. Samus-Manus // Memory. ASCII. REALMORPH.
            </p>
            <div className="mirage-pane-body relative box-border flex min-h-0 min-w-0 w-full max-w-full flex-1 flex-col overflow-hidden ps-2 pe-3">
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
            <CyberdeckGatewaySettingsPane className="custom-scrollbar flex-1 overflow-y-auto bg-black p-4">
                  {droppedMarkdown ? (
                    <div className="mb-4 rounded-sm border border-amber-700/70 bg-black p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <div className="truncate font-mono text-[10px] text-amber-300">
                          MARKDOWN: {droppedMarkdownName || "dropped.md"}
                        </div>
                        <button
                          type="button"
                          className={realmorphismControlClass(deckMode, {
                            size: "action",
                            amber: true,
                            legacyClassName:
                              "rounded border border-amber-700 px-2 py-[2px] font-mono text-[10px] text-amber-300 hover:border-amber-500",
                          })}
                          onClick={() => {
                            setDroppedMarkdown(null);
                            setDroppedMarkdownName("");
                          }}
                        >
                          CLEAR
                        </button>
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
                      const linkStatus = modelFetchStatusByProvider[p.id] || "idle";
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
                    {(!hasProviderAuth || credentialReplaceProvider === activeProvider) ? (
                      <div className="mb-3">
                        <label
                          htmlFor="gateway-provider-key"
                          className="mb-1 block font-mono text-[9px] tracking-[0.08em] text-[#8a8a8a]"
                        >
                          {credentialReplaceProvider === activeProvider
                            ? "ENTER NEW KEY"
                            : "ENTER GATEWAY KEY"}
                        </label>
                        <input
                          id="gateway-provider-key"
                          type="password"
                          value={gatewayKeyDraft}
                          onChange={(e) => setGatewayKeyDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              void submitGatewayKey();
                            }
                          }}
                          autoComplete="off"
                          spellCheck={false}
                          className="w-full rounded border border-[#2d2d2d] bg-black px-2 py-1 font-mono text-[10px] text-green-300 outline-none focus:border-green-700"
                          placeholder={`${activeProvider.toUpperCase()} API KEY`}
                        />
                      </div>
                    ) : null}
                    <div
                      className="mb-2 font-mono text-[10px]"
                      style={{ color: inactiveTextColor, textShadow: inactiveTextGlow }}
                    >
                      AVAILABLE_MODELS:
                    </div>
                    {!hasProviderAuth ? (
                      <div className="font-mono text-[10px]" style={{ color: inactiveTextColor, textShadow: inactiveTextGlow }}>
                        NO_KEY // ENTER_KEY_ABOVE_OR_PASTE_IN_CHAT
                      </div>
                    ) : rateLimitedProviders.has(activeProvider) ? (
                      <div className="font-mono text-[10px] text-amber-300" style={{ textShadow: "0 0 8px rgba(255, 170, 0, 0.28)" }}>
                        RATE_LIMIT // OPERATOR_ACTION_REQUIRED
                      </div>
                    ) : providerModelFetchStatus === "retrieving" ? (
                      <div className="model-probe-wave font-mono text-[10px]" style={{ color: "#ffaa00" }}>
                        CONNECTING... RETRIEVING_MODELS
                      </div>
                    ) : providerModelFetchStatus === "invalid-key" ? (
                      <div className="font-mono text-[10px] text-red-400" style={{ textShadow: "0 0 8px rgba(255, 85, 85, 0.3)" }}>
                        INVALID_KEY // AUTH_REJECTED
                      </div>
                    ) : providerModelFetchStatus === "error" ? (
                      <div className="font-mono text-[10px] text-red-300" style={{ textShadow: "0 0 8px rgba(255, 122, 122, 0.3)" }}>
                        UPLINK_ERROR // OPERATOR_ACTION_REQUIRED
                      </div>
                    ) : modelList.length === 0 ? (
                      <div className="font-mono text-[10px]" style={{ color: inactiveTextColor, textShadow: inactiveTextGlow }}>
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
                                    : inactiveSubtleTextColor,
                                "--nav-shadow": isSel
                                  ? health === "green"
                                    ? activeTextGlow
                                    : health === "amber"
                                      ? amberTextGlow
                                      : inactiveTextGlow
                                  : isFree
                                    ? amberTextGlow
                                    : inactiveTextGlow,
                                "--nav-hover-color": isSel ? (health === "green" ? "#36ff73" : "#ffbf4d") : "#b0b0b0",
                                "--nav-hover-shadow": isSel
                                  ? health === "green"
                                    ? "0 0 10px rgba(54, 255, 115, 0.30)"
                                    : "0 0 10px rgba(255, 191, 77, 0.28)"
                                  : inactiveTextGlow,
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
            <CyberdeckFixedServerPane
              serverId="m"
              className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
            >
                <ActivatedCyberdeckPane
                  kind="operator"
                  isOperatorDragOver={isOperatorDragOver}
                  operatorDroppedAsset={operatorDroppedAsset}
                  operatorSurfaceMode="workspace"
                  operatorBrowserEngine={operatorBrowserEngine}
                  operatorSurfaceIsDocument={operatorSurfaceIsDocument}
                  operatorBrowserUrl={operatorBrowserUrl}
                  operatorDocMode={operatorDocMode}
                  operatorDocNameDraft={operatorDocNameDraft}
                  operatorEditorRef={operatorEditorRef}
                  operatorNameInputRef={operatorNameInputRef}
                  operatorBrowserRef={operatorBrowserRef}
                  onOperatorDragOver={handleOperatorDragOver}
                  onOperatorDragLeave={handleOperatorDragLeave}
                  onOperatorDrop={handleOperatorDrop}
                  onOperatorDocNameDraftChange={setOperatorDocNameDraft}
                  onCommitOperatorDocName={commitOperatorDocName}
                  onSetOperatorDocMode={setOperatorDocMode}
                  onOperatorBrowserNavigate={openOperatorBrowser}
                  onOperatorBrowserUrlChange={setOperatorBrowserUrl}
                  onPasteClipboardToOperator={pasteClipboardToOperator}
                  onSaveOperatorDocInPlace={saveOperatorDocInPlace}
                  onSaveOperatorDocAsFile={saveOperatorDocAsFile}
                  operatorCanSaveInPlace={
                    operatorFolderRootsCount >= 0 &&
                    canSaveOperatorFileInPlace(
                      operatorActiveFilePath,
                      operatorFolderRootsRef.current,
                    )
                  }
                  onConvertDocumentToMarkdown={openConvertedMarkdownInOperator}
                  onExportOperatorMarkdown={exportOperatorMarkdown}
                  onCopyOperatorDocToClipboard={copyOperatorDocToClipboard}
                  onOperatorDocumentTextChange={handleOperatorDocumentTextChange}
                  onClearOperatorDocument={clearOperatorDocument}
                  onOperatorDocumentKindChange={handleOperatorDocumentKindChange}
                  operatorDocumentKind={normalizeOperatorDocumentKind(operatorDroppedAsset?.kind)}
                  onOpenOperatorFolderFile={openOperatorFolderFile}
                  onOperatorFolderRootsChange={handleOperatorFolderRootsChange}
                  operatorCanNavigateFileBack={canNavigateOperatorFileBack(
                    operatorFileHistoryIndex,
                  )}
                  operatorCanNavigateFileForward={canNavigateOperatorFileForward(
                    operatorFileHistory,
                    operatorFileHistoryIndex,
                  )}
                  onOperatorFileHistoryBack={() => navigateOperatorFileHistory("back")}
                  onOperatorFileHistoryForward={() => navigateOperatorFileHistory("forward")}
                />
            </CyberdeckFixedServerPane>
            <CyberdeckFixedServerPane serverId="b" className="flex min-h-0 flex-1 flex-col">
              <div ref={gatewayBlankSettingsRef} className="flex min-h-0 flex-1 flex-col">
                  <ActivatedCyberdeckPane
                    kind="settings"
                    voiceEnabled={voiceEnabled}
                    onVoiceToggle={toggleVoiceEnabled}
                    deckMode={deckMode}
                    onDeckModeToggle={toggleDeckMode}
                    audioMuted={audioMuted}
                    onAudioMuteToggle={toggleAudioMuted}
                    identity={identity}
                  />
              </div>
            </CyberdeckFixedServerPane>
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
        </div>
    </div>
  );
}











