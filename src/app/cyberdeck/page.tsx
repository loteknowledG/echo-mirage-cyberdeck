"use client";

import { useState, useRef, useEffect, useLayoutEffect, useCallback } from "react";
import type { CSSProperties, DragEvent as ReactDragEvent, MouseEvent as ReactMouseEvent } from "react";
import { Streamdown } from "streamdown";
import { CopyIcon, DownloadIcon } from "@radix-ui/react-icons";
import { art } from "@/lib/TerminalArt";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import {
  bindKeyboardSfx,
  unlockKeyboardSfx,
  playNavigationSound,
  playSystemSound,
  startSonarLoop,
  stopSonarLoop,
  playBleepBloop,
  playWrongDoorShut,
  playDeclined,
  playDroidDizzy400,
  playDroidDizzy401,
  playOutOfGas429,
  playRaceReadySetGo,
} from "@/lib/AudioEngine";
import { applyMuthurEffectChain } from "@/voice/effectsChain";
import { MUTHUR_PRESET } from "@/voice/muthurPreset";
import IndicateOverlay from "@/lib/computer-use/IndicateOverlay";
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
  parseBrowserCommand,
  parseBrowserUseModeCommand,
} from "@/lib/browser-intents";
import { detectSelfStatusIntent } from "@/lib/computer-use/intent-detect";
import { formatStatusText } from "@/lib/computer-use/introspection";
import { runComputerUseAction as runComputerUseBridgeAction } from "@/lib/computer-use/electron-computer-use-bridge";
import { useBrowserController } from "@/lib/use-browser-controller";
import { useCustomTabBrowserController } from "@/lib/use-custom-tab-browser-controller";
import { useRailTabLongPress } from "@/lib/use-rail-tab-long-press";
import { speakDryFallback } from "@/voice/speakMuthur";
import { splitIntoSpeechBlocks } from "@/lib/muthur-voice-blocks";
import { copyTextToClipboard } from "@/lib/grok-image-prompt";
import { get, set } from "idb-keyval";
import {
  CyberdeckPaneHeader,
  CyberdeckPaneHeaderSubtitle,
  CyberdeckPaneHeaderTitle,
  CyberdeckPaneHeaderValue,
} from "@/components/cyberdeck/pane-header";
import { CyberdeckOperatorPaneBody } from "@/components/cyberdeck/operator-pane-body";
import { CyberdeckDiagnosticPaneBody } from "@/components/cyberdeck/diagnostic-pane-body";
import { CyberdeckPiChatPaneBody } from "@/components/cyberdeck/pi-chat-pane-body";
import { CyberdeckCatalogPaneBody } from "@/components/cyberdeck/catalog-pane-body";
import { CyberdeckCommandPaneBody } from "@/components/cyberdeck/command-pane-body";
import { CyberdeckOperatorsPaneBody } from "@/components/cyberdeck/operators-pane-body";
import { CyberdeckMemoryAtlasPaneBody } from "@/components/cyberdeck/memory-atlas-pane-body";
import { CyberdeckVoiceLabPaneBody } from "@/components/cyberdeck/voice-lab-pane-body";
import { CyberdeckFlightLogPaneBody } from "@/components/cyberdeck/flight-log-pane-body";
import { CyberdeckSettingsPaneBody } from "@/components/cyberdeck/settings-pane-body";
import { CyberdeckBootSequence } from "@/components/cyberdeck/boot-sequence";
import { EchoHeader } from "@/components/cyberdeck/echo-header";
import { MirageHeader } from "@/components/cyberdeck/mirage-header";
import { registerCyberdeckRailTab } from "@/components/cyberdeck/cyberdeck-rail-tab";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { loadDeckMode, saveDeckMode, type DeckMode } from "@/lib/deck-mode";
import { isMuted, playBeep, setMuted } from "@/lib/deck-audio";
import { loadWorkspaceState, saveWorkspaceState } from "@/lib/workspace-state";
import { emitSignal, useDeckSignal, type DeckSignal } from "@/lib/cyberdeck/signal-router";
import { useDeckAudioBridge } from "@/lib/cyberdeck/audio-bridge";
import { useOperatorOrchestrator } from "@/lib/cyberdeck/operator-orchestrator";
import { loadIdentityBundle } from "@/lib/identity/load-identity";
import type { Identity } from "@/lib/identity/identity-types";
import { loadOrchestrationBundle } from "@/lib/orchestration/load-orchestration";
import type { OrchestrationBundle } from "@/lib/orchestration/orchestration-types";

const PROVIDER_IDS = ["opencode", "openrouter", "openai"] as const;
const DEFAULT_CLIENT_PROVIDER_KEYS: Record<string, string> = {
  opencode:
    (process.env.NEXT_PUBLIC_OPENCODE_API_KEY ||
      process.env.NEXT_PUBLIC_ZEN_API_KEY ||
      "").trim(),
  openrouter: (process.env.NEXT_PUBLIC_OPENROUTER_API_KEY || "").trim(),
  openai: (process.env.NEXT_PUBLIC_OPENAI_API_KEY || "").trim(),
};

const servers = [
  { id: "m", glyph: "Ø", label: "ØPERATOR" },
  { id: "w", glyph: "W", label: "WEB" },
  { id: "c", glyph: "C", label: "CONNECTION" },
  { id: "s", glyph: "μ", label: "MAINNET-UPLINK" },
  { id: "h", glyph: "π", label: "DIAGNOSTIC" },
  { id: "b", glyph: "§", label: "SETTINGS" },
] as const;

const SERVER_IDS = ["m", "s", "b"] as const;

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
  { id: "b", glyph: "§", label: "SETTINGS" },
] as const;
const HEAP_STORAGE_KEY = "echo-mirage-heap-items";
const CHAT_STORAGE_KEY = "echo-mirage-chat-messages-v1";
const CHAT_STREAM_STORAGE_KEY = "echo-mirage-chat-stream-text-v1";
const INPUT_STORAGE_KEY = "echo-mirage-chat-input-v1";
const UI_STATE_STORAGE_KEY = "echo-mirage-ui-state-v1";

/** Cinematic sonar gain while the deck talks to providers (see AudioEngine `startSonarLoop` scale). */
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
  "command",
  "catalog",
  "operators",
  "memory-atlas",
  "voice-lab",
  "flight-log",
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

const GATEWAY_LINK_PARTS =
  /(Open AI console|OpenRouter console|OpenCode console)/g;

const GATEWAY_LINK_HREF: Record<string, string> = {
  "Open AI console": "https://platform.openai.com/settings/api-keys",
  "OpenRouter console": "https://openrouter.ai/workspaces/default/keys",
  "OpenCode console": "https://opencode.ai",
};

