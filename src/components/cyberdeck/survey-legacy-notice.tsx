"use client";

import { isSurveyHubEnabled } from "@/lib/cyberdeck/survey-boundary";
import { requestSurveyHubConnect } from "@/lib/cyberdeck/survey-connect-request.client";
import { resolveSurveyCyberdeckShell } from "@/lib/electron/desktop-install.client";

/** Shown when Survey Hub is disabled — directs users to enable Hub connect. */
export function SurveyLegacyNotice() {
  if (isSurveyHubEnabled()) {
    return null;
  }

  const shell =
    typeof window !== "undefined" ? resolveSurveyCyberdeckShell() : null;

  return (
    <div className="shrink-0 border-b border-[#1a1a1a] bg-[#080808] px-4 py-2 font-mono">
      <p className="text-[8px] leading-relaxed tracking-[0.04em] text-[#6a6a6a]">
        Survey Hub is off — enable connect:{" "}
        <code className="text-cyan-200/80">localStorage.survey-hub=&quot;1&quot;</code>
      </p>
      {shell?.canDirectPairEcho ? (
        <p className="mt-1 text-[8px] text-emerald-300/80">
          Dev shell ({shell.label}) —{" "}
          <button
            type="button"
            className="text-emerald-200 underline decoration-emerald-500/40 hover:text-emerald-100"
            onClick={() => requestSurveyHubConnect()}
          >
            retry connect
          </button>
        </p>
      ) : null}
    </div>
  );
}
