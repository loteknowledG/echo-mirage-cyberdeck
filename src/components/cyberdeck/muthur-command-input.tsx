"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { playDeckMemorizeKeySound } from "@/features/cyberdeck/runtime/defer-deck-audio";

const INPUT_STORAGE_KEY = "echo-mirage-chat-input-v1";
const INPUT_PERSIST_MS = 400;
const TEXTAREA_MIN_HEIGHT_PX = 44;
const TEXTAREA_MAX_HEIGHT_PX = 200;

export type MuthurCommandInputHandle = {
  focus: (options?: FocusOptions) => void;
  getValue: () => string;
  setValue: (value: string) => void;
  clear: () => void;
  element: HTMLTextAreaElement | null;
};

type MuthurCommandInputProps = {
  inputHistory: string[];
  hasProviderAuth: boolean;
  glyphModeActive: boolean;
  isStreaming: boolean;
  chatHydrated: boolean;
  onSubmit: (text: string) => void;
  onCanSendChange?: (canSend: boolean) => void;
  onFocusExtra?: () => void;
  onPasteImage?: (dataUrl: string) => void;
};

function isCaretAtStart(el: HTMLTextAreaElement): boolean {
  return el.selectionStart === 0 && el.selectionEnd === 0;
}

function isCaretAtEnd(el: HTMLTextAreaElement): boolean {
  return el.selectionStart === el.value.length && el.selectionEnd === el.value.length;
}