type DroppedOperatorAsset = {
  kind: "text" | "code" | "markdown" | "image" | "video" | "file";
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

type CyberdeckChatHistoryMessage = {
  role: "user" | "assistant";
  content: string;
};

function isCustomTabKind(kind: unknown): kind is CustomTabKind {
  return typeof kind === "string" && normalizeCustomTabKind(kind) !== null;
}

function sanitizeCustomTabs(value: unknown): CustomTab[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const tab = item as Partial<CustomTab>;
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
  if (kind === "command") return ">";
  if (kind === "catalog") return "K";
  if (kind === "operators") return "O";
  if (kind === "memory-atlas") return "M";
  if (kind === "voice-lab") return "V";
  if (kind === "flight-log") return "F";
  if (kind === "pi" || kind === "diagnostics") return "π";
  return "□";
}

function defaultCustomTabLabelForKind(kind: CustomTabKind) {
  if (kind === "memory-atlas") return "MEMORY ATLAS";
  if (kind === "voice-lab") return "VOICE LAB";
  if (kind === "flight-log") return "FLIGHT LOG";
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
    /^(?:\/tab|tab:)?\s*(?:(?:convert|turn|make|set)(?:\s+this)?(?:\s+tab)?(?:\s+(?:to|into|as)\s+)?|(?:set|make)\s+tab\s+(?:to|as)?\s+)(blank|document|web|settings|connection|pi|diagnostics|diagnostic|catelog|catalog|command|operators|memory-atlas|voice-lab|flight-log)(?:\s+tab)?(?:\s+(?:named|called)\s+(.+?))?(?:\s+glyph\s+(.+))?$/i,
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

export default function CyberdeckPage() {
  type ChatMessage = { role: string; text: string; toolTrace?: string };
  // Start on the operator tab; disconnected users are redirected to MAINNET-UPLINK after hydration.
  const [server, setServer] = useState<(typeof SERVER_IDS)[number]>("m");
  useEffect(() => {
    registerCyberdeckRailTab();
  }, []);

  const [customTabs, setCustomTabs] = useState<CustomTab[]>([]);
  const [activeCustomTabId, setActiveCustomTabId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [inputHistory, setInputHistory] = useState<string[]>([]);
  const [inputHistoryIndex, setInputHistoryIndex] = useState<number | null>(null);
  const [inputHistoryDraft, setInputHistoryDraft] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatHydrated, setChatHydrated] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [streamToolTrace, setStreamToolTrace] = useState("");
  const [generatedUI, setGeneratedUI] = useState<string | null>(null);
  const [droppedMarkdown, setDroppedMarkdown] = useState<string | null>(null);
  const [droppedMarkdownName, setDroppedMarkdownName] = useState<string>("");
  const [operatorDroppedAsset, setOperatorDroppedAsset] = useState<DroppedOperatorAsset | null>(null);
  const [operatorSurfaceMode, setOperatorSurfaceMode] = useState<"workspace" | "browser">("workspace");
  const [operatorBrowserEngine, setOperatorBrowserEngine] = useState("UNKNOWN");
  const [operatorDocMode, setOperatorDocMode] = useState<"view" | "edit">("view");
  const [operatorDocNameDraft, setOperatorDocNameDraft] = useState("");
  const [operatorBrowserUrl, setOperatorBrowserUrl] = useState(OPERATOR_BROWSER_HOME_URL);
  const [operatorBrowserSnapshot, setOperatorBrowserSnapshot] = useState("");
  const [isMarkdownDragOver, setIsMarkdownDragOver] = useState(false);
  const [isOperatorDragOver, setIsOperatorDragOver] = useState(false);
  const [railTabContextMenu, setRailTabContextMenu] = useState<
    | { variant: "custom"; tabId: string; x: number; y: number }
    | { variant: "fixed"; serverId: (typeof SERVER_IDS)[number]; x: number; y: number }
    | null
  >(null);
  /** Right-click menu for the main chat / Echo Mirage pane (viewport-clamped like rail tabs). */
  const [mirageContextMenu, setMirageContextMenu] = useState<{ x: number; y: number } | null>(null);
  /** Right-click menu for gateway column surfaces (settings, operator, connection, custom tabs). */
  const [gatewayPaneContextMenu, setGatewayPaneContextMenu] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [isMobileLayout, setIsMobileLayout] = useState(false);
  const [inputCursorBlinkOn, setInputCursorBlinkOn] = useState(true);
  const [inputCursorLeft, setInputCursorLeft] = useState(0);
  const [inputCaretIndex, setInputCaretIndex] = useState(0);
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
  const [deckUiHydrated, setDeckUiHydrated] = useState(false);
  const [modelByProvider, setModelByProvider] = useState<Record<string, string>>({});
  const [modelFetchStatusByProvider, setModelFetchStatusByProvider] = useState<
    Record<string, "idle" | "retrieving" | "invalid-key" | "error" | "ready">
  >(() => ({
    opencode: "idle",
    openrouter: "idle",
    openai: "idle",
  }));
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
  const messageInputRef = useRef<HTMLInputElement>(null);
  const messageScrollRef = useRef<HTMLDivElement>(null);
  const serverRailRef = useRef<HTMLElement | null>(null);
  const chatColumnRef = useRef<HTMLDivElement>(null);
  const gatewayColumnRef = useRef<HTMLDivElement>(null);
  const gatewayConnectionPanelRef = useRef<HTMLDivElement>(null);
  const gatewayBlankSettingsRef = useRef<HTMLDivElement>(null);
  const cyberdeckRootRef = useRef<HTMLDivElement>(null);
  const chatAbortRef = useRef<AbortController | null>(null);
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
  const operatorBrowserRef = useRef<HTMLWebViewElement | null>(null);
  const operatorNameInputRef = useRef<HTMLInputElement | null>(null);
  const networkFeedbackDelayRef = useRef<number | null>(null);
  const networkFeedbackRepeatRef = useRef<number | null>(null);
  const chatSonarDelayRef = useRef<number | null>(null);
  const chatSonarActiveRef = useRef(false);
  const offlineAutoOpenedRef = useRef(false);
  const startupRailResolvedRef = useRef(false);
  const prevConnectionStateRef = useRef<"offline" | "connecting" | "connected">("offline");
  const serverRef = useRef(server);
  /** Forward Tab from message box cycles: gateway (right) → rail (left) → chat log (col2) → … */
  const deckTabNextRef = useRef<"gateway" | "rail" | "chatlog">("gateway");
  const prevNavRailRef = useRef<"gateway" | "tabs">("gateway");
  const uiFocusRestoredRef = useRef(false);

  const syncInputCaret = useCallback(() => {
    const el = messageInputRef.current;
    if (!el) return;
    const idx = el.selectionStart ?? 0;
    const displayIndex = input.length === 0 ? 0 : Math.max(0, Math.min(input.length - 1, idx));
    setInputCaretIndex(displayIndex);

    // Measure monospace text width before caret to place a block cursor overlay.
    const computed = window.getComputedStyle(el);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.font = computed.font;
    const before = input.slice(0, displayIndex);
    const padLeft = Number.parseFloat(computed.paddingLeft || "0") || 0;
    const charWidth = input[displayIndex] ? ctx.measureText(input[displayIndex]).width : 0;
    const x = padLeft + ctx.measureText(before).width + charWidth - el.scrollLeft;
    setInputCursorLeft(Math.max(padLeft, x));
  }, [input]);

  const moveInputCaretToEnd = useCallback((nextValue: string) => {
    requestAnimationFrame(() => {
      const el = messageInputRef.current;
      if (!el) return;
      const end = nextValue.length;
      el.focus({ preventScroll: true });
      el.setSelectionRange(end, end);
      setInputCaretIndex(nextValue.length === 0 ? 0 : nextValue.length - 1);
      syncInputCaret();
    });
  }, [syncInputCaret]);


  const providers = [
    { id: "opencode" as const, name: "OPENCODE" },
    { id: "openrouter" as const, name: "OPENROUTER" },
    { id: "openai" as const, name: "OPENAI" },
  ] as const;
  const modelID = modelByProvider[activeProvider] || "";
  const activeCustomTab = customTabs.find((tab) => tab.id === activeCustomTabId) || null;
  const selectedRailTabId = activeCustomTab?.id || server;
  const providerModelFetchStatus = modelFetchStatusByProvider[activeProvider] || "idle";
  const scanActivityActive =
    Boolean(probeInFlightByProvider[activeProvider]) || providerModelFetchStatus === "retrieving";
  const networkActivityActive =
    Boolean(probeInFlightByProvider[activeProvider]) ||
    providerModelFetchStatus === "retrieving" ||
    isStreaming;
  const hasProviderAuth = Boolean(providerKeys[activeProvider]) || Boolean(defaultKeyAvailableByProvider[activeProvider]);
  const isVerified = Boolean(verifiedProviders[activeProvider]);
  const isConnected = hasProviderAuth && Boolean(modelID) && providerModelFetchStatus === "ready" && isVerified;
  const connectionState: "offline" | "connecting" | "connected" = scanActivityActive
    ? "connecting"
      : isConnected
        ? "connected"
        : "offline";
  const showGatewayPanel = server === "s";
  const railServer = selectedRailTabId;
  const mobilePanelMinSize = 2;
  serverRef.current = server;

  const inactiveTextColor = "#7a7a7a";
  const inactiveSubtleTextColor = "#6a6a6a";
  const activeTextGlow = "0 0 8px rgba(0, 255, 0, 0.22)";
  const amberTextGlow = "0 0 8px rgba(255, 170, 0, 0.22)";
  const inactiveTextGlow = "0 0 6px rgba(180, 180, 180, 0.14)";
  const echoStatusChipText = `STATUS: ${deckMode === "ascii" ? "ASCII" : "NOMINAL"} ECHO MIRAGE`;

  useDeckAudioBridge();
  useOperatorOrchestrator();

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
      playRaceReadySetGo();
      return;
    }
    if (line.includes("HTTP_401")) {
      playDroidDizzy401();
      return;
    }
    if (line.includes("HTTP_400")) {
      playDroidDizzy400();
      return;
    }
    if (line.includes("HTTP_429")) {
      playOutOfGas429();
      return;
    }
    if (line.includes("EMPTY_PROBE")) {
      playDeclined();
      return;
    }
    if (line.includes("FAILURE")) {
      playWrongDoorShut();
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
    const output = applyMuthurEffectChain(ctx, source, {
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
      await speakDryFallback(text, browserTuning);
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
  }, [playMirageBuffer, speakDryFallback, stopMirageAudio, synthesizeMirageChunk]);

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

  const voiceButtonClassName = !voiceEnabled || voiceHealth === "off"
    ? "border-gray-700 bg-black text-gray-400 hover:border-gray-500"
    : voiceHealth === "backend"
      ? "border-emerald-500/90 bg-emerald-500/10 text-emerald-200 shadow-[0_0_0_1px_rgba(16,185,129,0.30)_inset,0_0_14px_rgba(16,185,129,0.22),0_3px_10px_rgba(0,0,0,0.5)]"
      : voiceHealth === "fallback"
        ? "border-amber-500/80 bg-amber-500/10 text-amber-300 shadow-[0_0_0_1px_rgba(245,158,11,0.20)_inset,0_0_12px_rgba(245,158,11,0.12),0_3px_10px_rgba(0,0,0,0.5)]"
        : "border-emerald-700/80 bg-black text-emerald-300 shadow-[0_0_0_1px_rgba(16,185,129,0.16)_inset,0_3px_10px_rgba(0,0,0,0.5)]";

  const voiceButtonTransform = !voiceEnabled || voiceHealth === "off"
    ? "translateY(0)"
    : voiceHealth === "backend"
      ? "translateY(-1px)"
      : "translateY(0)";

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
    try {
      const storedInput = window.localStorage.getItem(INPUT_STORAGE_KEY);
      if (typeof storedInput === "string") {
        setInput(storedInput);
      }
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
      window.localStorage.setItem(INPUT_STORAGE_KEY, input);
    } catch {
      /* ignore */
    }
  }, [input, chatHydrated]);

  useEffect(() => {
    if (!chatHydrated) return;
    try {
      window.localStorage.setItem(CHAT_STREAM_STORAGE_KEY, streamText);
    } catch {
      /* ignore */
    }
  }, [streamText, chatHydrated]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let restored = false;
    try {
      const workspaceState = loadWorkspaceState();
      if (workspaceState) {
        const restoredWorkspaceTabs = sanitizeCustomTabs(workspaceState.customTabs);
        setCustomTabs(restoredWorkspaceTabs);
        if (
          typeof workspaceState.activeCustomTabId === "string" &&
          restoredWorkspaceTabs.some((tab) => tab.id === workspaceState.activeCustomTabId)
        ) {
          setActiveCustomTabId(workspaceState.activeCustomTabId);
          restored = true;
        } else if (
          typeof workspaceState.activeModuleId === "string" &&
          isFixedServerTabId(workspaceState.activeModuleId)
        ) {
          setServer(workspaceState.activeModuleId);
          setActiveCustomTabId(null);
          restored = true;
        } else {
          setActiveCustomTabId(null);
        }
      }
      const stored = window.localStorage.getItem(UI_STATE_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<CyberdeckUiState> | null;
        if (parsed && SERVER_IDS.includes(parsed.server as (typeof SERVER_IDS)[number])) {
          setServer(parsed.server as (typeof SERVER_IDS)[number]);
          restored = true;
        }
        if (parsed?.navRailContext === "gateway" || parsed?.navRailContext === "tabs") {
          setNavRailContext(parsed.navRailContext);
          restored = true;
        }
        const highlightId = parsed?.serverKeyboardHighlightId;
        if (SERVER_IDS.includes(highlightId as (typeof SERVER_IDS)[number])) {
          setServerKeyboardHighlightId(highlightId as (typeof SERVER_IDS)[number]);
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
        setCustomTabs(restoredCustomTabs);
        if (
          typeof parsed?.activeCustomTabId === "string" &&
          restoredCustomTabs.some((tab) => tab.id === parsed.activeCustomTabId)
        ) {
          setActiveCustomTabId(parsed.activeCustomTabId);
        } else {
          setActiveCustomTabId(null);
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
    try {
      const payload: CyberdeckUiState = {
        server,
        navRailContext,
        serverKeyboardHighlightId,
        operatorSurfaceMode,
        operatorBrowserUrl,
        customTabs,
        activeCustomTabId,
      };
      window.localStorage.setItem(UI_STATE_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      /* ignore */
    }
  }, [
    activeCustomTabId,
    customTabs,
    deckUiHydrated,
    navRailContext,
    operatorBrowserUrl,
    operatorSurfaceMode,
    server,
    serverKeyboardHighlightId,
  ]);

  useEffect(() => {
    if (!workspaceHydrated) return;
    saveWorkspaceState({
      activeModuleId: selectedRailTabId,
      customTabs,
      activeCustomTabId,
    });
  }, [activeCustomTabId, customTabs, selectedRailTabId, workspaceHydrated]);

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

  const operatorSurfaceIsDocument =
    operatorDroppedAsset?.kind === "text" ||
    operatorDroppedAsset?.kind === "code" ||
    operatorDroppedAsset?.kind === "markdown";

  const { captureOperatorBrowserSnapshot, openOperatorBrowser, performBrowserCommand } = useBrowserController({
    operatorBrowserRef,
    operatorBrowserUrl,
    setOperatorBrowserUrl,
    setOperatorSurfaceMode,
    setServer,
    setOperatorBrowserSnapshot,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    setOperatorBrowserEngine(window.echoMirageBrowser ? "PLAYWRIGHT" : "WEBVIEW_DOM_FALLBACK");
  }, []);

  useEffect(() => {
    setOperatorDocNameDraft(operatorDroppedAsset?.name || "");
  }, [operatorDroppedAsset?.name]);

  useLayoutEffect(() => {
    if (!operatorSurfaceIsDocument || operatorDocMode !== "edit") return;
    const el = operatorEditorRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
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

  const saveOperatorDocAsFile = useCallback(async () => {
    const text = operatorDroppedAsset?.text || "";
    if (!operatorSurfaceIsDocument || !text.trim()) {
      toast.error("Operator document has no text.");
      return;
    }

    const nextName =
      operatorDroppedAsset?.name?.trim() ||
      (operatorDroppedAsset?.kind === "markdown" ? "operator-doc.md" : "operator-doc.txt");
    const fileTypes: SaveFilePickerOptions["types"] = [
      {
        description: "Text document",
        accept: {
          "text/plain": [".txt", ".md", ".markdown", ".log"],
          "text/markdown": [".md", ".markdown"],
          "application/json": [".json", ".jsonc"],
          "application/javascript": [".js", ".jsx", ".mjs", ".cjs"],
          "application/typescript": [".ts", ".tsx"],
          "text/css": [".css"],
          "text/html": [".html", ".htm"],
          "text/yaml": [".yaml", ".yml"],
        },
      },
    ];

    const picker = (window as Window & {
      showSaveFilePicker?: (options?: SaveFilePickerOptions) => Promise<SaveFilePickerHandle>;
    }).showSaveFilePicker;

    try {
      if (picker) {
        const handle = await picker({
          suggestedName: nextName,
          types: fileTypes,
          excludeAcceptAllOption: false,
        });
        const writable = await handle.createWritable();
        await writable.write(text);
        await writable.close();
        toast.success(`Saved "${nextName}".`);
        return;
      }

      const blob = new Blob([text], { type: operatorDroppedAsset?.mimeType || "text/plain" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = nextName;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success(`Downloaded "${nextName}".`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save operator document.");
    }
  }, [operatorDroppedAsset?.kind, operatorDroppedAsset?.mimeType, operatorDroppedAsset?.name, operatorDroppedAsset?.text, operatorSurfaceIsDocument]);

  const pasteClipboardToOperator = useCallback(async () => {
    try {
      const clipboardText = await readEchoMirageClipboardText();

      if (!clipboardText.trim()) {
        toast.error("Clipboard has no text.");
        return;
      }

      const currentKind = operatorDroppedAsset?.kind;
      const nextKind: DroppedOperatorAsset["kind"] =
        currentKind === "markdown" || currentKind === "code" || currentKind === "text"
          ? currentKind
          : "text";

      setOperatorDroppedAsset({
        kind: nextKind,
        name: "",
        mimeType: nextKind === "markdown" ? "text/markdown" : "text/plain",
        size: new Blob([clipboardText]).size,
        text: clipboardText,
      });
      setOperatorSurfaceMode("workspace");
      setOperatorDocNameDraft("");
      setOperatorDocMode("edit");
      toast.success("Pasted clipboard into a new operator draft.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not paste clipboard text.");
    }
  }, [operatorDroppedAsset?.kind, operatorDroppedAsset?.name]);

  const loadOperatorAssetFromFile = useCallback(async (file: File) => {
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

    if (kind === "markdown" || kind === "code" || kind === "text") {
      try {
        const text = await file.text();
        setOperatorDroppedAsset({ ...baseAsset, text });
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
  }, []);

  const copyHeapEntry = useCallback(async (entry: HeapEntry) => {
    try {
      await copyTextToClipboard(entry.text);
      toast.success(`Copied "${entry.name}" to clipboard.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not copy heap entry.");
    }
  }, []);

  const openHeapEntryInOperator = useCallback((entry: HeapEntry) => {
    const text = entry.text || "";
    const mimeType =
      entry.name.toLowerCase().endsWith(".md") || text.includes("\n")
        ? "text/markdown"
        : "text/plain";
    setOperatorDroppedAsset({
      kind: mimeType === "text/markdown" ? "markdown" : "text",
      name: entry.name,
        mimeType,
        size: new Blob([text]).size,
        text,
      });
      setOperatorSurfaceMode("workspace");
      setOperatorDocMode("view");
      setServer("m");
      setNavRailContext("gateway");
  }, []);

  const deleteHeapEntry = useCallback((id: string) => {
    setHeapEntries((prev) => prev.filter((entry) => entry.id !== id));
  }, []);

  useEffect(() => {
    const onContextAction = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      if (detail === "save-operator") {
        void saveOperatorDocAsFile();
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
  }, [copyOperatorDocToClipboard, pasteClipboardToOperator, saveOperatorDocAsFile]);

  const selectProvider = useCallback((id: string) => {
    setActiveProvider(id);
    try {
      localStorage.setItem("active_provider", id);
    } catch {
      /* ignore */
    }
    playSystemSound("chirp", 0.05);
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
      closeRailTabContextMenu();
      closeMirageContextMenu();
      closeGatewayPaneContextMenu();
      const isCustomTab = customTabs.some((tab) => tab.id === id);
      if (isCustomTab) {
        if (activeCustomTabId !== id) {
          setActiveCustomTabId(id);
          emitSignal({ source: "ui", type: "select", payload: { tabId: id, kind: "custom" }, severity: "info" });
          playSystemSound("chirp", 0.03);
        } else {
          playSystemSound("click", 0.02);
        }
        return;
      }

      setActiveCustomTabId(null);
      if (server !== id) {
        setServer(id as (typeof SERVER_IDS)[number]);
        emitSignal({ source: "ui", type: "select", payload: { tabId: id, kind: "fixed" }, severity: "info" });
        playSystemSound("chirp", 0.03);
      } else {
        playSystemSound("click", 0.02);
      }
    },
    [activeCustomTabId, closeGatewayPaneContextMenu, closeMirageContextMenu, closeRailTabContextMenu, customTabs, server],
  );

  const createBlankTab = useCallback(() => {
    closeRailTabContextMenu();
    closeMirageContextMenu();
    closeGatewayPaneContextMenu();
    const nextIndex = customTabs.length + 1;
    const id = `tab-${crypto.randomUUID()}`;
    const tab: CustomTab = {
      id,
      label: `TAB ${nextIndex}`,
      glyph: String(nextIndex % 10 || nextIndex),
      kind: "blank",
    };
    setCustomTabs((prev) => [...prev, tab]);
    setActiveCustomTabId(id);
    setNavRailContext("gateway");
    playSystemSound("chirp", 0.05);
  }, [closeGatewayPaneContextMenu, closeMirageContextMenu, closeRailTabContextMenu, customTabs.length]);

  const deleteActiveTab = useCallback(() => {
    closeRailTabContextMenu();
    closeMirageContextMenu();
    closeGatewayPaneContextMenu();
    if (!activeCustomTabId) return;
    setCustomTabs((prev) => prev.filter((tab) => tab.id !== activeCustomTabId));
    setActiveCustomTabId(null);
    playSystemSound("click", 0.02);
  }, [activeCustomTabId, closeGatewayPaneContextMenu, closeMirageContextMenu, closeRailTabContextMenu]);

  const clearSavedCustomTabState = useCallback(() => {
    const removedCount = customTabs.length;
    setCustomTabs([]);
    setActiveCustomTabId(null);

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
    playSystemSound("chirp", 0.05);
    if (removedCount > 0) {
      toast.success(`Cleared ${removedCount} custom tab${removedCount === 1 ? "" : "s"}.`);
    } else {
      toast.info("No custom tabs were saved.");
    }
  }, [customTabs.length]);

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
    for (const id of PROVIDER_IDS) {
      const stored = localStorage.getItem(`key_${id}`);
      const fallback = DEFAULT_CLIENT_PROVIDER_KEYS[id] || "";
      const value = (stored || fallback || "").trim();
      if (value) nextKeys[id] = value;
    }
    setProviderKeys(nextKeys);
    const ap = localStorage.getItem("active_provider");
    if (ap && (PROVIDER_IDS as readonly string[]).includes(ap)) setActiveProvider(ap);
    setModelByProvider((prev) => {
      const n = { ...prev };
      for (const id of PROVIDER_IDS) {
        const m = localStorage.getItem(`ascii_model_${id}`);
        if (m) n[id] = m;
      }
      return n;
    });
    setDidHydrateProviderState(true);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamText]);

  useEffect(() => {
    if (!isInputFocused || isStreaming) {
      setInputCursorBlinkOn(true);
      return;
    }
    const id = window.setInterval(() => {
      setInputCursorBlinkOn((prev) => !prev);
    }, 530);
    return () => window.clearInterval(id);
  }, [isInputFocused, isStreaming]);

  useLayoutEffect(() => {
    if (!isInputFocused) return;
    syncInputCaret();
  }, [input, inputCaretIndex, isInputFocused, syncInputCaret]);

  useEffect(() => {
    if (scanActivityActive) {
      startSonarLoop(3200, CYBERDECK_SONAR_VOL_SCAN);
    } else {
      stopSonarLoop();
    }
    return () => stopSonarLoop();
  }, [scanActivityActive]);

  useEffect(() => {
    if (isStreaming) {
      if (chatSonarDelayRef.current == null) {
        chatSonarDelayRef.current = window.setTimeout(() => {
          startSonarLoop(3200, CYBERDECK_SONAR_VOL_CHAT_STREAM);
          chatSonarActiveRef.current = true;
          chatSonarDelayRef.current = null;
        }, 7000);
      }
      if (networkFeedbackDelayRef.current == null) {
        networkFeedbackDelayRef.current = window.setTimeout(() => {
          playBleepBloop();
          networkFeedbackRepeatRef.current = window.setInterval(() => {
            playBleepBloop();
          }, 7000);
        }, 2800);
      }
    } else {
      if (chatSonarDelayRef.current !== null) {
        window.clearTimeout(chatSonarDelayRef.current);
        chatSonarDelayRef.current = null;
      }
      if (chatSonarActiveRef.current && !scanActivityActive) {
        stopSonarLoop();
      }
      chatSonarActiveRef.current = false;
      if (scanActivityActive) {
        startSonarLoop(3200, CYBERDECK_SONAR_VOL_SCAN);
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
        stopSonarLoop();
      }
      chatSonarActiveRef.current = false;
    };
  }, [isStreaming, scanActivityActive]);

  // When the active gateway has no stored key, mirror Weyland: one [SYS] line per provider (deduped).
  useEffect(() => {
    if (providerKeys[activeProvider] || defaultKeyAvailableByProvider[activeProvider]) return;
    const tip = gatewayKeySysMessage(activeProvider);
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last?.role === "system" && last.text === tip) return prev;
      return [...prev, { role: "system", text: tip }];
    });
  }, [activeProvider, defaultKeyAvailableByProvider, providerKeys]);

  const setModelHealth = useCallback((provider: string, model: string, status: string) => {
    setModelHealthByProvider((prev) => ({
      ...prev,
      [provider]: { ...(prev[provider] || {}), [model]: status },
    }));
  }, []);

  const probeSelectedModel = useCallback(
    async (provider: string, model: string, key: string) => {
      if (!provider || !model) return;
      setProbeInFlightByProvider((prev) => ({ ...prev, [provider]: model }));
      setModelHealth(provider, model, "testing");
      try {
        const res = await fetch("/api/cyberdeck-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ probe: true, provider, apiKey: key, model }),
        });
        const data = (await res.json()) as {
          ok?: boolean;
          valid?: boolean;
          rateLimited?: boolean;
          status?: number;
        };
        const failHealth = data.rateLimited ? "amber" : "grey";
        if (!res.ok || data.ok === false) {
          const line = `MODEL_TEST ${provider.toUpperCase()}/${model}: HTTP_${data.status ?? res.status}${data.rateLimited ? " RATE_LIMIT" : " FAILURE"}`;
          playModelTestErrorSound(line);
          setModelHealth(provider, model, failHealth);
          setVerifiedProviders((prev) => ({ ...prev, [provider]: false }));
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
        setModelHealth(provider, model, valid ? "green" : "amber");
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
        setProbeInFlightByProvider((prev) => {
          if (prev[provider] !== model) return prev;
          return { ...prev, [provider]: "" };
        });
      }
    },
    [playModelTestErrorSound, setModelHealth, setVerifiedProviders],
  );

  const activateModelById = useCallback(
    (modelId: string) => {
      const key = providerKeys[activeProvider];
      if (!modelId) return;
      setModelByProvider((prev) => ({ ...prev, [activeProvider]: modelId }));
      setVerifiedProviders((prev) => ({ ...prev, [activeProvider]: false }));
      try {
        localStorage.setItem(`ascii_model_${activeProvider}`, modelId);
      } catch {
        /* ignore */
      }
      playSystemSound("click", 0.02);
      void probeSelectedModel(activeProvider, modelId, key || "");
    },
    [activeProvider, probeSelectedModel, providerKeys, setVerifiedProviders],
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
      const inChatInput = messageInputRef.current !== null && t === messageInputRef.current;
      const isEditableTarget =
        t.isContentEditable ||
        t.tagName === "INPUT" ||
        t.tagName === "TEXTAREA" ||
        t.tagName === "SELECT";

      if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === "v" || e.key === "V")) {
        if (isEditableTarget) return;
        if (server === "m") {
          e.preventDefault();
          void pasteClipboardToOperator();
          return;
        }
      }

      const sfxNav = {
        step: () => {
          if (!e.repeat) playNavigationSound("step");
        },
        commit: () => {
          if (!e.repeat) playNavigationSound("commit");
        },
        back: () => {
          if (!e.repeat) playNavigationSound("back");
        },
      };

      // Tab: message box ↔ deck columns/surfaces; includes chat log (col2) in sequencer.
      if (e.key === "Tab" && !e.repeat) {
        const msg = messageInputRef.current;
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
          setServerKeyboardHighlightId(server);
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
            ((SERVER_IDS as readonly string[]).includes(railServer) ? (railServer as (typeof SERVER_IDS)[number]) : sids[0]);
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
        selectProvider(providerKeyboardHighlightId);
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
    selectProvider,
    pasteClipboardToHeap,
    pasteClipboardToOperator,
    server,
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
    window.requestAnimationFrame(() => {
      const rail = serverRailRef.current;
      const tabEl = rail?.querySelector<HTMLElement>(`[data-server-tab="${selectedRailTabId}"]`);
      tabEl?.scrollIntoView({ block: "nearest", inline: "nearest" });
    });
  }, [selectedRailTabId]);

  useEffect(() => {
    setModelKeyboardHighlightId((prev) => {
      if (prev == null) return null;
      if (!modelList.some((m) => m.id === prev)) return null;
      return prev;
    });
  }, [activeProvider, modelList]);

  // Fetch models for selected provider; API route can use user key or server default key.
  useEffect(() => {
    const currentKey = providerKeys[activeProvider];
    setModelList([]);

    let cancelled = false;
    setModelFetchStatusByProvider((prev) => ({ ...prev, [activeProvider]: "retrieving" }));
    setVerifiedProviders((prev) => ({ ...prev, [activeProvider]: false }));

    (async () => {
      try {
        const res = await fetch("/api/cyberdeck-models", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ provider: activeProvider, apiKey: currentKey }),
        });
        if (cancelled) return;
        if (!res.ok) {
          const errJson = (await res.json().catch(() => ({}))) as {
            authSource?: "user" | "default" | "none";
            code?: string;
          };
          if (errJson.authSource === "none" || errJson.code === "NO_PROVIDER_KEY") {
            setDefaultKeyAvailableByProvider((prev) => ({ ...prev, [activeProvider]: false }));
            setModelFetchStatusByProvider((prev) => ({ ...prev, [activeProvider]: "idle" }));
            return;
          }
          const invalid = res.status === 401 || res.status === 403;
          setModelFetchStatusByProvider((prev) => ({
            ...prev,
            [activeProvider]: invalid ? "invalid-key" : "error",
          }));
          if (invalid && currentKey) {
            setProviderKeys((prev) => {
              const next = { ...prev };
              delete next[activeProvider];
              return next;
            });
            localStorage.removeItem(`key_${activeProvider}`);
            setMessages((prev) => [
              ...prev,
              { role: "system", text: `INVALID_KEY // ${activeProvider.toUpperCase()} AUTH_REJECTED` },
            ]);
          }
          return;
        }
        const json = (await res.json()) as {
          data?: { id: string }[];
          authSource?: "user" | "default";
        };
        const raw = Array.isArray(json.data) ? json.data : [];
        if (cancelled) return;
        setDefaultKeyAvailableByProvider((prev) => ({
          ...prev,
          [activeProvider]: json.authSource === "default",
        }));
        setModelList(raw);
        setModelFetchStatusByProvider((prev) => ({ ...prev, [activeProvider]: "ready" }));
        setModelByProvider((prev) => {
          const current = prev[activeProvider] || "";
          const hasCurrent = current && raw.some((m) => m.id === current);
          const nextModel = hasCurrent ? current : raw[0]?.id || "";
          if (nextModel) {
            localStorage.setItem(`ascii_model_${activeProvider}`, nextModel);
            void probeSelectedModel(activeProvider, nextModel, currentKey || "");
          }
          return { ...prev, [activeProvider]: nextModel };
        });
      } catch {
        if (!cancelled) {
          setModelList([]);
          setModelFetchStatusByProvider((prev) => ({ ...prev, [activeProvider]: "error" }));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeProvider, probeSelectedModel, providerKeys, setVerifiedProviders]);

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
    let unlocked = false;
    const unlock = () => {
      if (unlocked) return;
      unlocked = true;
      void unlockKeyboardSfx();
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("touchstart", unlock);
    };
    window.addEventListener("pointerdown", unlock, { passive: true });
    window.addEventListener("keydown", unlock, { passive: true });
    window.addEventListener("touchstart", unlock, { passive: true });

    const unbind = bindKeyboardSfx(window, {
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

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return;

    const userMessage = input.trim();
    const tabCommand = parseCustomTabCommand(userMessage);
    setInputHistory((prev) => [...prev, userMessage]);
    setInputHistoryIndex(null);
    setInputHistoryDraft("");
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: userMessage }]);
    setIsStreaming(true);
    setStreamText("");
    setStreamToolTrace("");
    setGeneratedUI(null);

    if (tabCommand?.kind === "create") {
      const id = `tab-${crypto.randomUUID()}`;
      const tab: CustomTab = {
        id,
        label: tabCommand.label,
        glyph: tabCommand.glyph,
        kind: "blank",
      };
      setCustomTabs((prev) => [...prev, tab]);
      setActiveCustomTabId(id);
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

    if (detectSelfStatusIntent(userMessage)) {
      const statusText = formatStatusText();
      setMessages((prev) => [...prev, { role: "assistant", text: statusText }]);
      setMuthurMemory((current) => recordMuthurMemoryTurn(current, userMessage, statusText));
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

      const target =
        text.includes("command input") || text.includes("input area") || text.includes("message box")
          ? messageInputRef.current
          : text.includes("voice lab")
            ? document.querySelector<HTMLElement>('[data-pointer-target="voice-lab"]') ??
              findVisibleTextTarget("voice lab") ??
              gatewayColumnRef.current
            : null;

      if (!target) {
        setMessages((prev) => [
          ...prev,
          { role: "system", text: "INDICATE_SKIPPED // TARGET_NOT_VISIBLE" },
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
          label: text.includes("voice lab") ? "Voice Lab" : "Command input",
          ttlMs: 30_000,
        },
      });

      setMessages((prev) => [
        ...prev,
        {
          role: "system",
          text: result.success
            ? `INDICATE_${wantsHighlight ? "HIGHLIGHT" : "POINT"} // ${text.includes("voice lab") ? "VOICE_LAB" : "COMMAND_INPUT"}`
            : `INDICATE_FAILED // ${result.error ?? "UNKNOWN"}`,
        },
      ]);
      setIsStreaming(false);
      return true;
    };

    if (await runPointerCommand()) {
      return;
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
        { role: "system", text: `KEY FOR ${activeProvider.toUpperCase()} REGISTERED.` },
      ]);
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

    try {
      const abortCtl = new AbortController();
      chatAbortRef.current = abortCtl;
      const memoryContext = buildMuthurMemoryContext(muthurMemoryRef.current, userMessage);
      const history = buildCyberdeckChatHistory(messages);
      const latestAssistantMessage =
        [...messages].reverse().find((message) => message.role === "assistant")?.text || "";
      const res = await fetch("/api/cyberdeck-chat", {
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
          history,
        }),
      });

      if (!res.ok) {
        let detail = "";
        try {
          const ct = res.headers.get("content-type") || "";
          if (ct.includes("application/json")) {
            const payload = (await res.json()) as { error?: string; message?: string };
            detail = String(payload?.error || payload?.message || "").trim();
          } else {
            detail = (await res.text()).trim();
          }
        } catch {
          /* ignore parse errors */
        }
        const statusLine = `API error ${res.status}`;
        throw new Error(detail ? `${statusLine}: ${detail}` : statusLine);
      }

      const muthurToolsHeader = res.headers.get("x-muthur-tools-used")?.trim() ?? "";
      setStreamToolTrace(muthurToolsHeader);

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      if (reader) {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          fullText += chunk;
          setStreamText(fullText);
        }
      }

      const allowBrowserDirective =
        (looksLikeAffirmativeReply(userMessage) && looksLikeBrowserSearchOffer(latestAssistantMessage));

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

      setMessages((prev) => [...prev, { role: "assistant", text: fullText }]);
      setMuthurMemory((current) => recordMuthurMemoryTurn(current, userMessage, fullText));
      setStreamText("");

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
        setMessages((prev) => [...prev, { role: "system", text: "REQUEST_ABORTED // STREAM_HALTED" }]);
        setStreamText("");
        return;
      }
      if (msg.includes("API error")) {
        playWrongDoorShut();
        const status = msg.match(/API error\s+(\d{3})/i)?.[1] || "UNKNOWN";
        const modelLabel = modelID || "UNSET_MODEL";
        const hint =
          status === "401" || status === "403"
            ? "CHECK_API_KEY"
            : status === "429"
              ? "RATE_LIMIT_WAIT_AND_RETRY"
              : "CHECK_PROVIDER_MODEL_OR_NETWORK";
        setMessages((prev) => [
          ...prev,
          {
            role: "system",
            text: `API_FAILURE // ${activeProvider.toUpperCase()} / ${modelLabel} // HTTP_${status} // ${hint}`,
          },
        ]);
      }
      setMessages((prev) => [...prev, { role: "error", text: String(err) }]);
    } finally {
      chatAbortRef.current = null;
      setStreamToolTrace("");
      setIsStreaming(false);
    }
  };

  const handleInputHistoryKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        handleSend();
        return;
      }

      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (inputHistory.length === 0) return;

      if (e.key === "ArrowUp") {
        e.preventDefault();
        const nextIndex =
          inputHistoryIndex === null ? inputHistory.length - 1 : Math.max(0, inputHistoryIndex - 1);
        if (inputHistoryIndex === null) {
          setInputHistoryDraft(input);
        }
        const nextValue = inputHistory[nextIndex] ?? "";
        setInput(nextValue);
        setInputHistoryIndex(nextIndex);
        moveInputCaretToEnd(nextValue);
        return;
      }

      if (e.key === "ArrowDown" && inputHistoryIndex !== null) {
        e.preventDefault();
        const nextIndex = inputHistoryIndex + 1;
        if (nextIndex >= inputHistory.length) {
          setInput(inputHistoryDraft);
          setInputHistoryIndex(null);
          moveInputCaretToEnd(inputHistoryDraft);
          return;
        }
        const nextValue = inputHistory[nextIndex] ?? "";
        setInput(nextValue);
        setInputHistoryIndex(nextIndex);
        moveInputCaretToEnd(nextValue);
      }
    },
    [handleSend, input, inputHistory, inputHistoryDraft, inputHistoryIndex, moveInputCaretToEnd],
  );

  const handleStop = useCallback(() => {
    if (!isStreaming) return;
    abortMotherSpeech();
    chatAbortRef.current?.abort();
  }, [abortMotherSpeech, isStreaming]);

  const handleModelLabelClick = useCallback((targetServer: "s" | "b" = "s") => {
    setActiveCustomTabId(null);
    setServer(targetServer);
    setNavRailContext("gateway");
    setServerKeyboardHighlightId(null);
    setProviderKeyboardHighlightId(activeProvider);
    setModelKeyboardHighlightId(modelID || null);
    gatewayColumnRef.current?.focus({ preventScroll: true });
    if (targetServer === "s") {
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
      if (serverId === "b") {
        handleModelLabelClick("b");
        return;
      }
      gatewayColumnRef.current?.focus({ preventScroll: true });
    },
    [handleModelLabelClick],
  );

  useEffect(() => {
    if (!didHydrateProviderState || startupRailResolvedRef.current) return;
    if (hasProviderAuth) {
      setActiveCustomTabId(null);
      setServer("m");
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
      await loadOperatorAssetFromFile(file);
    }
  }, [loadOperatorAssetFromFile]);

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
    if (!file) return;

    await loadOperatorAssetFromFile(file);
  }, [loadOperatorAssetFromFile]);

  const updateCustomTab = useCallback((tabId: string, updater: (tab: CustomTab) => CustomTab) => {
    setCustomTabs((prev) => prev.map((tab) => (tab.id === tabId ? updater(tab) : tab)));
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
      updateCustomTab(tabId, (tab) => {
        const nextLabel = options?.label || tab.label || nextKind.toUpperCase();
        const nextGlyph = options?.glyph || tab.glyph || defaultCustomTabGlyphForKind(nextKind);

        return {
          ...tab,
          kind: nextKind,
          label: nextLabel,
          glyph: nextGlyph,
          browserUrl: nextKind === "web" ? tab.browserUrl || OPERATOR_BROWSER_HOME_URL : undefined,
          asset: nextKind === "document" ? tab.asset ?? null : null,
        };
      });
      setActiveCustomTabId(tabId);
      setNavRailContext("tabs");
      setMessages((prev) => [
        ...prev,
        {
          role: "system",
          text: `TAB_CONVERTED // ${tabId} // ${nextKind.toUpperCase()}`,
        },
      ]);
      playSystemSound("chirp", 0.05);
    },
    [updateCustomTab],
  );

  const { handleCustomTabBrowserNavigate: customTabBrowserNavigate } = useCustomTabBrowserController({
    activeCustomTab,
    operatorBrowserRef,
    updateCustomTab,
  });

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
      } else if (kind === "markdown" || kind === "code" || kind === "text") {
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
      setActiveCustomTabId(tabId);
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
      if (selectedRailTabId !== tabId || typeof window === "undefined") return;
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
    [closeGatewayPaneContextMenu, closeMirageContextMenu, selectedRailTabId],
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
    const existing = customTabs.find((t) => t.kind === "diagnostics");
    if (existing) {
      setActiveCustomTabId(existing.id);
      setNavRailContext("tabs");
      playSystemSound("chirp", 0.05);
      return;
    }
    const id = `tab-${crypto.randomUUID()}`;
    const tab: CustomTab = {
      id,
      label: "DIAGNOSTICS",
      glyph: defaultCustomTabGlyphForKind("diagnostics"),
      kind: "diagnostics",
    };
    setCustomTabs((prev) => [...prev, tab]);
    setActiveCustomTabId(id);
    setNavRailContext("tabs");
    playSystemSound("chirp", 0.05);
  }, [customTabs]);

  const openOrFocusModuleTab = useCallback(
    (target: "memory-atlas" | "catalog" | "operators" | "flight-log" | "voice-lab" | "settings" | "command") => {
      const existing = customTabs.find((tab) => tab.kind === target);
      if (existing) {
        setActiveCustomTabId(existing.id);
        setNavRailContext("tabs");
        playSystemSound("chirp", 0.05);
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
      setCustomTabs((prev) => [...prev, tab]);
      setActiveCustomTabId(id);
      setNavRailContext("tabs");
      playSystemSound("chirp", 0.05);
      emitSignal({
        source: "system",
        type: "focused_module",
        payload: { target },
        severity: "info",
      });
      return true;
    },
    [customTabs],
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
        target !== "settings" &&
        target !== "command"
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

  const { createHandlers: createRailTabLongPressHandlers, consumeClickIfLongPress, cancelLongPressFromContextMenu } =
    useRailTabLongPress({
      selectedRailTabId,
      openMenu: openRailTabContextMenu,
    });

  const handleRailTabContextMenu = useCallback(
    (tabId: string, event: ReactMouseEvent<HTMLElement>) => {
      if (selectedRailTabId !== tabId) return;
      event.preventDefault();
      event.stopPropagation();
      cancelLongPressFromContextMenu();
      openRailTabContextMenu(tabId, event.clientX, event.clientY);
    },
    [cancelLongPressFromContextMenu, openRailTabContextMenu, selectedRailTabId],
  );

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

  useEffect(() => {
    if (!railTabContextMenu) return;
    if (railTabContextMenu.variant !== "custom") return;
    if (railTabContextMenu.tabId !== activeCustomTabId) {
      closeRailTabContextMenu();
    }
  }, [activeCustomTabId, closeRailTabContextMenu, railTabContextMenu]);

  useEffect(() => {
    if (!railTabContextMenu) return;
    if (railTabContextMenu.variant !== "fixed") return;
    if (railTabContextMenu.serverId !== selectedRailTabId) {
      closeRailTabContextMenu();
    }
  }, [closeRailTabContextMenu, railTabContextMenu, selectedRailTabId]);

  const renderCustomTabSurface = useCallback(
    (tab: CustomTab) => {
      const shell = (content: JSX.Element, right?: JSX.Element) => (
        <div
          className="custom-scrollbar flex h-full flex-1 flex-col overflow-y-auto bg-black p-4"
          data-pointer-target={tab.kind}
        >
          <div className="flex flex-1 flex-col rounded-sm border border-[#141414] bg-black transition-colors">
            <CyberdeckPaneHeader
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
                right || (
                  <div className="flex items-center gap-2">
                    {tab.kind === "web" ? (
                      <div className="rounded border border-[#2d2d2d] px-2 py-1 font-mono text-[9px] tracking-[0.08em] text-[#8a8a8a]">
                        ENGINE: {operatorBrowserEngine}
                      </div>
                    ) : null}
                    <button
                      type="button"
                      onClick={deleteActiveTab}
                      className="rounded border border-[#2d2d2d] bg-black px-2 py-1 font-mono text-[9px] tracking-[0.08em] text-[#8a8a8a] transition hover:border-red-500/60 hover:text-red-200"
                    >
                      DELETE TAB
                    </button>
                  </div>
                )
              }
            />
            {content}
          </div>
        </div>
      );

      if (tab.kind === "web") {
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
                value={tab.browserUrl || OPERATOR_BROWSER_HOME_URL}
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
              <button
                type="button"
                onClick={() => customTabBrowserNavigate(tab.id, tab.browserUrl || OPERATOR_BROWSER_HOME_URL)}
                className="rounded border border-[#2d2d2d] bg-black px-2 py-1 font-mono text-[9px] tracking-[0.08em] text-[#8a8a8a] transition hover:border-emerald-500/60 hover:text-emerald-200"
              >
                OPEN
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden rounded-sm border border-[#1c1c1c] bg-black">
              <webview
                ref={operatorBrowserRef}
                src={tab.browserUrl || OPERATOR_BROWSER_HOME_URL}
                partition="persist:custom-tab-browser"
                className="h-full w-full"
              />
            </div>
          </div>,
        );
      }

      if (tab.kind === "document") {
        return shell(
          <div
            className="flex min-h-0 flex-1 flex-col gap-3 p-3"
            onDragOver={(event) => {
              event.preventDefault();
            }}
            onDrop={(event) => void handleCustomTabDrop(event, tab.id)}
          >
            {tab.asset ? (
              <>
                <div className="font-mono text-[9px] tracking-[0.08em] text-[#8a8a8a]">
                  {tab.asset.mimeType || "application/octet-stream"} // {Math.max(1, Math.round(tab.asset.size / 1024))} KB
                </div>
                {tab.asset.kind === "image" ? (
                  <div className="rounded-sm border border-[#1c1c1c] bg-black/80 p-3">
                    {tab.asset.imageSrc ? (
                      <img
                        src={tab.asset.imageSrc}
                        alt={tab.asset.name}
                        className="max-h-[72vh] w-full rounded-sm border border-[#1c1c1c] object-contain"
                        draggable={false}
                      />
                    ) : (
                      <div className="rounded-sm border border-dashed border-[#1c1c1c] bg-black p-4 font-mono text-[10px] leading-snug text-[#8a8a8a]">
                        Could not load image preview.
                      </div>
                    )}
                  </div>
                ) : tab.asset.kind === "markdown" ? (
                  <div className="rounded-sm border border-green-900/70 bg-black/70 p-3">
                    <Streamdown className="prose prose-invert prose-pre:bg-black prose-pre:text-green-300 max-w-none text-[12px] leading-snug text-green-200">
                      {tab.asset.text || ""}
                    </Streamdown>
                  </div>
                ) : tab.asset.text ? (
                  <Textarea
                    value={tab.asset.text}
                    onChange={(event) =>
                      updateCustomTab(tab.id, (current) => ({
                        ...current,
                        asset: current.asset ? { ...current.asset, text: event.target.value } : current.asset,
                      }))
                    }
                    spellCheck={false}
                    autoCapitalize="off"
                    autoComplete="off"
                    autoCorrect="off"
                    wrap="off"
                    className="min-h-0 resize-none overflow-hidden rounded-sm border border-[#1c1c1c] bg-black px-3 py-3 font-mono text-[12px] leading-snug text-green-200 shadow-none focus-visible:ring-1 focus-visible:ring-amber-500/40"
                  />
                ) : (
                  <pre className="min-h-[50vh] whitespace-pre-wrap break-words rounded-sm border border-[#1c1c1c] bg-black p-3 font-mono text-[12px] leading-snug text-green-200">
                    {tab.asset.name}
                  </pre>
                )}
              </>
            ) : (
              <div className="flex min-h-[50vh] items-center justify-center rounded-sm border border-dashed border-[#1c1c1c] bg-black/70 p-6 font-mono text-[10px] tracking-[0.08em] text-[#8a8a8a]">
                DROP A DOCUMENT, IMAGE, OR TEXT FILE HERE TO START WORKING.
              </div>
            )}
          </div>,
        );
      }

      if (tab.kind === "settings") {
        return shell(
          <CyberdeckSettingsPaneBody
            voiceEnabled={voiceEnabled}
            onVoiceToggle={toggleVoiceEnabled}
            muthurMasterVolume={voiceDial.volume}
            onMuthurMasterVolumeChange={(volume) =>
              setVoiceDial((prev) => ({
                ...prev,
                volume: Math.min(1.25, Math.max(0.05, volume)),
              }))
            }
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
        const memoryContextQuery = lastUserChat.trim() || input.trim() || undefined;
        return shell(
          <CyberdeckDiagnosticPaneBody
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
        return shell(<CyberdeckPiChatPaneBody server={server} />);
      }

      if (tab.kind === "catelog" || tab.kind === "catalog") {
        return shell(<CyberdeckCatalogPaneBody />);
      }

      if (tab.kind === "command") {
        return shell(<CyberdeckCommandPaneBody server={server} />);
      }

      if (tab.kind === "operators") {
        return shell(<CyberdeckOperatorsPaneBody orchestration={orchestration} />);
      }

      if (tab.kind === "memory-atlas") {
        return shell(<CyberdeckMemoryAtlasPaneBody />);
      }

      if (tab.kind === "voice-lab") {
        return shell(
          <CyberdeckVoiceLabPaneBody
            voiceEnabled={voiceEnabled}
            onVoiceToggle={toggleVoiceEnabled}
            muthurMasterVolume={voiceDial.volume}
            onMuthurMasterVolumeChange={(volume) =>
              setVoiceDial((prev) => ({
                ...prev,
                volume: Math.min(1.25, Math.max(0.05, volume)),
              }))
            }
          />,
        );
      }

      if (tab.kind === "flight-log") {
        return shell(<CyberdeckFlightLogPaneBody />);
      }

      return shell(
        <div className="flex min-h-0 flex-1 items-center justify-center p-6 font-mono text-[10px] tracking-[0.08em] text-[#8a8a8a]">
          BLANK TAB // USE CHAT COMMANDS TO CONVERT TO DOCUMENT, WEB, CATALOG, COMMAND, OPERATORS, MEMORY-ATLAS, VOICE-LAB, FLIGHT-LOG, SETTINGS, CONNECTION, DIAGNOSTICS, OR PI.
        </div>,
      );
    },
    [
      activeProvider,
      connectionState,
      deleteActiveTab,
      customTabBrowserNavigate,
      handleCustomTabDrop,
      heapEntries.length,
      input,
      messages,
      messages.length,
      modelID,
      muthurMemory,
      muthurMemoryHydrated,
      muthurMemoryLoadError,
      operatorBrowserEngine,
      providerModelFetchStatus,
      server,
      streamText,
      toggleDeckMode,
      toggleVoiceEnabled,
      updateCustomTab,
      voiceDial.volume,
      voiceEnabled,
      voiceHealth,
    ],
  );

  const customTabContextMenuActions: Array<
    | { label: string; kind: CustomTabKind; action: "convert" }
    | { label: string; action: "settings-pane" | "connection-pane" }
  > = [
    { label: "Command", kind: "command", action: "convert" },
    { label: "Document", kind: "document", action: "convert" },
    { label: "Web", kind: "web", action: "convert" },
    { label: "Catalog", kind: "catalog", action: "convert" },
    { label: "Operators", kind: "operators", action: "convert" },
    { label: "Memory Atlas", kind: "memory-atlas", action: "convert" },
    { label: "Voice Lab", kind: "voice-lab", action: "convert" },
    { label: "Flight Log", kind: "flight-log", action: "convert" },
    { label: "Diagnostics", kind: "diagnostics", action: "convert" },
    { label: "Pi", kind: "pi", action: "convert" },
    { label: "Settings", action: "settings-pane" },
    { label: "Connection", action: "connection-pane" },
  ];

  /* Weyland: col2 = nav, col3 = terminal. Echo: flipped → col2 = terminal (chat), col3 = nav (gateway). */
  return (
    <div
      ref={cyberdeckRootRef}
      data-deck-mode={deckMode}
      className="terminal-window flex h-screen min-h-0 overflow-x-hidden bg-background font-mono text-green-500 max-md:flex-col max-md:overflow-y-auto md:overflow-hidden"
    >
      <CyberdeckBootSequence />
      <IndicateOverlay />
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
                  className="flex w-full items-center rounded px-3 py-2 text-left font-mono text-[10px] tracking-[0.08em] text-[#cfcfcf] transition hover:bg-[#171717] hover:text-emerald-200"
                >
                  {railTabContextMenu.serverId === "m"
                    ? "Focus operator panel"
                    : railTabContextMenu.serverId === "s"
                      ? "Focus connection panel"
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
                  className="flex w-full items-center rounded px-3 py-2 text-left font-mono text-[10px] tracking-[0.08em] text-[#cfcfcf] transition hover:bg-[#171717] hover:text-emerald-200"
                >
                  Copy server id
                </button>
              </>
            ) : (
              <>
                {customTabContextMenuActions.map((action) =>
                  action.action === "convert" ? (
                    <button
                      key={action.label}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        convertCustomTab(railTabContextMenu.tabId, action.kind);
                        closeRailTabContextMenu();
                      }}
                      className="flex w-full items-center rounded px-3 py-2 text-left font-mono text-[10px] tracking-[0.08em] text-[#cfcfcf] transition hover:bg-[#171717] hover:text-emerald-200"
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
                      className="flex w-full items-center rounded px-3 py-2 text-left font-mono text-[10px] tracking-[0.08em] text-[#cfcfcf] transition hover:bg-[#171717] hover:text-emerald-200"
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
                      className="flex w-full items-center rounded px-3 py-2 text-left font-mono text-[10px] tracking-[0.08em] text-[#cfcfcf] transition hover:bg-[#171717] hover:text-emerald-200"
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
                  className="flex w-full items-center rounded px-3 py-2 text-left font-mono text-[10px] tracking-[0.08em] text-[#ff8f8f] transition hover:bg-[#171717] hover:text-red-200"
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
                className="flex w-full items-center rounded px-3 py-2 text-left font-mono text-[10px] tracking-[0.08em] text-[#cfcfcf] transition hover:bg-[#171717] hover:text-emerald-200"
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
                className="flex w-full items-center rounded px-3 py-2 text-left font-mono text-[10px] tracking-[0.08em] text-[#cfcfcf] transition hover:bg-[#171717] hover:text-emerald-200"
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
                className="flex w-full items-center rounded px-3 py-2 text-left font-mono text-[10px] tracking-[0.08em] text-[#cfcfcf] transition hover:bg-[#171717] hover:text-emerald-200"
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
                className="flex w-full items-center rounded px-3 py-2 text-left font-mono text-[10px] tracking-[0.08em] text-[#cfcfcf] transition hover:bg-[#171717] hover:text-emerald-200"
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
                className="flex w-full items-center rounded px-3 py-2 text-left font-mono text-[10px] tracking-[0.08em] text-[#cfcfcf] transition hover:bg-[#171717] hover:text-emerald-200"
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
                className="flex w-full items-center rounded px-3 py-2 text-left font-mono text-[10px] tracking-[0.08em] text-[#cfcfcf] transition hover:bg-[#171717] hover:text-emerald-200"
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
                className="flex w-full items-center rounded px-3 py-2 text-left font-mono text-[10px] tracking-[0.08em] text-[#cfcfcf] transition hover:bg-[#171717] hover:text-emerald-200"
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
                className="flex w-full items-center rounded px-3 py-2 text-left font-mono text-[10px] tracking-[0.08em] text-[#cfcfcf] transition hover:bg-[#171717] hover:text-emerald-200"
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
                className="flex w-full items-center rounded px-3 py-2 text-left font-mono text-[10px] tracking-[0.08em] text-[#cfcfcf] transition hover:bg-[#171717] hover:text-emerald-200"
              >
                Open Diagnostics tab
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
      <aside
        ref={serverRailRef}
        tabIndex={-1}
        aria-label="Server rail"
        className="cyberdeck-server-rail z-40 flex w-12 flex-shrink-0 flex-col items-center border-r border-gray-800 bg-black py-4 outline-none focus-visible:ring-2 focus-visible:ring-green-500/35 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 md:min-h-0 md:overflow-y-auto md:overscroll-y-contain max-md:sticky max-md:top-[max(0px,env(safe-area-inset-top))] max-md:self-start max-md:bg-black/95 max-md:backdrop-blur-sm max-md:h-auto max-md:w-full max-md:flex-row max-md:flex-nowrap max-md:justify-start max-md:overflow-x-auto max-md:overscroll-x-contain max-md:snap-x max-md:snap-mandatory max-md:border-b max-md:border-r-0 max-md:px-2 max-md:py-2 max-md:touch-pan-x"
      >
        {fixedServers.map((btn) => (
          <cyberdeck-rail-tab
            key={btn.id}
            data-server-tab={btn.id}
            onContextMenu={(event) => handleRailTabContextMenu(btn.id, event)}
            {...createRailTabLongPressHandlers(btn.id)}
          >
            <pre
              className={`ascii-btn${railServer === btn.id ? " is-pushed" : ""}${
                navRailContext === "tabs" && serverKeyboardHighlightId === btn.id
                  ? " server-rail-kb-hover"
                  : ""
              }`}
              onClick={() => {
                if (consumeClickIfLongPress(btn.id)) return;
                setNavRailContext("gateway");
                setServerKeyboardHighlightId(null);
                handleTabClick(btn.id);
              }}
              style={{
                position: "absolute",
                inset: 0,
                margin: 0,
                cursor: "pointer",
              }}
            >
              {railServer === btn.id ? art.pushed(btn.glyph) : art.popped(btn.glyph)}
            </pre>
          </cyberdeck-rail-tab>
        ))}
        {customTabs.map((tab) => (
          <cyberdeck-rail-tab
            key={tab.id}
            data-server-tab={tab.id}
            onContextMenu={(event) => handleRailTabContextMenu(tab.id, event)}
            {...createRailTabLongPressHandlers(tab.id)}
          >
            <pre
              className={`ascii-btn${selectedRailTabId === tab.id ? " is-pushed" : ""}${
                navRailContext === "tabs" && serverKeyboardHighlightId === tab.id
                  ? " server-rail-kb-hover"
                  : ""
              }`}
              onClick={() => {
                if (consumeClickIfLongPress(tab.id)) return;
                setNavRailContext("gateway");
                setServerKeyboardHighlightId(null);
                handleTabClick(tab.id);
              }}
              style={{
                position: "absolute",
                inset: 0,
                margin: 0,
                cursor: "pointer",
              }}
            >
              {selectedRailTabId === tab.id ? art.pushed(tab.glyph) : art.popped(tab.glyph)}
            </pre>
          </cyberdeck-rail-tab>
        ))}
        <div className="flex w-12 shrink-0 flex-col gap-2 px-2 max-md:mt-0 max-md:snap-start md:mt-2">
          <button
            type="button"
            onClick={createBlankTab}
            className="flex h-8 w-8 items-center justify-center rounded border border-[#2d2d2d] bg-black font-mono text-[9px] leading-none tracking-[0.08em] text-[#8a8a8a] transition hover:border-emerald-500/60 hover:text-emerald-200"
          >
            +
          </button>
        </div>
      </aside>

        <ResizablePanelGroup
          orientation={isMobileLayout ? "vertical" : "horizontal"}
          className="min-h-0 min-w-0 flex-1"
        >
          {/* COL 2 (flipped): main terminal / chat — Weyland col3 */}
          <ResizablePanel defaultSize={isMobileLayout ? 98 : 55} minSize={isMobileLayout ? mobilePanelMinSize : 0}>
          <div
            ref={chatColumnRef}
            onContextMenu={handleMiragePaneContextMenu}
            className={`cyberdeck-net-pane cyberdeck-chat-app left flex h-full min-w-0 flex-col overflow-hidden border-b border-gray-800 bg-black md:border-b-0 md:border-r ${
              networkActivityActive ? "is-net-active" : ""
            }`}
          >
            {!isMobileLayout ? (
              <div className="border-b border-[#1a1a1a] px-2 py-1">
                <EchoHeader statusChipText={echoStatusChipText} />
              </div>
            ) : null}
            <div
              ref={messageScrollRef}
              tabIndex={-1}
              className="cyberdeck-chat-content custom-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto p-4 outline-none focus-visible:ring-1 focus-visible:ring-green-500/25"
            >
              {isMobileLayout ? (
                <div className="mb-2">
                  <EchoHeader statusChipText={echoStatusChipText} />
                </div>
              ) : null}
              <div className="message-log flex-1 space-y-3">
                {messages.map((m, i) => {
                  const isModelConnectedLine =
                    m.role === "system" && typeof m.text === "string" && m.text.includes("MODEL_CONNECTED");
                  const isSystemFailureLine =
                    m.role === "system" &&
                    typeof m.text === "string" &&
                    /(failure|failuer|failed|invalid_key|auth_rejected|uplink_error|api\s*error|http_[45]\d{2}|empty_response|rate_limit)/i.test(
                      m.text,
                    );
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
                        <span className="cyberdeck-cogitating-text">COGITATING...</span>
                      </span>
                    </div>
                  )}
                <div ref={messagesEndRef} />
              </div>
            </div>

            <footer className="cyberdeck-message-box shrink-0 bg-black p-0">
              <div className="m-2 rounded-sm border border-green-900/70 bg-black transition-colors transition-shadow focus-within:border-green-500/80 focus-within:shadow-[0_0_0_1px_rgba(34,197,94,0.45),0_0_18px_rgba(34,197,94,0.2)]">
                <div className="relative flex items-center px-2 py-2">
                  <span className="pointer-events-none absolute left-3 text-lg font-bold text-green-500">$</span>
                  <input
                    ref={messageInputRef}
                    value={input}
                    onChange={(e) => {
                      setInput(e.target.value);
                      if (inputHistoryIndex !== null) {
                        setInputHistoryIndex(null);
                      }
                      setInputCaretIndex(e.target.selectionStart ?? e.target.value.length);
                    }}
                    onKeyDown={handleInputHistoryKeyDown}
                    onKeyUp={syncInputCaret}
                    onClick={syncInputCaret}
                    onSelect={syncInputCaret}
                    onFocus={() => {
                      setIsInputFocused(true);
                      setChatKeyboardHighlightIndex(null);
                      syncInputCaret();
                    }}
                    onBlur={() => setIsInputFocused(false)}
                    placeholder={!hasProviderAuth ? "ENTER GATEWAY KEY..." : "Enter command or message..."}
                    className={`w-full rounded-none border-0 bg-black py-3 pl-9 pr-3 font-mono text-sm text-green-400 placeholder:text-green-800 transition-all focus:outline-none ${
                      isInputFocused ? "caret-transparent" : ""
                    }`}
                    disabled={false}
                  />
                    {isInputFocused && !isStreaming && inputCursorBlinkOn ? (
                      <span
                        aria-hidden
                        className="pointer-events-none absolute top-[calc(50%+9px)] -translate-y-1/2 bg-green-400 px-[1px] font-mono text-sm leading-5 text-black"
                        style={{ left: `${inputCursorLeft}px` }}
                      >
                        {input[inputCaretIndex] ? input[inputCaretIndex] : "\u00A0"}
                      </span>
                  ) : null}
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
                    {connectionState === "offline"
                      ? "DISCONNECTED"
                      : modelID
                        ? modelID.split("/").pop()
                        : "UNSET"}{" "}
                    {isStreaming ? "STREAMING" : ""}
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={toggleVoiceEnabled}
                      aria-label={voiceEnabled ? "Voice on" : "Voice off"}
                      title={voiceEnabled ? "Voice on" : "Voice off"}
                      className={`inline-flex h-8 w-8 items-center justify-center rounded-[6px] border text-[10px] font-mono transition-[transform,box-shadow,background-color,border-color,color] duration-150 ease-out hover:-translate-y-px hover:border-emerald-500 hover:bg-emerald-500/10 hover:text-emerald-200 active:translate-y-px active:scale-[0.98] ${voiceButtonClassName}`}
                      style={{ transform: voiceButtonTransform }}
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
                    {voiceEnabled && voiceBlockTotal > 0 ? (
                      <>
                        <span
                          className="hidden min-w-[2.5rem] text-right font-mono text-[9px] text-gray-600 sm:inline"
                          title="Paragraph position (◀ = speak one earlier paragraph only)"
                        >
                          {voiceBlockTotal > 1 ? `${voiceBlockFocusIndex + 1}/${voiceBlockTotal}` : `${voiceBlockTotal}`}
                        </span>
                        <button
                          type="button"
                          onClick={() => abortMotherSpeech()}
                          disabled={!voicePlaybackBusy}
                          aria-label="Stop speech"
                          title="Stop speech (Esc)"
                          className="inline-flex h-8 min-w-[1.75rem] items-center justify-center rounded-[6px] border border-gray-700 bg-black px-1 font-mono text-[11px] text-gray-400 transition hover:border-amber-600/80 hover:text-amber-200 disabled:cursor-not-allowed disabled:opacity-35"
                        >
                          ‖
                        </button>
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
                          title="Earlier paragraph (more context)"
                          className="inline-flex h-8 min-w-[1.75rem] items-center justify-center rounded-[6px] border border-gray-700 bg-black px-1 font-mono text-[11px] text-gray-400 transition hover:border-emerald-600/80 hover:text-emerald-200 disabled:cursor-not-allowed disabled:opacity-35"
                        >
                          ◀
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            abortMotherSpeech();
                            replayFullLastAssistant();
                          }}
                          aria-label="Replay full response"
                          title="Replay entire last reply"
                          className="inline-flex h-8 min-w-[1.75rem] items-center justify-center rounded-[6px] border border-gray-700 bg-black px-1 font-mono text-[11px] text-gray-400 transition hover:border-emerald-600/80 hover:text-emerald-200"
                        >
                          ↻
                        </button>
                      </>
                    ) : null}
                    {!isStreaming ? (
                      <button
                        type="button"
                        onClick={() => void handleSend()}
                        disabled={!input.trim()}
                        aria-label="Send"
                        title="Send"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-[6px] border border-emerald-700/80 bg-black text-emerald-300 origin-center shadow-[0_0_0_1px_rgba(16,185,129,0.16)_inset,0_3px_10px_rgba(0,0,0,0.5)] transition-[transform,box-shadow,background-color,border-color,color] duration-150 ease-out hover:-translate-y-px hover:border-emerald-500 hover:bg-emerald-500/10 hover:text-emerald-200 active:translate-y-px active:scale-[0.98] active:ease-in active:shadow-[0_0_0_1px_rgba(16,185,129,0.18)_inset,0_1px_4px_rgba(0,0,0,0.55)] disabled:cursor-not-allowed disabled:opacity-40"
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
                    ) : (
                      <button
                        type="button"
                        onClick={handleStop}
                        aria-label="Stop"
                        title="Stop"
                        className="rounded border border-red-700 px-2 py-1 text-[10px] font-mono text-red-300 transition hover:border-red-500 hover:text-red-200"
                      >
                        <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true">
                          <rect x="6.5" y="6.5" width="11" height="11" rx="1.2" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </footer>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle stacked={isMobileLayout} className="flex" />

        {/* COL 3 (flipped): gateway nav — Weyland col2 */}
          <ResizablePanel defaultSize={isMobileLayout ? 2 : 45} minSize={isMobileLayout ? mobilePanelMinSize : 0.01}>
          <div
            ref={gatewayColumnRef}
            tabIndex={-1}
            aria-label="Gateway"
            onContextMenu={handleGatewayPaneContextMenu}
            onDragOver={handleThirdColumnDragOver}
            onDragLeave={handleThirdColumnDragLeave}
            onDrop={handleThirdColumnDrop}
            className={`cyberdeck-net-pane right flex h-full min-w-0 flex-col border-gray-800 bg-black outline-none focus-visible:ring-2 focus-visible:ring-green-500/35 focus-visible:ring-offset-2 focus-visible:ring-offset-black md:border-l ${
              networkActivityActive ? "is-net-active" : ""
            } ${isMarkdownDragOver ? "ring-2 ring-amber-500/50 ring-inset" : ""}`}
          >
            <MirageHeader />
            <p className="sr-only">
              Command. Catalog. Operators. Memory Atlas. Voice Lab. Flight Log. Settings. Craftwerk Cyberdeck
              Corporation. ChatGPT // Lead. Cursor // Dev. Codex // Test. Samus-Manus // Memory. ASCII. REALMORPH.
            </p>
            {activeCustomTab ? (
              renderCustomTabSurface(activeCustomTab)
            ) : showGatewayPanel ? (
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

                  <div className="mb-3 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={clearSavedCustomTabState}
                      className="rounded border border-[#2d2d2d] bg-black px-2 py-1 font-mono text-[9px] tracking-[0.08em] text-[#8a8a8a] transition hover:border-amber-500/60 hover:text-amber-200"
                    >
                      CLEAR TAB STATE
                    </button>
                    <div className="font-mono text-[9px] tracking-[0.08em] text-[#6a6a6a]">
                      Clears live and saved custom tabs.
                    </div>
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
                              "--nav-hover-shadow": selected
                                ? "0 0 10px rgba(54, 255, 115, 0.30)"
                                : inactiveTextGlow,
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
                    <div
                      className="mb-2 font-mono text-[10px]"
                      style={{ color: inactiveTextColor, textShadow: inactiveTextGlow }}
                    >
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
              </div>
            ) : server === "m" ? (
            <CyberdeckOperatorPaneBody
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
              onSaveOperatorDocAsFile={saveOperatorDocAsFile}
              onCopyOperatorDocToClipboard={copyOperatorDocToClipboard}
              onSetOperatorDroppedAsset={setOperatorDroppedAsset}
            />
            ) : server === "b" ? (
              <div ref={gatewayBlankSettingsRef} className="flex min-h-0 flex-1 flex-col">
                <CyberdeckSettingsPaneBody
                  voiceEnabled={voiceEnabled}
                  onVoiceToggle={toggleVoiceEnabled}
                  muthurMasterVolume={voiceDial.volume}
                  onMuthurMasterVolumeChange={(volume) =>
                    setVoiceDial((prev) => ({
                      ...prev,
                      volume: Math.min(1.25, Math.max(0.05, volume)),
                    }))
                  }
                  deckMode={deckMode}
                  onDeckModeToggle={toggleDeckMode}
                  audioMuted={audioMuted}
                  onAudioMuteToggle={toggleAudioMuted}
                  identity={identity}
                />
              </div>
            ) : null}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}











