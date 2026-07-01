"use client";

import { useCallback, useEffect, useState } from "react";
import { SurveyMirageHubPanel } from "@/components/cyberdeck/survey-mirage-hub-panel";
import { SurveySolutionsPanel } from "@/components/cyberdeck/survey-solutions-panel";
import { SurveyPairPinForm } from "@/components/cyberdeck/survey-pair-pin-form";
import {
  ECHO_SURVEY_TERMINATED_MESSAGE,
  SURVEY_ECHO_DISPLAY,
  SURVEY_MIRAGE_DISPLAY,
  SURVEY_MIRAGE_TAGLINE,
  SURVEY_MODE_TITLE,
} from "@/lib/cyberdeck/survey-mode";
import { useSurveyEchoLinkWatch } from "@/lib/cyberdeck/survey-echo-link-watch";
import { notifySurveyTeamStatusChanged } from "@/lib/cyberdeck/survey-team-status";
import {
  formatSurveyEchoMirageLinkedLine,
  formatSurveySolutionsReadyLine,
  notifySurveyFocusChat,
  notifySpyMuthurArchive,
} from "@/lib/cyberdeck/survey-chat";
import { useSurveyTeamStatus } from "@/lib/cyberdeck/use-survey-team-status";
import {
  readSurveyMiragePairCredentials,
  saveSurveyMiragePairCredentials,
} from "@/lib/cyberdeck/survey-pairing-client";
import {
  emitSurveyPairingDiagnostics,
  initSurveyPairingDebug,
  notifySurveyPairingDebug,
} from "@/lib/cyberdeck/survey-pairing-debug";

export function SurveyMiragePane() {
  const { paired, terminated, terminatedMessage, resetLinkWatch } = useSurveyEchoLinkWatch("mirage");
  const team = useSurveyTeamStatus();
  const [status, setStatus] = useState<string | null>(null);
  const mirageLinked = team.echoMirage.state === "linked" || Boolean(paired && !terminated);

  useEffect(() => {
    initSurveyPairingDebug();
    void emitSurveyPairingDiagnostics("Mirage pane opened");
  }, []);

  useEffect(() => {
    if (!terminated) return;
    notifySurveyPairingDebug(`session terminated — ${terminatedMessage ?? ECHO_SURVEY_TERMINATED_MESSAGE}`);
    void emitSurveyPairingDiagnostics("link terminated");
  }, [terminated, terminatedMessage]);

  const handlePaired = useCallback(
    (result: {
      echoHost: string;
      httpPort: number;
      echoNodeId: string;
      token: string;
      nodeId?: string;
      sessionEpoch: number;
    }) => {
      const creds = {
        echoHost: result.echoHost,
        httpPort: result.httpPort,
        echoNodeId: result.echoNodeId,
        mirageToken: result.token,
        nodeId: result.nodeId ?? "",
        sessionEpoch: result.sessionEpoch,
        pairedAt: new Date().toISOString(),
      };
      saveSurveyMiragePairCredentials(creds);
      resetLinkWatch();
      notifySurveyTeamStatusChanged();
      notifySpyMuthurArchive(formatSurveyEchoMirageLinkedLine(result.echoHost));
      notifySpyMuthurArchive(formatSurveySolutionsReadyLine());
      notifySurveyFocusChat();
      notifySurveyPairingDebug(
        `pair saved · ${result.echoHost}:${result.httpPort} · node ${creds.nodeId.slice(0, 8)}… · epoch ${result.sessionEpoch}`,
      );
      void emitSurveyPairingDiagnostics("after pair success");
      setStatus(`Paired with ${SURVEY_ECHO_DISPLAY} at ${result.echoHost}.`);
    },
    [resetLinkWatch],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-4 font-mono text-[10px] tracking-[0.04em] text-[#707070]">
      {terminated ? (
        <div className="rounded border border-red-900/50 bg-red-950/20 px-3 py-3 text-center">
          <p className="text-sm tracking-[0.12em] text-red-400/95">
            {terminatedMessage ?? ECHO_SURVEY_TERMINATED_MESSAGE}
          </p>
          <p className="mt-1 text-[9px] text-[#8a8a8a]">
            {SURVEY_ECHO_DISPLAY} closed its Survey tab. Re-pair when it is active again.
          </p>
        </div>
      ) : null}

      <div>
        <p className="text-fuchsia-300/90">{SURVEY_MODE_TITLE} // {SURVEY_MIRAGE_DISPLAY}</p>
        <p className="mt-1 text-[9px] text-[#6a6a8a]">{SURVEY_MIRAGE_TAGLINE}</p>
      </div>

      {paired && !terminated ? (
        <p className="text-emerald-300/80">
          LINKED // {SURVEY_ECHO_DISPLAY} {paired.echoHost} · node {paired.nodeId.slice(0, 8)}…
        </p>
      ) : !terminated ? (
        <p className="text-[#8a8a8a]">Not paired with {SURVEY_ECHO_DISPLAY}.</p>
      ) : null}

      <SurveyPairPinForm
        role="mirage"
        roleLabel={SURVEY_MIRAGE_DISPLAY}
        focusClassName="focus:border-fuchsia-900/60"
        buttonLabel={
          terminated ? `Re-pair with ${SURVEY_ECHO_DISPLAY}` : `Pair with ${SURVEY_ECHO_DISPLAY}`
        }
        onPaired={handlePaired}
      />

      {status ? <p className="text-emerald-300/80">{status}</p> : null}

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
