"use client";

import { useState, useRef, useEffect, useLayoutEffect, useCallback } from "react";
import type { CSSProperties, DragEvent as ReactDragEvent } from "react";
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
  loadMuthurMemory,
  recordMuthurMemoryTurn,
  saveMuthurMemory,
  type MuthurMemoryState,
} from "@/lib/muthur-memory";
import { speakDryFallback } from "@/voice/speakMuthur";
import { copyTextToClipboard } from "@/lib/grok-image-prompt";
import { get, set } from "idb-keyval";
import { Knob } from "@/components/ui/knob";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

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
  { id: "s", glyph: "μ", label: "MAINNET-UPLINK" },
  { id: "h", glyph: "H", label: "HEAP" },
  { id: "b", glyph: "§", label: "SETTINGS" },
] as const;

const SERVER_IDS = servers.map((s) => s.id);
const HEAP_STORAGE_KEY = "echo-mirage-heap-items";
const CHAT_STORAGE_KEY = "echo-mirage-chat-messages-v1";
const CHAT_STREAM_STORAGE_KEY = "echo-mirage-chat-stream-text-v1";
const INPUT_STORAGE_KEY = "echo-mirage-chat-input-v1";
const UI_STATE_STORAGE_KEY = "echo-mirage-ui-state-v1";

type CyberdeckUiState = {
  server: (typeof SERVER_IDS)[number];
  navRailContext: "gateway" | "tabs";
  serverKeyboardHighlightId: (typeof SERVER_IDS)[number] | null;
};

/** Gateway SYS lines; link phrases must match `renderGatewayMessageText` splits. */
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

