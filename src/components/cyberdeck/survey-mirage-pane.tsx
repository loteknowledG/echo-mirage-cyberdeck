"use client";

import { SurveyMirageHubPanel } from "@/components/cyberdeck/survey-mirage-hub-panel";
import { SurveyMirageCapturePreview } from "@/components/cyberdeck/survey-mirage-capture-preview";
import { SurveyMirageItemSelectList } from "@/components/cyberdeck/survey-mirage-item-select-list";
import { SurveyMirageQueueTeamHost } from "@/components/cyberdeck/survey-mirage-queue-sync";
import { SurveySolutionsPanel } from "@/components/cyberdeck/survey-solutions-panel";
import {
  SURVEY_ECHO_DISPLAY,
  SURVEY_MIRAGE_DISPLAY,
  SURVEY_MIRAGE_TAGLINE,
  SURVEY_MODE_TITLE,
} from "@/lib/cyberdeck/survey-mode";
import { useSurveyEchoLinkWatch } from "@/lib/cyberdeck/survey-echo-link-watch";
import { isSurveyHubEnabled } from "@/lib/cyberdeck/survey-boundary";
import { SurveyHubSubPaneHint } from "@/components/cyberdeck/survey-hub-subpane-hint";
import { useSurveyTeamStatus } from "@/lib/cyberdeck/use-survey-team-status";
import { useSurveyExtensionPageContextStatus } from "@/lib/cyberdeck/survey-extension-page-context.client";
import { readSurveyMiragePairCredentials } from "@/lib/cyberdeck/survey-pairing-client";

export function SurveyMiragePane() {
  const { paired, terminated } = useSurveyEchoLinkWatch("mirage");
  const team = useSurveyTeamStatus();
  const extension = useSurveyExtensionPageContextStatus();
  const hubEnabled = isSurveyHubEnabled();
  const mirageLinked = team.echoMirage.state === "linked" || Boolean(paired && !terminated);

  return (
    <div className="flex flex-col gap-3 p-4 font-mono text-[10px] tracking-[0.04em] text-[#707070]">
      <SurveyMirageQueueTeamHost role="mirage" />
      <div>
        <p className="text-fuchsia-300/90">{SURVEY_MODE_TITLE} // {SURVEY_MIRAGE_DISPLAY}</p>
        <p className="mt-1 text-[9px] text-[#6a6a8a]">{SURVEY_MIRAGE_TAGLINE}</p>
      </div>

      {extension.lastSnapshot ? (
        <p className="rounded border border-emerald-500/40 bg-emerald-950/15 px-3 py-2 text-[8px] leading-relaxed text-[#8ab89a]">
          Survey Satellite · received{" "}
          <strong className="text-emerald-300/90">
            {extension.lastSnapshot.title || extension.lastSnapshot.url}
          </strong>
          {extension.deliveredAt ? (
            <span className="text-[#5f8f74]">
              {" "}
              · {new Date(extension.deliveredAt).toLocaleTimeString()}
            </span>
          ) : null}
        </p>
      ) : (
        <p className="rounded border border-[#1c1c1c] bg-black/40 px-3 py-2 text-[8px] leading-relaxed text-[#5f5f5f]">
          Survey Satellite extension — send active-tab text from Chrome; a receipt toast appears on
          cyberdeck when it lands.
        </p>
      )}

      {!mirageLinked && !terminated ? (
        hubEnabled ? (
          <SurveyHubSubPaneHint />
        ) : (
          <p className="text-[#8a8a8a]">
            Enable Survey Hub above to connect with {SURVEY_ECHO_DISPLAY}.
          </p>
        )
      ) : null}

      {mirageLinked ? (
        <>
          <SurveyMirageItemSelectList surface="mirage" className="-mx-4 rounded-none border-x-0" />
          <SurveyMirageCapturePreview />
          <div className="border-t border-[#1c1c1c] pt-4">
            <SurveySolutionsPanel />
          </div>
        </>
      ) : null}

      {!hubEnabled ? (
        <div className="border-t border-[#1c1c1c] pt-4">
          <SurveyMirageHubPanel
            echoHost={paired?.echoHost ?? readSurveyMiragePairCredentials()?.echoHost ?? null}
            echoHttpPort={paired?.httpPort ?? readSurveyMiragePairCredentials()?.httpPort ?? null}
          />
        </div>
      ) : null}
    </div>
  );
}
