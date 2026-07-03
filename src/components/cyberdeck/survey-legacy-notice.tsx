"use client";

import {
  isSurveyLegacyPairingEnabled,
  SURVEY_HUB_NOTICE,
} from "@/lib/cyberdeck/survey-boundary";
import { resolveSurveyCyberdeckShell } from "@/lib/electron/desktop-install.client";

export function SurveyLegacyNotice() {
  const shell =
    typeof window !== "undefined" ? resolveSurveyCyberdeckShell() : null;
  const legacyPairing = isSurveyLegacyPairingEnabled();

  return (
    <div className="shrink-0 border-b border-[#1a1a1a] bg-[#080808] px-4 py-2 font-mono">
      <p className="text-[8px] leading-relaxed tracking-[0.04em] text-[#6a6a6a]">
        {SURVEY_HUB_NOTICE}
      </p>
      {!legacyPairing ? (
        <p className="mt-1 text-[8px] text-amber-300/90">
          Legacy pairing disabled. Enable dev pair:{" "}
          <code className="text-amber-200/80">localStorage.survey-legacy-pairing=&quot;1&quot;</code>
        </p>
      ) : shell?.canDirectPairEcho ? (
        <p className="mt-1 text-[8px] text-emerald-300/80">
          Dev: direct Echo pair allowed ({shell.label}).
        </p>
      ) : (
        <p className="mt-1 text-[8px] text-amber-300/80">
          {shell?.label ?? "PWA"} — legacy direct pair unavailable; use desktop + localhost or wait for
          Survey Hub.
        </p>
      )}
    </div>
  );
}
