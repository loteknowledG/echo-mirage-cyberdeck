"use client";

import { useCallback, useState } from "react";
import { SurveyPairOtpInput } from "@/components/cyberdeck/survey-pair-otp-input";
import { SurveyPairPinCopyHint } from "@/components/cyberdeck/survey-pair-pin-display";
import { CyberdeckActionButton } from "@/components/cyberdeck/cyberdeck-control-button";
import { SurveyTriforceDeckEmbed } from "@/components/cyberdeck/survey-triforce-deck-embed";
import { SurveyMirageQueueTeamHost } from "@/components/cyberdeck/survey-mirage-queue-sync";
import {
  ECHO_SURVEY_TERMINATED_MESSAGE,
  SURVEY_ECHO_DISPLAY,
  SURVEY_MIRAGE_DISPLAY,
  SURVEY_MODE_TITLE,
  SURVEY_POWERFIST_LABEL,
  SURVEY_POWERFIST_TAGLINE,
} from "@/lib/cyberdeck/survey-mode";
import { useSurveyEchoLinkWatch } from "@/lib/cyberdeck/survey-echo-link-watch";
import { isSurveyTeamTripleLinked, notifySurveyTeamStatusChanged } from "@/lib/cyberdeck/survey-team-status";
import {
  formatSurveyMiragePowerfistLinkedLine,
  notifySurveyMuthurArchive,
} from "@/lib/cyberdeck/survey-chat";
import { isSurveyHubEnabled } from "@/lib/cyberdeck/survey-boundary";
import { SurveyHubSubPaneHint } from "@/components/cyberdeck/survey-hub-subpane-hint";
import {
  completePowerfistPairFromPin,
  readPowerfistRemoteCredentials,
} from "@/lib/cyberdeck/survey-hub-socket";
import { useSurveyTeamStatus } from "@/lib/cyberdeck/use-survey-team-status";
import {
  isValidSurveyPairPin,
  normalizeSurveyPairPin,
} from "@/lib/cyberdeck/survey-pair-pin";

