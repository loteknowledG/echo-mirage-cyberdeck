"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { SurveyAnalyzeSolvingBanner } from "@/components/cyberdeck/survey-analyze-solving-banner";
import { CyberdeckActionButton } from "@/components/cyberdeck/cyberdeck-control-button";
import {
  analyzeSurveyCaptureClient,
  analyzeSurveySelectionClient,
  surveyImageDataUrlToBase64,
} from "@/lib/cyberdeck/survey-analyze.client";
import {
  clearSurveyAnalyzeStatus,
  useSurveyAnalyzeStatus,
} from "@/lib/cyberdeck/survey-analyze-status.client";
import {
  appendSurveyChatMessage,
  clearSurveyChatMessages,
  readSurveyChatMessages,
  useSurveyChatMessages,
  type SurveyChatMessage,
} from "@/lib/cyberdeck/survey-chat";
import { readLastSurveyCapture } from "@/lib/cyberdeck/survey-deck-command.client";
import {
  SURVEY_ECHO_DISPLAY,
  SURVEY_MIRAGE_DISPLAY,
} from "@/lib/cyberdeck/survey-mode";
import { resolveMiragePreviewContent } from "@/lib/cyberdeck/survey-mirage-item-queue.client";

function roleLabel(role: SurveyChatMessage["role"]): string {
  switch (role) {
    case "assistant":
      return "MUTHUR";
    case "user":
      return "YOU";
    default:
      return "SYS";
  }
}

function roleClass(role: SurveyChatMessage["role"]): string {
  switch (role) {
    case "assistant":
      return "text-emerald-200/90";
    case "user":
      return "text-fuchsia-200/80";
    default:
      return "text-cyan-200/80";
  }
}

