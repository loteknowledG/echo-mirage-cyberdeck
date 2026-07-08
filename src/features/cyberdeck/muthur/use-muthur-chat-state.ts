"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import {
  DEFAULT_CHAT_USER_DISPLAY_NAME,
  readChatUserDisplayName,
  writeChatUserDisplayName,
} from "@/lib/chat-user-display-name";
import {
  appendMuthurDiagnosticBatch,
  createEmptyMuthurDiagnosticsState,
  MUTHUR_RESPONSE_STALL_MS,
  type MuthurDiagnosticsState,
  type MuthurResponseStall,
} from "@/lib/muthur-core/muthur-diagnostics-channel";
import { extractMuthurProgressStatus } from "@/lib/muthur-core/muthur-command-console";
import { partitionMuthurChannelUpdate } from "@/lib/muthur-core/muthur-response-channel";
import {
  CHAT_STORAGE_KEY,
  CHAT_STREAM_STORAGE_KEY,
  INPUT_HISTORY_KEY,
  type ChatMessage,
} from "@/features/cyberdeck/muthur/muthur-chat-types";

export type MuthurChatState = {
  inputHistory: string[];
  setInputHistory: Dispatch<SetStateAction<string[]>>;
  canSendInput: boolean;
  setCanSendInput: Dispatch<SetStateAction<boolean>>;
  handleCanSendInputChange: (canSend: boolean) => void;
  messages: ChatMessage[];
  setMessages: (updater: SetStateAction<ChatMessage[]>) => void;
  setMessagesRaw: Dispatch<SetStateAction<ChatMessage[]>>;
  muthurDiagnostics: MuthurDiagnosticsState;
  setMuthurDiagnostics: Dispatch<SetStateAction<MuthurDiagnosticsState>>;
  muthurStall: MuthurResponseStall | null;
  setMuthurStall: Dispatch<SetStateAction<MuthurResponseStall | null>>;
  muthurResponseFailed: boolean;
  setMuthurResponseFailed: Dispatch<SetStateAction<boolean>>;
  composeStartedAtRef: MutableRefObject<number | null>;
  chatUserDisplayName: string;
  setChatUserDisplayName: Dispatch<SetStateAction<string>>;
  chatHydrated: boolean;
  isStreaming: boolean;
  setIsStreaming: Dispatch<SetStateAction<boolean>>;
  streamText: string;
  setStreamText: Dispatch<SetStateAction<string>>;
  streamToolTrace: string;
  setStreamToolTrace: Dispatch<SetStateAction<string>>;
  chatPinnedToBottom: boolean;
  setChatPinnedToBottom: Dispatch<SetStateAction<boolean>>;
  generatedUI: string | null;
  setGeneratedUI: Dispatch<SetStateAction<string | null>>;
};

export function useMuthurChatState(): MuthurChatState {
  const [inputHistory, setInputHistory] = useState<string[]>([]);
  const [canSendInput, setCanSendInput] = useState(false);
  const [messages, setMessagesRaw] = useState<ChatMessage[]>([]);
  const [muthurDiagnostics, setMuthurDiagnostics] = useState<MuthurDiagnosticsState>(() =>
    createEmptyMuthurDiagnosticsState(),
  );
  const [muthurStall, setMuthurStall] = useState<MuthurResponseStall | null>(null);
  const [muthurResponseFailed, setMuthurResponseFailed] = useState(false);
  const composeStartedAtRef = useRef<number | null>(null);
  const setMessages = useCallback((updater: SetStateAction<ChatMessage[]>) => {
    setMessagesRaw((prev) => {
      const rawNext = typeof updater === "function" ? updater(prev) : updater;
      if (!Array.isArray(rawNext)) return prev;

      const { channel, newDiagnostics } = partitionMuthurChannelUpdate(prev, rawNext);
      if (newDiagnostics.length > 0) {
        setMuthurDiagnostics((current) => appendMuthurDiagnosticBatch(current, newDiagnostics));
      }

      return channel;
    });
  }, []);
  const [chatUserDisplayName, setChatUserDisplayName] = useState(DEFAULT_CHAT_USER_DISPLAY_NAME);
  const [chatHydrated, setChatHydrated] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [streamToolTrace, setStreamToolTrace] = useState("");
  const [chatPinnedToBottom, setChatPinnedToBottom] = useState(true);
  const [generatedUI, setGeneratedUI] = useState<string | null>(null);

  const handleCanSendInputChange = useCallback((canSend: boolean) => {
    setCanSendInput((prev) => (prev === canSend ? prev : canSend));
  }, []);

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
          const legacySystemLines = restored
            .filter((item) => item.role === "system")
            .map((item) => item.text);
          const channel = restored.filter((item) => item.role !== "system");
          setMessagesRaw(channel);
          if (legacySystemLines.length > 0) {
            setMuthurDiagnostics((current) => appendMuthurDiagnosticBatch(current, legacySystemLines));
          }
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
        } catch {
          /* ignore */
        }
      }
      setChatUserDisplayName(readChatUserDisplayName());
    } catch {
      /* ignore chat restore errors */
    } finally {
      setChatHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!chatHydrated) return;
    writeChatUserDisplayName(chatUserDisplayName);
  }, [chatHydrated, chatUserDisplayName]);

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
      } catch {
        /* ignore */
      }
      return;
    }
    try {
      window.localStorage.setItem(INPUT_HISTORY_KEY, JSON.stringify(inputHistory.slice(-50)));
    } catch {
      /* ignore */
    }
  }, [inputHistory, chatHydrated]);

  useEffect(() => {
    if (isStreaming || streamText.trim()) {
      if (composeStartedAtRef.current == null) {
        composeStartedAtRef.current = Date.now();
      }
      return;
    }
    composeStartedAtRef.current = null;
    setMuthurStall(null);
  }, [isStreaming, streamText]);

  useEffect(() => {
    if (!isStreaming && !streamText.trim()) return;

    const timer = window.setInterval(() => {
      const started = composeStartedAtRef.current;
      if (started == null) return;
      const elapsedMs = Date.now() - started;
      if (elapsedMs < MUTHUR_RESPONSE_STALL_MS) return;
      setMuthurStall({
        phase: extractMuthurProgressStatus(streamText) || "MUTHUR uplink active",
        elapsedMs,
      });
    }, 2_000);

    return () => window.clearInterval(timer);
  }, [isStreaming, streamText]);

  return {
    inputHistory,
    setInputHistory,
    canSendInput,
    setCanSendInput,
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
  };
}
