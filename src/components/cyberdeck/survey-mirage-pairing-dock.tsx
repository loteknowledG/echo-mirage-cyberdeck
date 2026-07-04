"use client";

import { useCallback, useEffect, useState } from "react";
import { SurveyPairPinForm } from "@/components/cyberdeck/survey-pair-pin-form";
import { CyberdeckActionButton } from "@/components/cyberdeck/cyberdeck-control-button";
import {
  ECHO_SURVEY_TERMINATED_MESSAGE,
  SURVEY_ECHO_DISPLAY,
  SURVEY_MIRAGE_DISPLAY,
} from "@/lib/cyberdeck/survey-mode";
import { useSurveyEchoLinkWatch } from "@/lib/cyberdeck/survey-echo-link-watch";
import { notifySurveyTeamStatusChanged } from "@/lib/cyberdeck/survey-team-status";
import {
  formatSurveyEchoMirageLinkedLine,
  formatSurveySolutionsReadyLine,
  notifySurveyFocusChat,
  notifySurveyMuthurArchive,
} from "@/lib/cyberdeck/survey-chat";
import { useSurveyTeamStatus } from "@/lib/cyberdeck/use-survey-team-status";
import { useSurveyTeamSocket } from "@/lib/cyberdeck/survey-team-socket.client";
import {
  isSurveyHttpsPairBlocked,
  readSurveyMiragePairCredentials,
  saveSurveyMiragePairCredentials,
} from "@/lib/cyberdeck/survey-pairing-client";
import { DEFAULT_ECHO_HTTP_PORT } from "@/lib/cyberdeck/survey-pair-pin";
import {
  emitSurveyPairingDiagnostics,
  initSurveyPairingDebug,
  notifySurveyPairingDebug,
} from "@/lib/cyberdeck/survey-pairing-debug";
import {
  isSurveyLegacyPairingEnabled,
  isSurveyPairingDebugEnabled,
} from "@/lib/cyberdeck/survey-boundary";
import {
  buildSurveyMirageDesktopPath,
  openDesktopCyberdeckApp,
  probeLocalDesktopShell,
} from "@/lib/electron/desktop-install.client";

