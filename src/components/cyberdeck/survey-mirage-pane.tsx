"use client";

import { useCallback } from "react";
import { SurveyMirageCapturePreview } from "@/components/cyberdeck/survey-mirage-capture-preview";
import { SurveyMirageQueueTeamHost } from "@/components/cyberdeck/survey-mirage-queue-sync";
import { SurveyPairPinForm } from "@/components/cyberdeck/survey-pair-pin-form";
import { SurveySolutionsPanel } from "@/components/cyberdeck/survey-solutions-panel";
import {
  SURVEY_ECHO_DISPLAY,
  SURVEY_MIRAGE_DISPLAY,
  SURVEY_MODE_TITLE,
} from "@/lib/cyberdeck/survey-mode";
import { useSurveyEchoLinkWatch } from "@/lib/cyberdeck/survey-echo-link-watch";
import { saveSurveyMiragePairCredentials } from "@/lib/cyberdeck/survey-pair-credentials.client";
import { notifySurveyTeamStatusChanged } from "@/lib/cyberdeck/survey-team-status";
import { useSurveyTeamStatus } from "@/lib/cyberdeck/use-survey-team-status";

/** Default Tailscale MagicDNS / mesh IP for Echo Mac when pairing from Windows Mirage. */
const DEFAULT_ECHO_TAILSCALE_HOST = "100.70.46.6";

/**
 * Mirage Survey sub-pane — PIN-pair Echo, capture screen, read answers.
 */
export function SurveyMiragePane() {
  const { paired, terminated, resetLinkWatch } = useSurveyEchoLinkWatch("mirage");
  const team = useSurveyTeamStatus();
  const mirageLinked = team.echoMirage.state === "linked" || Boolean(paired && !terminated);

  const handlePaired = useCallback(
    (result: {
      echoHost: string;
      httpPort: number;
      echoNodeId: string;
      token: string;
      nodeId?: string;
      sessionEpoch: number;
    }) => {
      // Satellite often reports LAN IP; keep Tailscale mesh host for Windows Mirage.
      const lan =
        result.echoHost.startsWith("192.168.") ||
        result.echoHost.startsWith("10.") ||
        result.echoHost.startsWith("172.");
      const echoHost = lan ? DEFAULT_ECHO_TAILSCALE_HOST : result.echoHost;
      saveSurveyMiragePairCredentials({
        echoHost,
        httpPort: result.httpPort,
        echoNodeId: result.echoNodeId,
        mirageToken: result.token,
        nodeId: result.nodeId ?? "",
        sessionEpoch: result.sessionEpoch,
        pairedAt: new Date().toISOString(),
      });
      resetLinkWatch();
      notifySurveyTeamStatusChanged();
      void team.refresh();
    },
    [resetLinkWatch, team],
  );

  return (
    <div
      className="flex flex-col gap-3 p-4 font-mono text-[10px] tracking-[0.04em] text-[#707070]"
      data-survey-role="mirage"
      data-survey-runtime="browser"
    >
      <SurveyMirageQueueTeamHost role="mirage" />

      <p className="text-fuchsia-300/90">
        {SURVEY_MODE_TITLE} // {SURVEY_MIRAGE_DISPLAY}
      </p>

      {!mirageLinked && !terminated ? (
        <SurveyPairPinForm
          role="mirage"
          roleLabel={SURVEY_MIRAGE_DISPLAY}
          buttonLabel={`Pair with ${SURVEY_ECHO_DISPLAY}`}
          defaultEchoHost={DEFAULT_ECHO_TAILSCALE_HOST}
          onPaired={handlePaired}
        />
      ) : null}

      {mirageLinked ? (
        <p className="text-[9px] text-emerald-300/80">
          LINKED // {SURVEY_ECHO_DISPLAY}
          {paired?.echoHost ? ` · ${paired.echoHost}:${paired.httpPort}` : null}
        </p>
      ) : null}

      <SurveyMirageCapturePreview />

      <div className="border-t border-[#1c1c1c] pt-4">
        <SurveySolutionsPanel />
      </div>
    </div>
  );
}
