"use client";

import { SurveyMirageHubPanel } from "@/components/cyberdeck/survey-mirage-hub-panel";
import { SurveySolutionsPanel } from "@/components/cyberdeck/survey-solutions-panel";
import {
  SURVEY_MIRAGE_DISPLAY,
  SURVEY_MIRAGE_TAGLINE,
  SURVEY_MODE_TITLE,
} from "@/lib/cyberdeck/survey-mode";
import { useSurveyEchoLinkWatch } from "@/lib/cyberdeck/survey-echo-link-watch";
import { useSurveyTeamStatus } from "@/lib/cyberdeck/use-survey-team-status";
import { readSurveyMiragePairCredentials } from "@/lib/cyberdeck/survey-pairing-client";

export function SurveyMiragePane() {
  const { paired, terminated } = useSurveyEchoLinkWatch("mirage");
  const team = useSurveyTeamStatus();
  const mirageLinked = team.echoMirage.state === "linked" || Boolean(paired && !terminated);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overflow-x-hidden p-4 font-mono text-[10px] tracking-[0.04em] text-[#707070]">
      <div>
        <p className="text-fuchsia-300/90">{SURVEY_MODE_TITLE} // {SURVEY_MIRAGE_DISPLAY}</p>
        <p className="mt-1 text-[9px] text-[#6a6a8a]">{SURVEY_MIRAGE_TAGLINE}</p>
      </div>

      {!mirageLinked && !terminated ? (
        <p className="text-[#8a8a8a]">Use the pairing box above TEAM LINKS to connect with {SURVEY_ECHO_DISPLAY}.</p>
      ) : null}

      {mirageLinked ? (
        <div className="border-t border-[#1c1c1c] pt-4">
          <SurveySolutionsPanel />
        </div>
      ) : null}

      <div className="border-t border-[#1c1c1c] pt-4">
        <SurveyMirageHubPanel
          echoHost={paired?.echoHost ?? readSurveyMiragePairCredentials()?.echoHost ?? null}
          echoHttpPort={paired?.httpPort ?? readSurveyMiragePairCredentials()?.httpPort ?? null}
        />
      </div>
    </div>
  );
}