function buildFollowUpPrompt(userText: string): string {
  const recent = readSurveyChatMessages()
    .filter((entry) => entry.role === "user" || entry.role === "assistant")
    .slice(-8)
    .map((entry) => `${roleLabel(entry.role)}: ${entry.text}`)
    .join("\n\n");

  return [
    "You are continuing a Survey Mirage solutions chat about a screen capture or problem.",
    "Answer the operator's latest message. Be concise and actionable.",
    recent ? `Prior thread:\n${recent}` : null,
    `Operator:\n${userText}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

function resolveFollowUpImageBase64(): string | null {
  const preview = resolveMiragePreviewContent();
  if (preview?.kind === "image" && preview.imageDataUrl) {
    return surveyImageDataUrlToBase64(preview.imageDataUrl);
  }
  const last = readLastSurveyCapture();
  if (last?.pngBase64) return last.pngBase64;
  return null;
}

export function SurveySolutionsPanel() {
  const messages = useSurveyChatMessages();
  const analyzeStatus = useSurveyAnalyzeStatus();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const showSyncedResult =
    analyzeStatus.phase === "complete" &&
    Boolean(analyzeStatus.resultText) &&
    !messages.some((entry) => entry.role === "assistant" && entry.text === analyzeStatus.resultText);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [messages, analyzeStatus.phase, analyzeStatus.message, analyzeStatus.resultText, busy]);

  const handleClear = useCallback(() => {
    clearSurveyChatMessages();
    clearSurveyAnalyzeStatus();
    setDraft("");
  }, []);

  const handleSend = useCallback(async () => {
    const text = draft.trim();
    if (!text || busy) return;

    setBusy(true);
    setDraft("");
    appendSurveyChatMessage({ role: "user", text });

    const prompt = buildFollowUpPrompt(text);
    const pngBase64 = resolveFollowUpImageBase64();
    const result = pngBase64
      ? await analyzeSurveyCaptureClient({ pngBase64, prompt, provider: "auto" })
      : await analyzeSurveySelectionClient({
          selectionText: text,
          prompt,
          provider: "auto",
        });

    if (!result.ok) {
      appendSurveyChatMessage({
        role: "system",
        text: `SURVEY // CHAT FAILED // ${result.error}`,
      });
      setBusy(false);
      inputRef.current?.focus();
      return;
    }

    appendSurveyChatMessage({ role: "assistant", text: result.text });
    setBusy(false);
    inputRef.current?.focus();
  }, [busy, draft]);

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        void handleSend();
      }
    },
    [handleSend],
  );

  return (
    <section
      className="flex min-h-[280px] flex-col rounded border border-[#1c1c1c] bg-black/60"
      data-testid="survey-solutions-panel"
    >
      <header className="flex items-start justify-between gap-2 border-b border-[#1c1c1c] px-3 py-2">
        <div className="min-w-0">
          <p className="text-[9px] tracking-[0.12em] text-fuchsia-300/90">
            {SURVEY_MIRAGE_DISPLAY} SOLUTIONS
          </p>
          <p className="mt-1 text-[8px] leading-relaxed text-[#5f5f5f]">
            Linked with {SURVEY_ECHO_DISPLAY}. SOLVE streams here — chat below to follow up.
          </p>
        </div>
        <CyberdeckActionButton
          variant="neutral"
          disabled={busy || (messages.length === 0 && analyzeStatus.phase === "idle")}
          onClick={handleClear}
          data-testid="survey-solutions-clear"
        >
          CLEAR
        </CyberdeckActionButton>
      </header>

      {(analyzeStatus.phase === "running" || analyzeStatus.phase === "failed") && (
        <div className="border-b border-[#1c1c1c] px-3 py-3">
          <SurveyAnalyzeSolvingBanner status={analyzeStatus} />
        </div>
      )}

      <div
        ref={scrollRef}
        className="custom-scrollbar flex min-h-[140px] max-h-[42vh] flex-1 flex-col gap-2 overflow-y-auto px-3 py-3"
      >
        {messages.length === 0 && !showSyncedResult && analyzeStatus.phase !== "running" ? (
          <p className="text-[9px] text-[#6a6a6a]">
            Capture → SOLVE, or type a question below…
          </p>
        ) : null}

        {messages.map((message) => (
          <div key={message.id} className="font-mono text-[10px] leading-relaxed">
            <span className={`mr-2 text-[8px] tracking-[0.1em] ${roleClass(message.role)}`}>
              [{roleLabel(message.role)}]
            </span>
            <span className="whitespace-pre-wrap text-[#bdbdbd]">{message.text}</span>
          </div>
        ))}

        {showSyncedResult && analyzeStatus.resultText ? (
          <div className="font-mono text-[10px] leading-relaxed">
            <span className="mr-2 text-[8px] tracking-[0.1em] text-emerald-200/90">[MUTHUR]</span>
            <span className="whitespace-pre-wrap text-[#bdbdbd]">{analyzeStatus.resultText}</span>
          </div>
        ) : null}

        {busy ? (
          <p className="text-[8px] tracking-[0.08em] text-fuchsia-300/70">MUTHUR // thinking…</p>
        ) : null}
      </div>

      <div className="border-t border-[#1c1c1c] px-3 py-2">
        <label className="sr-only" htmlFor="survey-solutions-chat-input">
          Solutions chat
        </label>
        <div className="flex items-end gap-2">
          <textarea
            id="survey-solutions-chat-input"
            ref={inputRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onKeyDown}
            rows={2}
            disabled={busy}
            placeholder="Ask about the capture or answer… (Enter send · Shift+Enter newline)"
            className="custom-scrollbar min-h-[52px] flex-1 resize-y border border-fuchsia-900/40 bg-[#0a0a0a] px-2 py-2 font-mono text-[11px] leading-relaxed text-[#e8e8e8] outline-none placeholder:text-[#4a4a4a] focus:border-fuchsia-500/60 disabled:opacity-50"
            data-testid="survey-solutions-chat-input"
          />
          <CyberdeckActionButton
            variant="accent"
            disabled={busy || !draft.trim()}
            onClick={() => void handleSend()}
            data-testid="survey-solutions-chat-send"
          >
            {busy ? "…" : "SEND"}
          </CyberdeckActionButton>
        </div>
      </div>
    </section>
  );
}
