"use client";

import type { SurveyAnalyzeStatus } from "@/lib/cyberdeck/survey-analyze-status.client";
import { SURVEY_MIRAGE_DISPLAY } from "@/lib/cyberdeck/survey-mode";

type SurveyAnalyzeSolvingBannerProps = {
  status: SurveyAnalyzeStatus;
  compact?: boolean;
};

export function SurveyAnalyzeSolvingBanner({ status, compact = false }: SurveyAnalyzeSolvingBannerProps) {
  if (status.phase === "idle") return null;

  if (status.phase === "running") {
    const itemLabel =
      status.itemIndex != null && status.itemTotal != null
        ? `item ${status.itemIndex + 1}/${status.itemTotal}`
        : "current item";

    return (
      <div
        className={`survey-analyze-solving ${compact ? "survey-analyze-solving--compact" : ""}`}
        role="status"
        aria-live="polite"
        data-testid="survey-analyze-solving"
      >
        <div className="survey-analyze-solving-head">
          <span className="survey-analyze-solving-glyph observe-presence-glyph--thinking">◉</span>
          <p className="survey-analyze-solving-title">
            {SURVEY_MIRAGE_DISPLAY} // SOLVING // {itemLabel}
          </p>
        </div>
        <p className="survey-analyze-solving-message cyberdeck-cogitating">{status.message}</p>
        <div className="panel-loader-bar survey-analyze-solving-bar" aria-hidden="true" />
      </div>
    );
  }

  if (status.phase === "failed") {
    return (
      <div
        className="survey-analyze-solving survey-analyze-solving--failed"
        role="alert"
        data-testid="survey-analyze-failed"
      >
        <p className="survey-analyze-solving-title">MUTHUR // ANALYZE FAILED</p>
        <p className="survey-analyze-solving-error">{status.error ?? status.message}</p>
      </div>
    );
  }

  if (status.phase === "complete" && status.resultText) {
    return (
      <div className="survey-analyze-solving survey-analyze-solving--complete" data-testid="survey-analyze-complete">
        <p className="survey-analyze-solving-title">
          MUTHUR // SOLVED
          {status.provider ? ` // ${status.provider}` : ""}
        </p>
        <p className="survey-analyze-solving-result whitespace-pre-wrap">{status.resultText}</p>
      </div>
    );
  }

  return null;
}
