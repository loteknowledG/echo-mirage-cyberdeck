"use client";

import { SurveyMirageCapturePreview } from "@/components/cyberdeck/survey-mirage-capture-preview";
import { SurveyMirageQueueTeamHost } from "@/components/cyberdeck/survey-mirage-queue-sync";
import { SurveySolutionsPanel } from "@/components/cyberdeck/survey-solutions-panel";
import {
  SURVEY_ECHO_DISPLAY,
  SURVEY_MIRAGE_DISPLAY,
  SURVEY_MODE_TITLE,
} from "@/lib/cyberdeck/survey-mode";
import { useSurveyEchoLinkWatch } from "@/lib/cyberdeck/survey-echo-link-watch";
import { isSurveyHubEnabled } from "@/lib/cyberdeck/survey-boundary";
import { SurveyHubSubPaneHint } from "@/components/cyberdeck/survey-hub-subpane-hint";
import { useSurveyTeamStatus } from "@/lib/cyberdeck/use-survey-team-status";

/**
 * Mirage Survey sub-pane — capture Echo screen, then read answers.
 * Advanced queue / extension / hub-QR tooling lives elsewhere (TEAM LINKS, PowerFist).
 */
export function SurveyMiragePane() {
  const { paired, terminated } = useSurveyEchoLinkWatch("mirage");
  const team = useSurveyTeamStatus();
  const hubEnabled = isSurveyHubEnabled();
  const mirageLinked = team.echoMirage.state === "linked" || Boolean(paired && !terminated);

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
        hubEnabled ? (
          <SurveyHubSubPaneHint />
        ) : (
          <p className="text-[#8a8a8a]">
            Enable Survey Hub above, then link {SURVEY_ECHO_DISPLAY} with the PIN.
          </p>
        )
      ) : null}

      <SurveyMirageCapturePreview />

      <div className="border-t border-[#1c1c1c] pt-4">
        <SurveySolutionsPanel />
      </div>
    </div>
  );
}
