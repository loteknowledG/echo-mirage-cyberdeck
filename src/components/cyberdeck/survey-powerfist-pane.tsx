"use client";

import { useCallback, useState } from "react";
import { SurveyPairPinForm } from "@/components/cyberdeck/survey-pair-pin-form";
import {
  ECHO_SURVEY_TERMINATED_MESSAGE,
  SURVEY_ECHO_DISPLAY,
  SURVEY_MODE_TITLE,
  SURVEY_POWERFIST_LABEL,
  SURVEY_POWERFIST_TAGLINE,
} from "@/lib/cyberdeck/survey-mode";
import { useSurveyEchoLinkWatch } from "@/lib/cyberdeck/survey-echo-link-watch";
import { notifySurveyTeamStatusChanged } from "@/lib/cyberdeck/survey-team-status";
import {
  formatSurveyEchoPowerfistLinkedLine,
  notifySpyMuthurArchive,
} from "@/lib/cyberdeck/survey-chat";
import { isSurveyLegacyPairingEnabled } from "@/lib/cyberdeck/survey-boundary";
import {
  readSurveyPowerfistPairCredentials,
  saveSurveyPowerfistPairCredentials,
} from "@/lib/cyberdeck/survey-pairing-client";
import { useSurveyTeamSocket } from "@/lib/cyberdeck/survey-team-socket.client";

export function SurveyPowerfistPane() {
  const { paired, terminated, terminatedMessage, resetLinkWatch } = useSurveyEchoLinkWatch("powerfist");
  const [status, setStatus] = useState<string | null>(null);
  const legacyPairing = isSurveyLegacyPairingEnabled();
  const savedCreds = readSurveyPowerfistPairCredentials();
  const teamSocket = useSurveyTeamSocket({
    role: "powerfist",
    echoHost: savedCreds?.echoHost ?? null,
    httpPort: savedCreds?.httpPort ?? 3050,
    enabled: legacyPairing && (!paired || terminated),
  });

  const handlePaired = useCallback(
    (result: {
      echoHost: string;
      httpPort: number;
      echoNodeId: string;
      token: string;
      deviceId?: string;
      sessionEpoch: number;
    }) => {
      const creds = {
        echoHost: result.echoHost,
        httpPort: result.httpPort,
        echoNodeId: result.echoNodeId,
        remoteToken: result.token,
        deviceId: result.deviceId ?? "",
        sessionEpoch: result.sessionEpoch,
        pairedAt: new Date().toISOString(),
      };
      saveSurveyPowerfistPairCredentials(creds);
      resetLinkWatch();
      notifySurveyTeamStatusChanged();
      notifySpyMuthurArchive(formatSurveyEchoPowerfistLinkedLine(result.echoHost));
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
        <p className="text-amber-200/90">{SURVEY_MODE_TITLE} // {SURVEY_POWERFIST_LABEL}</p>
        <p className="mt-1 text-[9px] text-[#6a6a8a]">{SURVEY_POWERFIST_TAGLINE}</p>
      </div>

      <p className="text-[9px] leading-relaxed text-[#5f5f5f]">
        Enter Echo Satellite IP and port, then the 6-digit PowerFist code shown on Echo.
      </p>

      {paired && !terminated ? (
        <p className="text-emerald-300/80">
          LINKED // {SURVEY_ECHO_DISPLAY} {paired.echoHost} · device {paired.deviceId.slice(0, 8)}…
        </p>
      ) : !terminated ? (
        <p className="text-[#8a8a8a]">Not paired with {SURVEY_ECHO_DISPLAY}.</p>
      ) : null}

      {teamSocket.status === "connected" ? (
        <p className="text-[8px] text-cyan-300/80">Team channel live with Echo Satellite.</p>
      ) : null}

      {legacyPairing ? (
        <SurveyPairPinForm
          role="powerfist"
          roleLabel={SURVEY_POWERFIST_LABEL}
          focusClassName="focus:border-amber-900/60"
          buttonLabel={
            terminated ? `Re-pair with ${SURVEY_ECHO_DISPLAY}` : `Pair with ${SURVEY_ECHO_DISPLAY}`
          }
          onPaired={handlePaired}
        />
      ) : (
        <p className="text-[9px] text-[#8a8a8a]">Legacy PowerFist pairing frozen — Survey Hub coming.</p>
      )}

      {status ? <p className="text-emerald-300/80">{status}</p> : null}
    </div>
  );
}
