"use client";

import { useEffect, useRef } from "react";
import { SurveyAnalyzeSolvingBanner } from "@/components/cyberdeck/survey-analyze-solving-banner";
import {
  SURVEY_ECHO_DISPLAY,
  SURVEY_MIRAGE_DISPLAY,
} from "@/lib/cyberdeck/survey-mode";
import { useSurveyAnalyzeStatus } from "@/lib/cyberdeck/survey-analyze-status.client";
import { useSurveyChatMessages, type SurveyChatMessage } from "@/lib/cyberdeck/survey-chat";

function roleLabel(role: SurveyChatMessage["role"]): string {
  switch (role) {
    case "assistant":
      return "MUTHUR";
    case "user":
      return "MISSION";
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

export function SurveySolutionsPanel() {
  const messages = useSurveyChatMessages();
  const analyzeStatus = useSurveyAnalyzeStatus();
  const scrollRef = useRef<HTMLDivElement>(null);

  const showSyncedResult =
    analyzeStatus.phase === "complete" &&
    Boolean(analyzeStatus.resultText) &&
    !messages.some((entry) => entry.role === "assistant" && entry.text === analyzeStatus.resultText);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [messages, analyzeStatus.phase, analyzeStatus.message, analyzeStatus.resultText]);

  return (
    <section className="flex min-h-[220px] flex-col rounded border border-[#1c1c1c] bg-black/60">
      <header className="border-b border-[#1c1c1c] px-3 py-2">
        <p className="text-[9px] tracking-[0.12em] text-fuchsia-300/90">
          {SURVEY_MIRAGE_DISPLAY} SOLUTIONS
        </p>
        <p className="mt-1 text-[8px] leading-relaxed text-[#5f5f5f]">
          Linked with {SURVEY_ECHO_DISPLAY}. Use{" "}
          <span className="text-fuchsia-300/80">TAKE SCREENSHOT</span> and{" "}
          <span className="text-fuchsia-300/80">SOLVE</span> in the capture panel — Codex streams
          results here.
        </p>
      </header>

      {(analyzeStatus.phase === "running" || analyzeStatus.phase === "failed") && (
        <div className="border-b border-[#1c1c1c] px-3 py-3">
          <SurveyAnalyzeSolvingBanner status={analyzeStatus} />
        </div>
      )}

      <div
        ref={scrollRef}
        className="custom-scrollbar flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 py-3"
      >
        {messages.length === 0 && !showSyncedResult && analyzeStatus.phase !== "running" ? (
          <p className="text-[9px] text-[#6a6a6a]">
            Capture a screenshot, then click SOLVE in the capture panel…
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
      </div>
    </section>
  );
}