function SurveyPowerfistPairingPanel() {
  const { terminated, terminatedMessage } = useSurveyEchoLinkWatch("powerfist");
  const team = useSurveyTeamStatus();
  const [hubPin, setHubPin] = useState("");
  const [hubBusy, setHubBusy] = useState(false);
  const [hubError, setHubError] = useState<string | null>(null);
  const [hubStatus, setHubStatus] = useState<string | null>(null);
  const mirageHubCreds = readPowerfistRemoteCredentials();
  const mirageHubLinked = team.miragePowerfist.state === "linked";
  const hubEnabled = isSurveyHubEnabled();

  const handleMirageHubPair = useCallback(async () => {
    if (!isValidSurveyPairPin(hubPin)) {
      setHubError(`Enter the 6-digit code from ${SURVEY_MIRAGE_DISPLAY} hub.`);
      return;
    }
    setHubBusy(true);
    setHubError(null);
    setHubStatus("Pairing with Mirage hub…");
    const result = await completePowerfistPairFromPin(hubPin);
    setHubBusy(false);
    if (!result.ok) {
      setHubStatus(null);
      setHubError(result.reason);
      return;
    }
    setHubPin("");
    setHubError(null);
    setHubStatus(`Linked with ${SURVEY_MIRAGE_DISPLAY} hub.`);
    notifySurveyTeamStatusChanged();
    notifySurveyMuthurArchive(formatSurveyMiragePowerfistLinkedLine(result.deviceId));
  }, [hubPin]);

  if (hubEnabled) {
    return (
      <>
        {terminated ? (
          <div className="rounded border border-red-900/50 bg-red-950/20 px-3 py-3 text-center">
            <p className="text-sm tracking-[0.12em] text-red-400/95">
              {terminatedMessage ?? ECHO_SURVEY_TERMINATED_MESSAGE}
            </p>
            <p className="mt-1 text-[9px] text-[#8a8a8a]">
              {SURVEY_ECHO_DISPLAY} closed its Survey tab. Retry connect when it is active again.
            </p>
          </div>
        ) : null}

        <div>
          <p className="text-amber-200/90">
            {SURVEY_MODE_TITLE} // {SURVEY_POWERFIST_LABEL}
          </p>
          <p className="mt-1 text-[9px] text-[#6a6a8a]">{SURVEY_POWERFIST_TAGLINE}</p>
        </div>

        {team.echoPowerfist.state === "linked" && !terminated ? (
          <p className="text-emerald-300/80">
            LINKED // {SURVEY_ECHO_DISPLAY} · device linked via Survey Hub
          </p>
        ) : !terminated ? (
          <p className="text-[#8a8a8a]">Waiting for Survey Hub to link {SURVEY_ECHO_DISPLAY}.</p>
        ) : null}

        {mirageHubLinked ? (
          <p className="text-emerald-300/80">
            LINKED // {SURVEY_MIRAGE_DISPLAY} hub · device{" "}
            {(mirageHubCreds?.deviceId ?? team.miragePowerfist.detail ?? "").slice(0, 8)}…
          </p>
        ) : (
          <p className="text-[#8a8a8a]">Waiting for Survey Hub to link {SURVEY_MIRAGE_DISPLAY}.</p>
        )}

        <SurveyHubSubPaneHint />
      </>
    );
  }

  return (
    <>
      {terminated ? (
        <div className="rounded border border-red-900/50 bg-red-950/20 px-3 py-3 text-center">
          <p className="text-sm tracking-[0.12em] text-red-400/95">
            {terminatedMessage ?? ECHO_SURVEY_TERMINATED_MESSAGE}
          </p>
          <p className="mt-1 text-[9px] text-[#8a8a8a]">
            {SURVEY_ECHO_DISPLAY} closed its Survey tab. Enable Survey Hub and reconnect when it is active again.
          </p>
        </div>
      ) : null}

      <div>
        <p className="text-amber-200/90">
          {SURVEY_MODE_TITLE} // {SURVEY_POWERFIST_LABEL}
        </p>
        <p className="mt-1 text-[9px] text-[#6a6a8a]">{SURVEY_POWERFIST_TAGLINE}</p>
      </div>

      <p className="text-[9px] text-[#8a8a8a]">
        Enable Survey Hub above — Connect team wires {SURVEY_ECHO_DISPLAY} and {SURVEY_POWERFIST_LABEL}{" "}
        automatically.
      </p>

      <SurveyHubSubPaneHint />

      <div className="border-t border-[#1c1c1c] pt-4">
        <p className="mb-2 text-[10px] font-semibold tracking-[0.12em] text-fuchsia-300/90">
          TRIPLE LINK // {SURVEY_MIRAGE_DISPLAY} hub
        </p>
        <p className="mb-3 text-[9px] leading-relaxed text-[#5f5f5f]">
          Enter the 6-digit code from Survey → {SURVEY_MIRAGE_DISPLAY} (m) →{" "}
          <strong className="text-[#8a8a8a]">PowerFist QR</strong> on the same machine.
        </p>
        {mirageHubLinked ? (
          <p className="mb-3 text-emerald-300/80">
            LINKED // {SURVEY_MIRAGE_DISPLAY} hub · device{" "}
            {(mirageHubCreds?.deviceId ?? team.miragePowerfist.detail ?? "").slice(0, 8)}…
          </p>
        ) : (
          <p className="mb-3 text-[#8a8a8a]">Not linked to {SURVEY_MIRAGE_DISPLAY} hub yet.</p>
        )}
        <div className="flex flex-col gap-2">
          <span className="text-[9px] tracking-[0.08em] text-[#8a8a8a]">{SURVEY_MIRAGE_DISPLAY} hub code</span>
          <SurveyPairOtpInput
            value={hubPin}
            onChange={(value) => setHubPin(normalizeSurveyPairPin(value))}
            disabled={hubBusy}
            focusClassName="focus:border-fuchsia-500/70"
          />
          <SurveyPairPinCopyHint pin={hubPin} />
        </div>
        <div className="mt-3">
          <CyberdeckActionButton disabled={hubBusy} onClick={() => void handleMirageHubPair()}>
            {hubBusy ? (hubStatus ?? "Pairing…") : `Pair with ${SURVEY_MIRAGE_DISPLAY} hub`}
          </CyberdeckActionButton>
        </div>
        {hubStatus && !hubError ? (
          <p className="mt-2 text-[9px] text-emerald-300/80">{hubStatus}</p>
        ) : null}
        {hubError ? <p className="mt-2 text-[9px] text-red-300/90">{hubError}</p> : null}
      </div>
    </>
  );
}

export function SurveyPowerfistPane() {
  const team = useSurveyTeamStatus();
  const tripleLinked = isSurveyTeamTripleLinked(team);
  const echoLinked = team.echoPowerfist.state === "linked";

  if (tripleLinked || echoLinked) {
    return (
      <div className="cyberdeck-survey-powerfist-deck cyberdeck-rola-dex-pane flex min-h-0 flex-1 flex-col overflow-hidden bg-[#050807]">
        <SurveyMirageQueueTeamHost role="powerfist" />
        <div className="relative min-h-0 min-w-0 flex-1">
          <SurveyTriforceDeckEmbed className="absolute inset-0 min-h-0 overflow-hidden" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4 font-mono text-[10px] tracking-[0.04em] text-[#707070]">
      <SurveyPowerfistPairingPanel />
    </div>
  );
}
