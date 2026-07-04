"use client";

import { useCallback, useState } from "react";
import { SurveyPairPinForm } from "@/components/cyberdeck/survey-pair-pin-form";
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
  formatSurveyEchoPowerfistLinkedLine,
  formatSurveyMiragePowerfistLinkedLine,
  notifySurveyMuthurArchive,
} from "@/lib/cyberdeck/survey-chat";
import { isSurveyLegacyPairingEnabled } from "@/lib/cyberdeck/survey-boundary";
import {
  readSurveyMiragePairCredentials,
  readSurveyPowerfistPairCredentials,
  saveSurveyPowerfistPairCredentials,
} from "@/lib/cyberdeck/survey-pairing-client";
import {
  completePowerfistPairFromPin,
  readPowerfistRemoteCredentials,
} from "@/lib/cyberdeck/powerfist-remote-socket";
import { useSurveyTeamSocket } from "@/lib/cyberdeck/survey-team-socket.client";
import { useSurveyTeamStatus } from "@/lib/cyberdeck/use-survey-team-status";
import {
  DEFAULT_ECHO_HTTP_PORT,
  isValidSurveyPairPin,
  normalizeSurveyPairPin,
} from "@/lib/cyberdeck/survey-pair-pin";

function SurveyPowerfistPairingPanel() {
  const { paired, terminated, terminatedMessage, resetLinkWatch } = useSurveyEchoLinkWatch("powerfist");
  const team = useSurveyTeamStatus();
  const [status, setStatus] = useState<string | null>(null);
  const [hubPin, setHubPin] = useState("");
  const [hubBusy, setHubBusy] = useState(false);
  const [hubError, setHubError] = useState<string | null>(null);
  const [hubStatus, setHubStatus] = useState<string | null>(null);
  const mirageHubCreds = readPowerfistRemoteCredentials();
  const mirageHubLinked = team.miragePowerfist.state === "linked" || Boolean(mirageHubCreds);
  const legacyPairing = isSurveyLegacyPairingEnabled();
  const savedCreds = readSurveyPowerfistPairCredentials();
  const mirageCreds = readSurveyMiragePairCredentials();
  const defaultEchoHost = mirageCreds?.echoHost ?? team.echoHost ?? null;
  const defaultEchoPort = mirageCreds?.httpPort ?? DEFAULT_ECHO_HTTP_PORT;
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
      notifySurveyMuthurArchive(formatSurveyEchoPowerfistLinkedLine(result.echoHost));
      setStatus(`Paired with ${SURVEY_ECHO_DISPLAY} at ${result.echoHost}.`);
    },
    [resetLinkWatch],
  );

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

  return (
    <>
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
        <p className="text-amber-200/90">
          {SURVEY_MODE_TITLE} // {SURVEY_POWERFIST_LABEL}
        </p>
        <p className="mt-1 text-[9px] text-[#6a6a8a]">{SURVEY_POWERFIST_TAGLINE}</p>
      </div>

      <p className="text-[9px] leading-relaxed text-[#5f5f5f]">
        Enter Echo Satellite IP and port, then the 6-digit PowerFist code shown on Echo.
        {defaultEchoHost ? (
          <>
            {" "}
            Mirage is linked at{" "}
            <code className="text-amber-200/80">
              {defaultEchoHost}:{defaultEchoPort}
            </code>
            .
          </>
        ) : null}
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
          defaultEchoHost={defaultEchoHost}
          pushPrefill={teamSocket.lastBundle}
          onPaired={handlePaired}
        />
      ) : (
        <p className="text-[9px] text-[#8a8a8a]">
          Use Survey Hub above — Connect team wires Echo + PowerFist automatically.
        </p>
      )}

      {status ? <p className="text-emerald-300/80">{status}</p> : null}

      <div className="border-t border-[#1c1c1c] pt-4">
        <p className="mb-2 text-[10px] font-semibold tracking-[0.12em] text-fuchsia-300/90">
          TRIPLE LINK // {SURVEY_MIRAGE_DISPLAY} hub
        </p>
        <p className="mb-3 text-[9px] leading-relaxed text-[#5f5f5f]">
          After Echo pairing, enter the 6-digit code from Survey → {SURVEY_MIRAGE_DISPLAY} (m) →{" "}
          <strong className="text-[#8a8a8a]">PowerFist QR</strong> (same machine — no second tab).
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

  if (tripleLinked) {
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