export default function CyberdeckPage() {
  type ChatMessage = { role: string; text: string };
  // Start on the operator tab; disconnected users are redirected to MAINNET-UPLINK after hydration.
  const [server, setServer] = useState<(typeof SERVER_IDS)[number]>("m");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatHydrated, setChatHydrated] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [generatedUI, setGeneratedUI] = useState<string | null>(null);
  const [droppedMarkdown, setDroppedMarkdown] = useState<string | null>(null);
  const [droppedMarkdownName, setDroppedMarkdownName] = useState<string>("");
  const [operatorDroppedAsset, setOperatorDroppedAsset] = useState<DroppedOperatorAsset | null>(null);
  const [operatorDocMode, setOperatorDocMode] = useState<"view" | "edit">("view");
  const [operatorDocNameDraft, setOperatorDocNameDraft] = useState("");
  const [isMarkdownDragOver, setIsMarkdownDragOver] = useState(false);
  const [isOperatorDragOver, setIsOperatorDragOver] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [isMobileLayout, setIsMobileLayout] = useState(false);
  const [inputCursorBlinkOn, setInputCursorBlinkOn] = useState(true);
  const [inputCursorLeft, setInputCursorLeft] = useState(0);
  const [inputCaretIndex, setInputCaretIndex] = useState(0);
  const [chatKeyboardHighlightIndex, setChatKeyboardHighlightIndex] = useState<number | null>(null);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [voiceDial, setVoiceDial] = useState<MuthurVoiceDialState>(getInitialMuthurVoiceDials);
  const [voiceHealth, setVoiceHealth] = useState<"idle" | "backend" | "fallback" | "off">("idle");
  const [muthurMemory, setMuthurMemory] = useState<MuthurMemoryState>(() => createEmptyMuthurMemory());
  const [muthurMemoryHydrated, setMuthurMemoryHydrated] = useState(false);
  const [heapEntries, setHeapEntries] = useState<HeapEntry[]>([]);
  const [heapNameDraft, setHeapNameDraft] = useState("");
  const [heapTextDraft, setHeapTextDraft] = useState("");
  const [heapHydrated, setHeapHydrated] = useState(false);

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
  const cyberdeckRootRef = useRef<HTMLDivElement>(null);
  const chatAbortRef = useRef<AbortController | null>(null);
  const lastSpokenAssistantTextRef = useRef<string>("");
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
    setInputCaretIndex(idx);

    // Measure monospace text width before caret to place a block cursor overlay.
    const computed = window.getComputedStyle(el);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.font = computed.font;
    const before = input.slice(0, idx);
    const padLeft = Number.parseFloat(computed.paddingLeft || "0") || 0;
    const x = padLeft + ctx.measureText(before).width - el.scrollLeft;
    setInputCursorLeft(Math.max(padLeft, x));
  }, [input]);

  const providers = [
    { id: "opencode" as const, name: "OPENCODE" },
    { id: "openrouter" as const, name: "OPENROUTER" },
    { id: "openai" as const, name: "OPENAI" },
  ] as const;

  const modelID = modelByProvider[activeProvider] || "";
  const activeTabLabel =
    server === "m"
      ? "ØPERATOR"
      : server === "s"
        ? "MAINNET-UPLINK"
        : server === "h"
          ? "HEAP"
          : "SETTINGS";
  const providerModelFetchStatus = modelFetchStatusByProvider[activeProvider] || "idle";
  const scanActivityActive =
    Boolean(probeInFlightByProvider[activeProvider]) || providerModelFetchStatus === "retrieving";
  const networkActivityActive =
    Boolean(probeInFlightByProvider[activeProvider]) ||
    providerModelFetchStatus === "retrieving" ||
    isStreaming;
  const hasProviderAuth = Boolean(providerKeys[activeProvider]) || Boolean(defaultKeyAvailableByProvider[activeProvider]);
  const isConnected = hasProviderAuth && Boolean(modelID) && providerModelFetchStatus === "ready";
  const connectionState: "offline" | "connecting" | "connected" = scanActivityActive
    ? "connecting"
    : isConnected
      ? "connected"
      : "offline";
  const showGatewayPanel = server === "s";
  const railServer = server;
  serverRef.current = server;

  const inactiveTextColor = "#7a7a7a";
  const inactiveSubtleTextColor = "#6a6a6a";
  const activeTextGlow = "0 0 8px rgba(0, 255, 0, 0.22)";
  const amberTextGlow = "0 0 8px rgba(255, 170, 0, 0.22)";
  const inactiveTextGlow = "0 0 6px rgba(180, 180, 180, 0.14)";

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
    if (line.includes("EMPTY_RESPONSE")) {
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
      const loaded = await loadMuthurMemory();
      if (cancelled) return;
      muthurMemoryRef.current = loaded;
      setMuthurMemory(loaded);
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
            .map((item) => ({ role: item.role, text: item.text }));
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
      }
    } catch {
      /* ignore ui restore errors */
    } finally {
      if (restored) {
        startupRailResolvedRef.current = true;
      }
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
      };
      window.localStorage.setItem(UI_STATE_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      /* ignore */
    }
  }, [deckUiHydrated, navRailContext, server, serverKeyboardHighlightId]);

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
      setOperatorDocMode("view");
      return;
    }

    if (kind === "video") {
      setOperatorDroppedAsset(baseAsset);
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
      setOperatorDocMode("view");
      return;
    }

    setOperatorDroppedAsset(baseAsset);
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

  const handleServerClick = useCallback((id: (typeof SERVER_IDS)[number]) => {
    if (server !== id) {
      setServer(id);
      playSystemSound("chirp");
    } else {
      playSystemSound("click", 0.05);
    }
  }, [server]);

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
      startSonarLoop(3200);
    } else {
      stopSonarLoop();
    }
    return () => stopSonarLoop();
  }, [scanActivityActive]);

  useEffect(() => {
    if (isStreaming) {
      if (chatSonarDelayRef.current == null) {
        chatSonarDelayRef.current = window.setTimeout(() => {
          startSonarLoop(3200);
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
        const line = `MODEL_TEST ${provider.toUpperCase()}/${model}: ${valid ? "VALID_RESPONSE" : "EMPTY_RESPONSE"}`;
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
    [playModelTestErrorSound, setModelHealth],
  );

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
      playSystemSound("click", 0.05);
      void probeSelectedModel(activeProvider, modelId, key || "");
    },
    [activeProvider, probeSelectedModel, providerKeys],
  );

  // Column-scoped arrows: rail / chat scroll / gateway (providers + models). Tab rail: Escape; Enter on rail → gateway + provider hover.
  useEffect(() => {
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t) return;

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
        if (server === "h") {
          e.preventDefault();
          void pasteClipboardToHeap();
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
            serverKeyboardHighlightId ?? (sids.includes(railServer) ? railServer : sids[0]);
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
            handleServerClick(serverKeyboardHighlightId ?? sPivot);
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
    handleServerClick,
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
          if (nextModel && nextModel !== current) {
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
  }, [activeProvider, probeSelectedModel, providerKeys]);

  useEffect(() => {
    if (!voiceEnabled || isStreaming) return;
    if (speakQueueActiveRef.current) return;
    if (!messages || messages.length === 0) return;
    const latest = messages[messages.length - 1];
    if (!latest || latest.role !== "assistant") return;
    if (latest.text === lastSpokenAssistantTextRef.current) return;
    if (/^Working on that request\b/i.test(latest.text.trim())) return;
    lastSpokenAssistantTextRef.current = latest.text;
    const speechText = textForSpeech(latest.text);
    if (!speechText) return;
    if (motherTerminalRef.current.shouldBurst(speechText)) {
      void motherTerminalRef.current.unlock().then(() => {
        motherTerminalRef.current.playBurstSound(speechText.length);
      });
    }
    void speakMother(speechText);
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
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: userMessage }]);
    setIsStreaming(true);
    setStreamText("");
    setGeneratedUI(null);

    // Gateway key registration (weyland: set key + LS, model fetch effect validates)
    if (!hasProviderAuth) {
      handleModelLabelClick();
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
      handleModelLabelClick();
      setMessages((prev) => [
        ...prev,
        { role: "system", text: "NO_MODEL_SELECTED // WAIT_FOR_MODELS_OR_CHECK_KEY" },
      ]);
      setIsStreaming(false);
      return;
    }

    try {
      const abortCtl = new AbortController();
      chatAbortRef.current = abortCtl;
      const memoryContext = buildMuthurMemoryContext(muthurMemoryRef.current, userMessage);
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
      setIsStreaming(false);
    }
  };

  const handleStop = useCallback(() => {
    if (!isStreaming) return;
    chatAbortRef.current?.abort();
  }, [isStreaming]);

  const handleModelLabelClick = useCallback(() => {
    setServer("s");
    setNavRailContext("gateway");
    setServerKeyboardHighlightId(null);
    setProviderKeyboardHighlightId(activeProvider);
    setModelKeyboardHighlightId(modelID || null);
    gatewayColumnRef.current?.focus({ preventScroll: true });
    gatewayConnectionPanelRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeProvider, modelID]);

  useEffect(() => {
    if (!didHydrateProviderState || startupRailResolvedRef.current) return;
    if (hasProviderAuth) {
      setServer("m");
      startupRailResolvedRef.current = true;
      return;
    }
    if (connectionState === "offline") {
      handleModelLabelClick();
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
      handleModelLabelClick();
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

  /* Weyland: col2 = nav, col3 = terminal. Echo: flipped → col2 = terminal (chat), col3 = nav (gateway). */
  return (
    <div
      ref={cyberdeckRootRef}
      className="terminal-window flex h-screen overflow-hidden bg-background font-mono text-green-500 max-md:flex-col"
    >
      <aside
        ref={serverRailRef}
        tabIndex={-1}
        aria-label="Server rail"
        className="cyberdeck-server-rail z-40 flex w-12 flex-shrink-0 flex-col items-center border-r border-gray-800 bg-black py-4 outline-none focus-visible:ring-2 focus-visible:ring-green-500/35 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 max-md:h-auto max-md:w-full max-md:flex-row max-md:justify-start max-md:overflow-x-auto max-md:border-b max-md:border-r-0 max-md:px-2 max-md:py-2"
      >
        {servers.map((btn) => (
          <div
            key={btn.id}
            className="btn-container"
            style={{ width: "48px", height: "52px", position: "relative" }}
          >
            <pre
              data-server-tab={btn.id}
              className={`ascii-btn${railServer === btn.id ? " is-pushed" : ""}${
                navRailContext === "tabs" && serverKeyboardHighlightId === btn.id
                  ? " server-rail-kb-hover"
                  : ""
              }`}
              onClick={() => {
                setNavRailContext("gateway");
                setServerKeyboardHighlightId(null);
                handleServerClick(btn.id);
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
          </div>
        ))}
      </aside>

      <ResizablePanelGroup
        orientation={isMobileLayout ? "vertical" : "horizontal"}
        className="min-h-0 min-w-0 flex-1"
      >
        {/* COL 2 (flipped): main terminal / chat — Weyland col3 */}
        <ResizablePanel defaultSize={isMobileLayout ? 66 : 55} minSize={0}>
          <div
            ref={chatColumnRef}
            className={`cyberdeck-net-pane cyberdeck-chat-app left flex h-full min-w-0 flex-col overflow-hidden border-b border-gray-800 bg-black md:border-b-0 md:border-r ${
              networkActivityActive ? "is-net-active" : ""
            }`}
          >
            <header className="relative flex shrink-0 items-end justify-end overflow-visible border-b border-gray-800 bg-black px-6 py-2">
              <div
                className="absolute left-6 top-2 font-mono text-[9px] tracking-[0.2em] text-[#8a8a8a]"
                style={{ textShadow: "0 0 6px rgba(138,138,138,0.2)" }}
              >
                [{activeTabLabel}]
              </div>
              <pre
                className="cyberdeck-net-logo m-0 whitespace-pre font-mono text-[4px] leading-[1.0] text-green-400"
                style={{ textShadow: "0 0 5px #00ff00" }}
              >
                {`
          _            _             _       _    _       
        ╱╲ ╲         ╱╲ ╲           ╱ ╱╲    ╱ ╱╲ ╱╲ ╲     
       ╱  ╲ ╲       ╱  ╲ ╲         ╱ ╱ ╱   ╱ ╱ ╱╱  ╲ ╲    
      ╱ ╱╲ ╲ ╲     ╱ ╱╲ ╲ ╲       ╱ ╱_╱   ╱ ╱ ╱╱ ╱╲ ╲ ╲   
     ╱ ╱ ╱╲ ╲_╲   ╱ ╱ ╱╲ ╲ ╲     ╱ ╱╲ ╲__╱ ╱ ╱╱ ╱ ╱╲ ╲ ╲  
    ╱ ╱_╱_ ╲╱_╱  ╱ ╱ ╱  ╲ ╲_╲   ╱ ╱╲ ╲___╲╱ ╱╱ ╱ ╱  ╲ ╲_╲ 
   ╱ ╱____╱╲    ╱ ╱ ╱    ╲╱_╱  ╱ ╱ ╱╲╱___╱ ╱╱ ╱ ╱   ╱ ╱ ╱ 
  ╱ ╱╲____╲╱   ╱ ╱ ╱          ╱ ╱ ╱   ╱ ╱ ╱╱ ╱ ╱   ╱ ╱ ╱  
 ╱ ╱ ╱______  ╱ ╱ ╱________  ╱ ╱ ╱   ╱ ╱ ╱╱ ╱ ╱___╱ ╱ ╱   
╱ ╱ ╱_______╲╱ ╱ ╱_________╲╱ ╱ ╱   ╱ ╱ ╱╱ ╱ ╱____╲╱ ╱    
╲╱__________╱╲╱____________╱╲╱_╱    ╲╱_╱ ╲╱_________╱`}
              </pre>
            </header>
            <div
              ref={messageScrollRef}
              tabIndex={-1}
              className="cyberdeck-chat-content custom-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto p-4 outline-none focus-visible:ring-1 focus-visible:ring-green-500/25"
            >
              <div className="message-log flex-1 space-y-3">
                {messages.map((m, i) => {
                  const isModelConnectedLine =
                    m.role === "system" && typeof m.text === "string" && m.text.includes("MODEL_CONNECTED");
                  const isSystemFailureLine =
                    m.role === "system" &&
                    typeof m.text === "string" &&
                    /(FAILURE|FAILUER|FAILED|INVALID_KEY|AUTH_REJECTED|UPLINK_ERROR|ERROR|HTTP_[45]\d{2}|EMPTY_RESPONSE)/.test(
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
                          ? "text-green-300"
                          : isSystemFailureLine
                            ? "text-red-300"
                            : "text-gray-300"
                      }
                    >
                      {m.role === "system" ? (
                        <span className="whitespace-pre-wrap">{renderGatewayMessageText(m.text)}</span>
                      ) : (
                        <span className="whitespace-pre-wrap">{m.text}</span>
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
                    <span className="text-green-300">{streamText}</span>
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
                    <span className="animate-pulse">█</span> COGITATING...
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
                      setInputCaretIndex(e.target.selectionStart ?? e.target.value.length);
                    }}
                    onKeyDown={(e) => e.key === "Enter" && handleSend()}
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
                      className="pointer-events-none absolute top-1/2 -translate-y-1/2 bg-green-400 px-[1px] font-mono text-sm leading-5 text-black"
                      style={{ left: `${inputCursorLeft}px` }}
                    >
                      {input[inputCaretIndex] ? input[inputCaretIndex] : "\u00A0"}
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center justify-between px-3 py-2">
                  <button
                    type="button"
                    onClick={handleModelLabelClick}
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
        <ResizablePanel defaultSize={isMobileLayout ? 34 : 45} minSize={0}>
          <div
            ref={gatewayColumnRef}
            tabIndex={-1}
            aria-label="Gateway"
            onDragOver={handleThirdColumnDragOver}
            onDragLeave={handleThirdColumnDragLeave}
            onDrop={handleThirdColumnDrop}
            className={`cyberdeck-net-pane right flex h-full min-w-0 flex-col border-gray-800 bg-black outline-none focus-visible:ring-2 focus-visible:ring-green-500/35 focus-visible:ring-offset-2 focus-visible:ring-offset-black md:border-l ${
              networkActivityActive ? "is-net-active" : ""
            } ${isMarkdownDragOver ? "ring-2 ring-amber-500/50 ring-inset" : ""}`}
          >
            <header className="flex shrink-0 flex-col items-start gap-1 overflow-visible border-b border-gray-800 bg-black px-6 py-2">
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
            {showGatewayPanel ? (
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
            <div
              className={`custom-scrollbar flex flex-1 flex-col overflow-y-auto bg-black p-4 ${
                isOperatorDragOver ? "ring-2 ring-amber-500/50 ring-inset" : ""
              }`}
              onDragOver={handleOperatorDragOver}
              onDragLeave={handleOperatorDragLeave}
              onDrop={handleOperatorDrop}
            >
              <div
                  className={`flex flex-1 flex-col rounded-sm border border-[#141414] bg-black transition-colors ${
                    isOperatorDragOver ? "border-amber-500/60 ring-2 ring-amber-500/35 ring-inset" : ""
                  }`}
                >
                  <div className="flex items-center justify-between border-b border-[#141414] px-3 py-2">
                    <div className="min-w-0 flex-1 pr-3">
                      {operatorSurfaceIsDocument && operatorDocMode === "edit" ? (
                        <input
                          ref={operatorNameInputRef}
                          value={operatorDocNameDraft}
                          onChange={(event) => setOperatorDocNameDraft(event.target.value)}
                          onBlur={commitOperatorDocName}
                          onKeyDown={(event) => {
                            if (event.key !== "Enter") return;
                            event.preventDefault();
                            commitOperatorDocName();
                            operatorNameInputRef.current?.blur();
                          }}
                          spellCheck={false}
                          autoCapitalize="off"
                          autoComplete="off"
                          autoCorrect="off"
                          aria-label="Rename operator document"
                          className="w-full border-0 bg-transparent font-mono text-[10px] tracking-[0.04em] text-[#cfcfcf] outline-none placeholder:text-[#5a5a5a]"
                          style={{ textShadow: "0 0 6px rgba(138,138,138,0.2)" }}
                        />
                      ) : (
                        <div
                          className="truncate font-mono text-[10px] tracking-[0.04em] text-[#8a8a8a]"
                          style={{ textShadow: "0 0 6px rgba(138,138,138,0.2)" }}
                        >
                          {operatorDroppedAsset ? operatorDroppedAsset.name : "OPERATOR_DOC_SURFACE"}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void pasteClipboardToOperator()}
                        className="rounded border border-[#2d2d2d] bg-black px-2 py-1 font-mono text-[9px] tracking-[0.08em] text-[#8a8a8a] transition hover:border-emerald-500/60 hover:text-emerald-200"
                      >
                        PASTE
                      </button>
                      {operatorSurfaceIsDocument ? (
                        <>
                          <div className="flex items-center gap-2 font-mono text-[9px] tracking-[0.08em] text-[#8a8a8a]">
                            <span className={operatorDocMode === "view" ? "text-emerald-200" : ""}>VIEW</span>
                            <Switch
                              checked={operatorDocMode === "edit"}
                              onCheckedChange={(checked) => {
                                if (!checked) {
                                  commitOperatorDocName();
                                  setOperatorDocMode("view");
                                  return;
                                }
                                setOperatorDocMode("edit");
                              }}
                              aria-label="Toggle operator view edit mode"
                              className="data-[state=checked]:border-emerald-500/70 data-[state=checked]:bg-emerald-500/10 data-[state=unchecked]:border-[#2d2d2d] data-[state=unchecked]:bg-[#0c0c0c]"
                            />
                            <span className={operatorDocMode === "edit" ? "text-emerald-200" : ""}>EDIT</span>
                          </div>
                        </>
                      ) : operatorDroppedAsset ? (
                        <div className="font-mono text-[9px] tracking-[0.08em] text-[#8a8a8a]">
                          {operatorDroppedAsset.kind.toUpperCase()}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  {operatorDroppedAsset ? (
                    <div className="flex-1 overflow-auto p-3">
                      <div className="mb-4 font-mono text-[9px] tracking-[0.04em] text-[#8a8a8a]">
                        {operatorDroppedAsset.mimeType || "application/octet-stream"} //{" "}
                        {Math.max(1, Math.round(operatorDroppedAsset.size / 1024))} KB
                      </div>
                      {operatorSurfaceIsDocument ? (
                        <div className="mb-3 flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => void saveOperatorDocAsFile()}
                            aria-label="Save operator document"
                            title="Save operator document"
                            className="inline-flex h-7 w-7 items-center justify-center rounded border border-[#2d2d2d] bg-black text-[#8a8a8a] transition hover:border-emerald-500/60 hover:text-emerald-200"
                          >
                            <DownloadIcon className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void copyOperatorDocToClipboard()}
                            aria-label="Copy operator document"
                            title="Copy operator document"
                            className="inline-flex h-7 w-7 items-center justify-center rounded border border-[#2d2d2d] bg-black text-[#8a8a8a] transition hover:border-emerald-500/60 hover:text-emerald-200"
                          >
                            <CopyIcon className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : null}
                      {operatorDroppedAsset.kind === "image" ? (
                        <div className="rounded-sm border border-[#1c1c1c] bg-black/80 p-3">
                          <div className="mb-2 font-mono text-[9px] tracking-[0.04em] text-[#8a8a8a]">
                            IMAGE PREVIEW
                          </div>
                          {operatorDroppedAsset.imageSrc ? (
                            <img
                              src={operatorDroppedAsset.imageSrc}
                              alt={operatorDroppedAsset.name}
                              className="max-h-[72vh] w-full rounded-sm border border-[#1c1c1c] object-contain"
                              draggable={false}
                            />
                          ) : (
                            <div className="rounded-sm border border-dashed border-[#1c1c1c] bg-black p-4 font-mono text-[10px] leading-snug text-[#8a8a8a]">
                              Could not load image preview.
                            </div>
                          )}
                        </div>
                      ) : operatorSurfaceIsDocument ? (
                        operatorDocMode === "edit" ? (
                          <Textarea
                            ref={operatorEditorRef}
                            value={operatorDroppedAsset.text || ""}
                            onChange={(event) => {
                              const nextText = event.target.value;
                              setOperatorDroppedAsset((prev) =>
                                prev ? { ...prev, text: nextText } : prev,
                              );
                            }}
                            spellCheck={false}
                            autoCapitalize="off"
                            autoComplete="off"
                            autoCorrect="off"
                            wrap="off"
                            className="min-h-0 resize-none overflow-hidden rounded-sm border border-[#1c1c1c] bg-black px-3 py-3 font-mono text-[12px] leading-snug text-green-200 shadow-none focus-visible:ring-1 focus-visible:ring-amber-500/40"
                            style={
                              operatorDocMode === "edit"
                                ? {
                                    height:
                                      operatorEditorRef.current?.style.height || "auto",
                                  }
                                : undefined
                            }
                          />
                        ) : operatorDroppedAsset.kind === "markdown" ? (
                          <div className="rounded-sm border border-green-900/70 bg-black/70 p-3">
                            <Streamdown className="prose prose-invert prose-pre:bg-black prose-pre:text-green-300 max-w-none text-[12px] leading-snug text-green-200">
                              {operatorDroppedAsset.text || ""}
                            </Streamdown>
                          </div>
                        ) : (
                          <pre className="min-h-[50vh] whitespace-pre-wrap break-words rounded-sm border border-[#1c1c1c] bg-black p-3 font-mono text-[12px] leading-snug text-green-200">
                            {operatorDroppedAsset.text || ""}
                          </pre>
                        )
                      ) : (
                        <div className="rounded-sm border border-dashed border-amber-700/60 bg-black p-4 font-mono text-[10px] leading-snug text-amber-300/90">
                          {operatorDroppedAsset.kind === "video"
                            ? "Video preview comes next. Drop a code or text file to edit it here."
                            : "Drop or paste a code, text, markdown, or image file here to view and edit it."}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-1 items-center justify-center p-6 text-center font-mono text-[10px] tracking-[0.08em] text-[#8a8a8a]">
                      DROP OR PASTE CODE, TEXT, MARKDOWN, OR IMAGE FILES HERE TO VIEW AND EDIT THEM.
                    </div>
                  )}
                </div>
              </div>
            ) : server === "h" ? (
              <div className="custom-scrollbar flex flex-1 flex-col overflow-y-auto bg-black p-4">
                <div className="flex flex-1 flex-col rounded-sm border border-[#141414] bg-black transition-colors">
                  <div className="flex items-center justify-between border-b border-[#141414] px-3 py-2">
                    <div className="min-w-0 flex-1 pr-3">
                      <div
                        className="truncate font-mono text-[10px] tracking-[0.04em] text-[#8a8a8a]"
                        style={{ textShadow: "0 0 6px rgba(138,138,138,0.2)" }}
                      >
                        ECHO MIRAGE HEAP
                      </div>
                      <div className="mt-1 font-mono text-[9px] tracking-[0.04em] text-[#6f6f6f]">
                        LOCAL BACKFILE // INDEXEDDB
                      </div>
                    </div>
                    <div className="font-mono text-[9px] tracking-[0.08em] text-[#8a8a8a]">
                      {heapEntries.length} ITEMS
                    </div>
                  </div>

                  <div className="flex flex-1 flex-col gap-4 overflow-auto p-3">
                    <div className="rounded-sm border border-[#1c1c1c] bg-black/80 p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <div className="font-mono text-[9px] tracking-[0.04em] text-[#8a8a8a]">
                          NEW HEAP ENTRY
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => void pasteClipboardToHeap()}
                            className="rounded border border-emerald-700/70 bg-black px-2 py-1 font-mono text-[9px] tracking-[0.08em] text-emerald-300 transition hover:border-emerald-500 hover:bg-emerald-500/10 hover:text-emerald-200"
                          >
                            PASTE CLIPBOARD
                          </button>
                          <button
                            type="button"
                            onClick={() => void saveHeapDraft()}
                            className="rounded border border-emerald-700/70 bg-black px-2 py-1 font-mono text-[9px] tracking-[0.08em] text-emerald-300 transition hover:border-emerald-500 hover:bg-emerald-500/10 hover:text-emerald-200"
                          >
                            SAVE
                          </button>
                        </div>
                      </div>

                      <input
                        value={heapNameDraft}
                        onChange={(event) => setHeapNameDraft(event.target.value)}
                        placeholder="entry name / filename"
                        spellCheck={false}
                        autoCapitalize="off"
                        autoComplete="off"
                        autoCorrect="off"
                        className="mb-2 w-full rounded-sm border border-[#1c1c1c] bg-black px-3 py-2 font-mono text-[10px] text-green-200 outline-none transition-colors placeholder:text-[#5a5a5a] focus:border-emerald-500/60"
                      />

                      <Textarea
                        value={heapTextDraft}
                        onChange={(event) => setHeapTextDraft(event.target.value)}
                        placeholder="Paste text, markdown, or code here..."
                        spellCheck={false}
                        autoCapitalize="off"
                        autoComplete="off"
                        autoCorrect="off"
                        wrap="off"
                        className="min-h-[180px] resize-none overflow-auto rounded-sm border border-[#1c1c1c] bg-black px-3 py-3 font-mono text-[12px] leading-snug text-green-200 shadow-none focus-visible:ring-1 focus-visible:ring-emerald-500/40"
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-3 xl:grid-cols-2 2xl:grid-cols-3">
                      {heapEntries.length === 0 ? (
                        <div className="rounded-sm border border-dashed border-[#1c1c1c] bg-black/80 p-4 font-mono text-[10px] leading-snug text-[#8a8a8a] xl:col-span-2 2xl:col-span-3">
                          HEAP IS EMPTY. PASTE A DOCUMENT OR DROP TEXT HERE TO KEEP IT AFTER REFRESH.
                        </div>
                      ) : (
                        heapEntries.map((entry) => (
                          <div key={entry.id} className="flex h-full flex-col rounded-sm border border-[#1c1c1c] bg-black/80 p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="truncate font-mono text-[10px] tracking-[0.04em] text-green-200">
                                  {entry.name}
                                </div>
                                <div className="mt-1 font-mono text-[9px] tracking-[0.04em] text-[#6f6f6f]">
                                  {new Date(entry.createdAt).toLocaleString()}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => void copyHeapEntry(entry)}
                                  className="rounded border border-[#2d2d2d] bg-black px-2 py-1 font-mono text-[9px] tracking-[0.08em] text-[#8a8a8a] transition hover:border-emerald-500/60 hover:text-emerald-200"
                                >
                                  COPY
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openHeapEntryInOperator(entry)}
                                  className="rounded border border-[#2d2d2d] bg-black px-2 py-1 font-mono text-[9px] tracking-[0.08em] text-[#8a8a8a] transition hover:border-emerald-500/60 hover:text-emerald-200"
                                >
                                  OPEN
                                </button>
                                <button
                                  type="button"
                                  onClick={() => deleteHeapEntry(entry.id)}
                                  className="rounded border border-[#2d2d2d] bg-black px-2 py-1 font-mono text-[9px] tracking-[0.08em] text-[#8a8a8a] transition hover:border-red-500/60 hover:text-red-200"
                                >
                                  DEL
                                </button>
                              </div>
                            </div>
                            <pre className="mt-3 flex-1 overflow-auto whitespace-pre-wrap break-words font-mono text-[12px] leading-snug text-green-200">
                              {entry.text}
                            </pre>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="custom-scrollbar flex flex-1 flex-col overflow-y-auto bg-black p-4">
                <div className="flex flex-1 flex-col rounded-sm border border-[#141414] bg-black transition-colors">
                  <div className="flex items-center justify-between border-b border-[#141414] px-3 py-2">
                    <div className="min-w-0 flex-1 pr-3">
                      <div
                        className="truncate font-mono text-[10px] tracking-[0.04em] text-[#8a8a8a]"
                        style={{ textShadow: "0 0 6px rgba(138,138,138,0.2)" }}
                      >
                        SETTINGS
                      </div>
                      <div className="mt-1 font-mono text-[9px] tracking-[0.04em] text-[#6f6f6f]">
                        LOCAL CONFIG // VOICE DIALS
                      </div>
                    </div>
                    <div className="font-mono text-[9px] tracking-[0.08em] text-[#8a8a8a]">
                      {voiceEnabled ? "VOICE ON" : "VOICE OFF"}
                    </div>
                  </div>

                  <div className="grid flex-1 gap-3 overflow-auto p-3">
                    <div className="h-full rounded-sm border border-[#1c1c1c] bg-black/80 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-mono text-[10px] tracking-[0.08em] text-green-200">
                            VOICE DIALS
                          </div>
                          <div className="mt-1 font-mono text-[9px] tracking-[0.04em] text-[#8a8a8a]">
                            MUTHUR // {MUTHUR_PRESET.backend.voiceType} // {MUTHUR_PRESET.backend.language}
                          </div>
                        </div>
                        <div
                          className={`font-mono text-[9px] tracking-[0.08em] ${
                            voiceHealth === "backend"
                              ? "text-emerald-200"
                              : voiceHealth === "fallback"
                                ? "text-amber-300"
                                : voiceHealth === "off"
                                  ? "text-gray-500"
                                  : "text-[#8a8a8a]"
                          }`}
                        >
                          {voiceHealth.toUpperCase()}
                        </div>
                      </div>

                      <div className="mt-3 rounded-sm border border-[#1c1c1c] bg-black px-3 py-2 font-mono text-[9px] tracking-[0.08em] text-[#8a8a8a]">
                        CURRENT // rate {voiceDial.ratePercent} // pitch {voiceDial.pitchHz} // gain{" "}
                        {voiceDial.volume.toFixed(2)}
                      </div>

                      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <div className="flex aspect-square flex-col rounded-sm border border-[#1c1c1c] bg-black px-3 py-3">
                          <div className="font-mono text-[9px] tracking-[0.08em] text-[#6f6f6f]">RATE</div>
                          <div className="mt-3 flex flex-1 items-center justify-center">
                            <Knob
                              label="Rate"
                              unit="%"
                              value={voiceDial.ratePercent}
                              onValueChange={(ratePercent) =>
                                setVoiceDial((current) => ({ ...current, ratePercent }))
                              }
                              min={-40}
                              max={0}
                              step={1}
                              wheelMultiplier={0.5}
                              dragMultiplier={0.5}
                              mode="tuner"
                              theme="dark"
                            />
                          </div>
                        </div>

                        <div className="flex aspect-square flex-col rounded-sm border border-[#1c1c1c] bg-black px-3 py-3">
                          <div className="font-mono text-[9px] tracking-[0.08em] text-[#6f6f6f]">PITCH</div>
                          <div className="mt-3 flex flex-1 items-center justify-center">
                            <Knob
                              label="Pitch"
                              unit="Hz"
                              value={voiceDial.pitchHz}
                              onValueChange={(pitchHz) =>
                                setVoiceDial((current) => ({ ...current, pitchHz }))
                              }
                              min={-20}
                              max={0}
                              step={1}
                              wheelMultiplier={0.5}
                              dragMultiplier={0.5}
                              mode="tuner"
                              theme="dark"
                            />
                          </div>
                        </div>

                        <div className="flex aspect-square flex-col rounded-sm border border-[#1c1c1c] bg-black px-3 py-3">
                          <div className="font-mono text-[9px] tracking-[0.08em] text-[#6f6f6f]">GAIN</div>
                          <div className="mt-3 flex flex-1 items-center justify-center">
                            <Knob
                              label="Gain"
                              unit="x"
                              value={voiceDial.volume}
                              onValueChange={(volume) =>
                                setVoiceDial((current) => ({ ...current, volume }))
                              }
                              min={0.25}
                              max={1.25}
                              step={0.05}
                              wheelMultiplier={0.5}
                              dragMultiplier={0.5}
                              mode="tuner"
                              theme="dark"
                            />
                          </div>
                        </div>

                        <div className="flex aspect-square flex-col rounded-sm border border-[#1c1c1c] bg-black px-3 py-3">
                          <div className="font-mono text-[9px] tracking-[0.08em] text-[#6f6f6f]">ACTIONS</div>
                          <div className="mt-3 grid flex-1 grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={toggleVoiceEnabled}
                              className={`rounded border px-2 py-2 font-mono text-[9px] tracking-[0.08em] transition ${
                                voiceEnabled
                                  ? "border-emerald-500/70 bg-emerald-500/10 text-emerald-200 hover:border-emerald-400 hover:text-emerald-100"
                                  : "border-[#2d2d2d] bg-black text-[#8a8a8a] hover:border-emerald-500/60 hover:text-emerald-200"
                              }`}
                            >
                              {voiceEnabled ? "VOICE ON" : "VOICE OFF"}
                            </button>
                            <button
                              type="button"
                              onClick={() => void playVoiceTest()}
                              disabled={!voiceEnabled}
                              className="rounded border border-[#2d2d2d] bg-black px-2 py-2 font-mono text-[9px] tracking-[0.08em] text-[#8a8a8a] transition hover:border-emerald-500/60 hover:text-emerald-200 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              TEST MUTHUR
                            </button>
                            <button
                              type="button"
                              onClick={saveMuthurVoiceCopyToApp}
                              className="rounded border border-[#2d2d2d] bg-black px-2 py-2 font-mono text-[9px] tracking-[0.08em] text-[#8a8a8a] transition hover:border-emerald-500/60 hover:text-emerald-200"
                            >
                              SAVE COPY
                            </button>
                            <button
                              type="button"
                              onClick={restoreMuthurVoiceMaster}
                              className="rounded border border-[#2d2d2d] bg-black px-2 py-2 font-mono text-[9px] tracking-[0.08em] text-[#8a8a8a] transition hover:border-emerald-500/60 hover:text-emerald-200"
                            >
                              RESTORE MASTER
                            </button>
                          </div>
                        </div>
                    </div>

                    <div className="h-full rounded-sm border border-[#1c1c1c] bg-black/80 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-mono text-[10px] tracking-[0.08em] text-green-200">
                            MUTHUR MEMORY
                          </div>
                          <div className="mt-1 font-mono text-[9px] tracking-[0.04em] text-[#8a8a8a]">
                            {muthurMemoryHydrated ? "LOCAL // INDEXEDDB // RETRIEVAL" : "HYDRATING MEMORY..."}
                          </div>
                        </div>
                        <div
                          className={`font-mono text-[9px] tracking-[0.08em] ${
                            muthurMemoryHydrated
                              ? muthurMemory.turnCount > 0
                                ? "text-emerald-200"
                                : "text-[#8a8a8a]"
                              : "text-amber-300"
                          }`}
                        >
                          {muthurMemoryHydrated ? `${muthurMemory.turnCount} TURNS` : "WAIT"}
                        </div>
                      </div>

                      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <div className="flex aspect-square flex-col rounded-sm border border-[#1c1c1c] bg-black px-3 py-3">
                          <div className="font-mono text-[9px] tracking-[0.08em] text-[#6f6f6f]">SUMMARY</div>
                          <div className="mt-2 flex-1 overflow-auto whitespace-pre-wrap break-words font-mono text-[9px] leading-5 text-[#a3a3a3]">
                            {muthurMemory.summary || "No durable notes yet."}
                          </div>
                        </div>

                        <div className="flex aspect-square flex-col rounded-sm border border-[#1c1c1c] bg-black px-3 py-3">
                          <div className="font-mono text-[9px] tracking-[0.08em] text-[#6f6f6f]">FACTS</div>
                          <div className="mt-2 font-mono text-[9px] tracking-[0.08em] text-green-200">
                            {muthurMemory.facts.length} STORED
                          </div>
                          <div className="mt-2 flex-1 overflow-auto space-y-1 font-mono text-[9px] leading-5 text-[#a3a3a3]">
                            {muthurMemory.facts.length > 0 ? (
                              muthurMemory.facts.slice(-4).map((fact, index) => (
                                <div key={`${fact}-${index}`} className="whitespace-pre-wrap break-words">
                                  {fact}
                                </div>
                              ))
                            ) : (
                              <div className="text-[#6f6f6f]">NO FACTS YET</div>
                            )}
                          </div>
                        </div>

                        <div className="flex aspect-square flex-col rounded-sm border border-[#1c1c1c] bg-black px-3 py-3">
                          <div className="font-mono text-[9px] tracking-[0.08em] text-[#6f6f6f]">RECENT TURNS</div>
                          <div className="mt-2 font-mono text-[9px] tracking-[0.08em] text-green-200">
                            {muthurMemory.recentTurns.length} IN BUFFER
                          </div>
                          <div className="mt-2 flex-1 overflow-auto space-y-1 font-mono text-[9px] leading-5 text-[#a3a3a3]">
                            {muthurMemory.recentTurns.length > 0 ? (
                              muthurMemory.recentTurns.slice(-4).map((turn) => (
                                <div key={turn.id} className="whitespace-pre-wrap break-words">
                                  <span className="text-[#6f6f6f]">
                                    {turn.role === "assistant" ? "AI" : "USR"}
                                  </span>{" "}
                                  {turn.text}
                                </div>
                              ))
                            ) : (
                              <div className="text-[#6f6f6f]">NO RECENT TURNS YET</div>
                            )}
                          </div>
                        </div>

                        <div className="flex aspect-square flex-col rounded-sm border border-[#1c1c1c] bg-black px-3 py-3">
                          <div className="font-mono text-[9px] tracking-[0.08em] text-[#6f6f6f]">STATUS</div>
                          <div className="mt-2 font-mono text-[9px] leading-5 tracking-[0.04em] text-[#a3a3a3]">
                            <div className="whitespace-pre-wrap break-words">
                              UPDATED //{" "}
                              {muthurMemoryHydrated
                                ? new Date(muthurMemory.updatedAt).toLocaleString()
                                : "—"}
                            </div>
                            <div className="mt-2 whitespace-pre-wrap break-words">
                              MEMORY // {muthurMemoryHydrated ? `${muthurMemory.turnCount} TURNS` : "WAITING"}
                            </div>
                            <div className="mt-2 whitespace-pre-wrap break-words">
                              HYDRATION // {muthurMemoryHydrated ? "READY" : "LOADING"}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void clearMuthurMemoryState()}
                          disabled={!muthurMemoryHydrated}
                          className="rounded border border-[#2d2d2d] bg-black px-3 py-1 font-mono text-[9px] tracking-[0.08em] text-[#8a8a8a] transition hover:border-red-500/60 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          CLEAR MEMORY
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 rounded-sm border border-[#1c1c1c] bg-black px-3 py-2 font-mono text-[9px] tracking-[0.08em] text-[#8a8a8a]">
                        CURRENT // rate {voiceDial.ratePercent} // pitch {voiceDial.pitchHz} // gain{" "}
                        {voiceDial.volume.toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