export const MuthurCommandInput = forwardRef<MuthurCommandInputHandle, MuthurCommandInputProps>(
  function MuthurCommandInput(
    {
      inputHistory,
      hasProviderAuth,
      glyphModeActive,
      isStreaming,
      chatHydrated,
      onSubmit,
      onCanSendChange,
      onFocusExtra,
      onPasteImage,
    },
    ref,
  ) {
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const persistTimerRef = useRef<number | null>(null);
    const canSendRef = useRef(false);
    const [value, setValue] = useState("");
    const [inputHistoryIndex, setInputHistoryIndex] = useState<number | null>(null);
    const [inputHistoryDraft, setInputHistoryDraft] = useState("");

    const adjustHeight = useCallback(() => {
      const el = inputRef.current;
      if (!el) return;
      // Empty input: ignore placeholder wrap (long placeholder was inflating scrollHeight on load).
      if (!el.value.trim()) {
        el.style.height = `${TEXTAREA_MIN_HEIGHT_PX}px`;
        return;
      }
      el.style.height = "auto";
      el.style.height = `${Math.min(Math.max(el.scrollHeight, TEXTAREA_MIN_HEIGHT_PX), TEXTAREA_MAX_HEIGHT_PX)}px`;
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        focus: (options) => inputRef.current?.focus(options),
        getValue: () => inputRef.current?.value ?? value,
        setValue: (next) => {
          setValue(next);
          if (inputRef.current) inputRef.current.value = next;
          notifyCanSend(next);
          adjustHeight();
        },
        clear: () => {
          setValue("");
          if (inputRef.current) {
            inputRef.current.value = "";
            inputRef.current.style.height = `${TEXTAREA_MIN_HEIGHT_PX}px`;
          }
          notifyCanSend("");
        },
        element: inputRef.current,
      }),
      [adjustHeight, value],
    );

    const notifyCanSend = useCallback(
      (raw: string) => {
        const canSend = raw.trim().length > 0;
        if (canSendRef.current === canSend) return;
        canSendRef.current = canSend;
        onCanSendChange?.(canSend);
      },
      [onCanSendChange],
    );

    useEffect(() => {
      if (!chatHydrated || typeof window === "undefined") return;
      try {
        const storedInput = window.localStorage.getItem(INPUT_STORAGE_KEY);
        if (typeof storedInput === "string") {
          setValue(storedInput);
          notifyCanSend(storedInput);
        }
      } catch {
        /* ignore */
      }
    }, [chatHydrated, notifyCanSend]);

    useLayoutEffect(() => {
      adjustHeight();
      const frame = requestAnimationFrame(() => adjustHeight());
      return () => cancelAnimationFrame(frame);
    }, [value, adjustHeight, chatHydrated, hasProviderAuth, glyphModeActive]);

    useEffect(() => {
      if (!chatHydrated) return;
      if (persistTimerRef.current != null) {
        window.clearTimeout(persistTimerRef.current);
      }
      persistTimerRef.current = window.setTimeout(() => {
        try {
          window.localStorage.setItem(INPUT_STORAGE_KEY, value);
        } catch {
          /* ignore */
        }
      }, INPUT_PERSIST_MS);
      return () => {
        if (persistTimerRef.current != null) {
          window.clearTimeout(persistTimerRef.current);
        }
      };
    }, [value, chatHydrated]);

    useEffect(() => {
      const inputEl = inputRef.current;
      if (!inputEl || !onPasteImage) return;
      const onPaste = (e: ClipboardEvent) => {
        const items = Array.from(e.clipboardData?.items ?? []);
        for (const item of items) {
          if (!item.type.startsWith("image/")) continue;
          const file = item.getAsFile();
          if (!file) continue;
          const reader = new FileReader();
          reader.onload = () => {
            if (typeof reader.result === "string") onPasteImage(reader.result);
          };
          reader.readAsDataURL(file);
          break;
        }
      };
      inputEl.addEventListener("paste", onPaste);
      return () => inputEl.removeEventListener("paste", onPaste);
    }, [onPasteImage]);

    const moveCaretToEnd = useCallback(
      (nextValue: string) => {
        requestAnimationFrame(() => {
          const el = inputRef.current;
          if (!el) return;
          const end = nextValue.length;
          el.focus({ preventScroll: true });
          el.setSelectionRange(end, end);
          adjustHeight();
        });
      },
      [adjustHeight],
    );

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const next = e.target.value;
        setValue(next);
        notifyCanSend(next);
        if (inputHistoryIndex !== null) {
          setInputHistoryIndex(null);
        }
      },
      [inputHistoryIndex, notifyCanSend],
    );

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (!e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey) {
          playDeckMemorizeKeySound(e.key);
        }

        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          const text = (inputRef.current?.value ?? value).trim();
          if (text) onSubmit(text);
          return;
        }

        if (e.key === "ArrowUp" || e.key === "ArrowDown") {
          if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
          if (inputHistory.length === 0) return;

          const el = inputRef.current;
          if (!el) return;

          if (e.key === "ArrowUp") {
            if (!isCaretAtStart(el)) return;
            e.preventDefault();
            const nextIndex =
              inputHistoryIndex === null ? inputHistory.length - 1 : Math.max(0, inputHistoryIndex - 1);
            if (inputHistoryIndex === null) {
              setInputHistoryDraft(value);
            }
            const nextValue = inputHistory[nextIndex] ?? "";
            setValue(nextValue);
            setInputHistoryIndex(nextIndex);
            notifyCanSend(nextValue);
            moveCaretToEnd(nextValue);
            return;
          }

          if (inputHistoryIndex !== null && isCaretAtEnd(el)) {
            e.preventDefault();
            const nextIndex = inputHistoryIndex + 1;
            if (nextIndex >= inputHistory.length) {
              setValue(inputHistoryDraft);
              setInputHistoryIndex(null);
              notifyCanSend(inputHistoryDraft);
              moveCaretToEnd(inputHistoryDraft);
              return;
            }
            const nextValue = inputHistory[nextIndex] ?? "";
            setValue(nextValue);
            setInputHistoryIndex(nextIndex);
            notifyCanSend(nextValue);
            moveCaretToEnd(nextValue);
          }
        }
      },
      [
        inputHistory,
        inputHistoryDraft,
        inputHistoryIndex,
        moveCaretToEnd,
        notifyCanSend,
        onSubmit,
        value,
      ],
    );

    return (
      <div className="muthur-command-input-row flex min-w-0 flex-1 items-start gap-1">
        <span
          aria-hidden
          className="muthur-command-prompt shrink-0 select-none py-3 font-mono text-sm font-bold leading-relaxed text-green-500"
        >
          $
        </span>
        <textarea
          ref={inputRef}
          rows={1}
          data-pointer-target="command-input"
          data-muthur-memorize-input=""
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => onFocusExtra?.()}
          placeholder={
            !hasProviderAuth
              ? "ENTER GATEWAY KEY..."
              : glyphModeActive
                ? "⟁ Glyph mode on — compose on ⟁ tab; $ here is MUTHUR chat"
                : isStreaming
                  ? "Steer MUTHUR — type and Enter to interrupt (Shift+Enter for new line)"
                  : "Enter command or message... (Shift+Enter for new line)"
          }
          style={{ height: TEXTAREA_MIN_HEIGHT_PX }}
          className="muthur-command-input min-h-[44px] max-h-[200px] min-w-0 flex-1 resize-none overflow-y-auto rounded-none border-0 bg-black py-3 pl-1 pr-3 font-mono text-sm leading-relaxed text-green-400 placeholder:text-green-800 transition-[color,box-shadow] focus:outline-none"
          disabled={false}
          aria-label="MUTHUR command input"
        />
      </div>
    );
  },
);
