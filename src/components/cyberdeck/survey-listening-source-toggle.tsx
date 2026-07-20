"use client";

import { useEffect, useState } from "react";
import { CyberdeckFilterButton } from "@/components/cyberdeck/cyberdeck-control-button";
import {
  readSurveyListeningSource,
  setSurveyListeningSource,
  subscribeSurveyListeningSource,
  type SurveyListeningSource,
} from "@/lib/cyberdeck/survey-listening-source.client";

type SurveyListeningSourceToggleProps = {
  className?: string;
  /** Compact for PowerFist armed card. */
  compact?: boolean;
  disabled?: boolean;
};

/** Shared ECHO / MIRAGE listening-source toggle. */
export function SurveyListeningSourceToggle({
  className = "",
  compact = false,
  disabled = false,
}: SurveyListeningSourceToggleProps) {
  const [source, setSource] = useState<SurveyListeningSource>("echo");

  useEffect(() => subscribeSurveyListeningSource(setSource), []);

  return (
    <div
      className={`flex flex-wrap items-center gap-2 ${className}`.trim()}
      role="group"
      aria-label="Listening source"
      data-testid="survey-listening-source-toggle"
    >
      {!compact ? (
        <p className="text-[9px] tracking-[0.1em] text-[#8a8a8a]">SOURCE</p>
      ) : null}
      <CyberdeckFilterButton
        active={source === "echo"}
        disabled={disabled}
        onClick={() => setSurveyListeningSource("echo")}
        data-testid="survey-listening-source-echo"
      >
        ECHO
      </CyberdeckFilterButton>
      <CyberdeckFilterButton
        active={source === "mirage"}
        disabled={disabled}
        onClick={() => setSurveyListeningSource("mirage")}
        data-testid="survey-listening-source-mirage"
      >
        MIRAGE
      </CyberdeckFilterButton>
      {!compact ? (
        <p className="text-[8px] tracking-[0.04em] text-[#5f5f5f]">
          {source === "echo"
            ? "Echo Satellite mic → relay STT"
            : "This device mic → browser STT"}
        </p>
      ) : (
        <span className="text-[8px] tracking-[0.08em] text-[#6a6a6a]">
          {source === "echo" ? "SAT" : "LOCAL"}
        </span>
      )}
    </div>
  );
}