/** Sticky Mirage pairing dock — IP, port, code, pair (always above TEAM LINKS). */
export function SurveyMiragePairingDock() {
  const { paired, terminated, terminatedMessage, resetLinkWatch } = useSurveyEchoLinkWatch("mirage");
  const team = useSurveyTeamStatus();
  const [status, setStatus] = useState<string | null>(null);
  const [launchingDesktop, setLaunchingDesktop] = useState(false);
  const mirageLinked = team.echoMirage.state === "linked" || Boolean(paired && !terminated);
  const legacyPairing = isSurveyLegacyPairingEnabled();
  const pairBlocked = isSurveyHttpsPairBlocked();
  const savedCreds = readSurveyMiragePairCredentials();
  const defaultHost = team.echoHost ?? savedCreds?.echoHost ?? "127.0.0.1";
  const defaultPort = savedCreds?.httpPort ?? DEFAULT_ECHO_HTTP_PORT;
  const teamSocket = useSurveyTeamSocket({
    role: "mirage",
    echoHost: defaultHost,
    httpPort: defaultPort,
    enabled: legacyPairing && !pairBlocked && !mirageLinked,
  });

  useEffect(() => {
    initSurveyPairingDebug();
    if (isSurveyPairingDebugEnabled()) {
      void emitSurveyPairingDiagnostics("Mirage pairing dock opened");
    }
  }, []);

  const handleOpenDesktop = useCallback(async () => {
    setLaunchingDesktop(true);
    const localShell = await probeLocalDesktopShell();
    const path = buildSurveyMirageDesktopPath(defaultHost, defaultPort);
    openDesktopCyberdeckApp({
      path,
      localOrigin: localShell.shell ? localShell.origin : null,
    });
    setStatus(
      localShell.shell
        ? "Opening desktop cyberdeck — Survey → Mirage (m), then pair with IP + code."
        : "Launching desktop cyberdeck… Install it if nothing opens.",
    );
    setLaunchingDesktop(false);
  }, [defaultHost, defaultPort]);

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
      notifySurveyMuthurArchive(formatSurveyEchoMirageLinkedLine(result.echoHost));
      notifySurveyMuthurArchive(formatSurveySolutionsReadyLine());
      notifySurveyFocusChat();
      notifySurveyPairingDebug(
        `pair saved · ${result.echoHost}:${result.httpPort} · node ${creds.nodeId.slice(0, 8)}…`,
      );
      void emitSurveyPairingDiagnostics("after pair success");
      setStatus(`Linked with ${SURVEY_ECHO_DISPLAY} at ${result.echoHost}:${result.httpPort}.`);
    },
    [resetLinkWatch],
  );

  if (mirageLinked && paired && !terminated) {
    return (
      <div className="shrink-0 border-b border-emerald-900/50 bg-emerald-950/20 px-4 py-3 font-mono">
        <p className="text-[11px] font-semibold tracking-[0.14em] text-emerald-300">
          CONNECTED // {SURVEY_ECHO_DISPLAY} ↔ {SURVEY_MIRAGE_DISPLAY}
        </p>
        <p className="mt-1 text-[9px] text-emerald-300/80">
          {paired.echoHost}:{paired.httpPort} · node {paired.nodeId.slice(0, 8)}…
        </p>
      </div>
    );
  }

  return (
    <div className="shrink-0 border-b border-fuchsia-950/60 bg-fuchsia-950/10 px-4 py-3 font-mono">
      <p className="mb-2 text-[10px] font-semibold tracking-[0.12em] text-fuchsia-300/95">
        PAIR {SURVEY_MIRAGE_DISPLAY} WITH {SURVEY_ECHO_DISPLAY}
      </p>

      {legacyPairing ? (
        <>
      <div className="mb-3 rounded border border-cyan-950/50 bg-cyan-950/15 px-3 py-2 text-[8px] leading-relaxed text-[#9ab8b8]">
        <p className="mb-1 text-[9px] font-semibold tracking-[0.08em] text-cyan-300/90">Dev pairing (legacy)</p>
        <p>
          Same machine: Echo Satellite + desktop cyberdeck → IP <code className="text-cyan-100">127.0.0.1</code>,
          port <code className="text-cyan-100">3050</code>, code from Satellite.
        </p>
      </div>

      {terminated ? (
        <p className="mb-2 text-[9px] text-red-300/90">
          {terminatedMessage ?? ECHO_SURVEY_TERMINATED_MESSAGE} — re-pair below.
        </p>
      ) : null}

      {!pairBlocked && teamSocket.status === "connected" ? (
        <p className="mb-2 text-[8px] text-cyan-300/80">
          Team channel live — Echo can push pairing details with Send to Mirage.
        </p>
      ) : null}

      <SurveyPairPinForm
        role="mirage"
        roleLabel={SURVEY_MIRAGE_DISPLAY}
        focusClassName="focus:border-fuchsia-500/70"
        buttonLabel={
          terminated ? `Re-pair with ${SURVEY_ECHO_DISPLAY}` : `Pair with ${SURVEY_ECHO_DISPLAY}`
        }
        defaultEchoHost={defaultHost}
        useCloudRelay={pairBlocked}
        pushPrefill={teamSocket.lastBundle}
        onPaired={handlePaired}
      />
        </>
      ) : (
        <p className="mb-2 text-[9px] text-[#8a8a8a]">
          Legacy pairing hidden in this shell — use desktop + localhost for dev, or wait for Survey Hub.
        </p>
      )}

      {legacyPairing && pairBlocked ? (
        <div className="mb-2 flex flex-wrap gap-2">
          <CyberdeckActionButton disabled={launchingDesktop} onClick={() => void handleOpenDesktop()}>
            {launchingDesktop ? "Opening…" : "Or: open desktop cyberdeck"}
          </CyberdeckActionButton>
        </div>
      ) : null}

      {status ? <p className="mt-2 text-[9px] text-emerald-300/90">{status}</p> : null}
    </div>
  );
}
