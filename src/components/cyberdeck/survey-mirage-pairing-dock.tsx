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
import {
  isEchoMirageDesktopShell,
  isPwaStandaloneSession,
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
  const pwaShell = isPwaStandaloneSession() && !isEchoMirageDesktopShell();
  const defaultHost =
    team.echoHost ?? readSurveyMiragePairCredentials()?.echoHost ?? "100.66.91.18";

  useEffect(() => {
    initSurveyPairingDebug();
    void emitSurveyPairingDiagnostics("Mirage pairing dock opened");
  }, []);

  const handleOpenDesktop = useCallback(async () => {
    setLaunchingDesktop(true);
    const localShell = await probeLocalDesktopShell();
    openDesktopCyberdeckApp({
      path: "/cyberdeck",
      localOrigin: localShell.shell ? localShell.origin : null,
    });
    setStatus(
      localShell.shell
        ? "Opening desktop cyberdeck — pair there with IP + code."
        : "Launching desktop cyberdeck… Install it if nothing opens.",
    );
    setLaunchingDesktop(false);
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

      {terminated ? (
        <p className="mb-2 text-[9px] text-red-300/90">
          {terminatedMessage ?? ECHO_SURVEY_TERMINATED_MESSAGE} — re-pair below.
        </p>
      ) : null}

      {pwaShell ? (
        <div className="mb-3 rounded border border-amber-900/50 bg-amber-950/30 px-3 py-2">
          <p className="text-[9px] leading-relaxed text-amber-100/95">
            Installed PWA cannot reach Echo over Tailscale. Pair from the{" "}
            <strong>desktop cyberdeck</strong> on this laptop.
          </p>
          <CyberdeckActionButton
            className="mt-2"
            disabled={launchingDesktop}
            onClick={() => void handleOpenDesktop()}
          >
            {launchingDesktop ? "Opening…" : "Open desktop cyberdeck"}
          </CyberdeckActionButton>
        </div>
      ) : null}

      <SurveyPairPinForm
        role="mirage"
        roleLabel={SURVEY_MIRAGE_DISPLAY}
        focusClassName="focus:border-fuchsia-500/70"
        buttonLabel={
          terminated ? `Re-pair with ${SURVEY_ECHO_DISPLAY}` : `Pair with ${SURVEY_ECHO_DISPLAY}`
        }
        defaultEchoHost={defaultHost}
        onPaired={handlePaired}
      />

      {status ? <p className="mt-2 text-[9px] text-emerald-300/90">{status}</p> : null}
    </div>
  );
}
