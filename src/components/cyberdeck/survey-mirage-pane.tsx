"use client";

import { useCallback, useEffect, useState } from "react";
import { CyberdeckActionButton } from "@/components/cyberdeck/cyberdeck-control-button";
import { SurveyMirageCapturePreview } from "@/components/cyberdeck/survey-mirage-capture-preview";
import { SurveyMirageDesktopLink } from "@/components/cyberdeck/survey-mirage-desktop-link";
import { SurveyMirageExtCapturePanel } from "@/components/cyberdeck/survey-mirage-ext-capture-panel";
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
import {
  DEFAULT_ECHO_TAILSCALE_HOST,
  preferMeshEchoHost,
} from "@/lib/cyberdeck/survey-pair-pin";
import {
  isSurveyHttpsPairBlocked,
} from "@/lib/cyberdeck/survey-pairing-shared.client";
import { notifySurveyTeamStatusChanged } from "@/lib/cyberdeck/survey-team-status";
import { useSurveyTeamStatus } from "@/lib/cyberdeck/use-survey-team-status";
import {
  isEchoMirageDesktopShell,
  openDesktopCyberdeckApp,
} from "@/lib/electron/desktop-install.client";

/**
 * Mirage Survey sub-pane — PIN-pair Echo, capture screen, read answers.
 */
export function SurveyMiragePane() {
  const { paired, terminated, resetLinkWatch } = useSurveyEchoLinkWatch("mirage");
  const team = useSurveyTeamStatus();
  const mirageLinked = team.echoMirage.state === "linked" || Boolean(paired && !terminated);
  const [pwaBlocked, setPwaBlocked] = useState(false);

  useEffect(() => {
    setPwaBlocked(isSurveyHttpsPairBlocked());
  }, []);

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
      const echoHost =
        preferMeshEchoHost(result.echoHost) ?? DEFAULT_ECHO_TAILSCALE_HOST;
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

      <SurveyMirageDesktopLink />

      {pwaBlocked ? (
        <div className="space-y-2 rounded border border-amber-900/50 bg-amber-950/20 p-3">
          <p className="text-[9px] leading-relaxed text-amber-200/90">
            HTTPS PWA uses the cloud relay for Echo screenshots — keep Echo Satellite open on the
            Mac. No secret and no team id to paste.
          </p>
          {!isEchoMirageDesktopShell() ? (
            <CyberdeckActionButton
              variant="neutral"
              onClick={() => void openDesktopCyberdeckApp()}
            >
              Open desktop cyberdeck
            </CyberdeckActionButton>
          ) : null}
        </div>
      ) : null}

      {!mirageLinked && !terminated && !pwaBlocked ? (
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

      <SurveyMirageExtCapturePanel />

      <div className="border-t border-[#1c1c1c] pt-4">
        <SurveySolutionsPanel />
      </div>
    </div>
  );
}
