"use client";

import { useEffect, useState } from "react";
import {
  readSurveyListeningState,
  subscribeSurveyListening,
  type SurveyListeningClientState,
} from "@/lib/cyberdeck/survey-listening.client";

/** Live Echo interviewer transcript + suggest status on Mirage Survey. */
export function SurveyListeningPostStrip() {
  const [listening, setListening] = useState<SurveyListeningClientState>(() =>
    readSurveyListeningState(),
  );

  useEffect(() => subscribeSurveyListening(setListening), []);

  const armed = listening.armed || listening.listening;
  if (!armed && !listening.lastFinal && !listening.error && !listening.banner) {
    return (
      <div
        className="rounded-sm border border-[#1c1c1c] bg-black/60 px-3 py-2 font-mono text-[9px] tracking-[0.06em] text-[#5f5f5f]"
        data-testid="survey-listening-post-idle"
      >
        LISTENING POST // idle — use PowerFist Listening Deck → Start Listening
      </div>
    );
  }

  return (
    <div
      className="rounded-sm border border-[#1c1c1c] bg-black/80 px-3 py-2 font-mono text-[9px] tracking-[0.06em] text-[#8a8a8a]"
      data-testid="survey-listening-post"
    >
      <div className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="tracking-[0.1em] text-[#a0a0a0]">LISTENING POST</span>
        <span className={listening.listening ? "text-emerald-300/90" : "text-[#6a6a6a]"}>
          {listening.listening ? "LIVE" : listening.armed ? "ARMED" : "IDLE"}
        </span>
        {listening.banner ? <span className="text-[#9a9a9a]">{listening.banner}</span> : null}
      </div>
      {listening.error ? (
        <p className="mb-1 text-red-400/90" data-testid="survey-listening-error">
          {listening.error}
        </p>
      ) : null}
      <p className="text-[#b0b0b0]">
        <span className="text-[#6a6a6a]">INTERIM </span>
        {listening.interim || "—"}
      </p>
      <p className="mt-1 text-[#c8c8c8]">
        <span className="text-[#6a6a6a]">FINAL </span>
        {listening.lastFinal || "—"}
      </p>
      {listening.lastSuggestAnswer ? (
        <p className="mt-2 border-t border-[#1c1c1c] pt-2 text-emerald-200/85">
          <span className="text-[#6a6a6a]">SUGGEST </span>
          {listening.lastSuggestAnswer.slice(0, 280)}
          {listening.lastSuggestAnswer.length > 280 ? "…" : ""}
        </p>
      ) : null}
    </div>
  );
}
