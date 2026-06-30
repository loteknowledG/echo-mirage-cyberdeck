"use client";

import { useCallback, useState } from "react";
import { EspionageMirageHubPanel } from "@/components/cyberdeck/espionage-mirage-hub-panel";
import { EspionageSolutionsPanel } from "@/components/cyberdeck/espionage-solutions-panel";
import { SpyPairPinForm } from "@/components/cyberdeck/spy-pair-pin-form";
import {
  ECHO_SPY_TERMINATED_MESSAGE,
  ESPIONAGE_ECHO_DISPLAY,
  ESPIONAGE_MIRAGE_DISPLAY,
  ESPIONAGE_MIRAGE_TAGLINE,
  ESPIONAGE_MODE_TITLE,
} from "@/lib/cyberdeck/espionage-mode";
import { useSpyEchoLinkWatch } from "@/lib/cyberdeck/spy-echo-link-watch";
import { notifySpyTeamStatusChanged } from "@/lib/cyberdeck/spy-team-status";
import {
  formatEspionageEchoMirageLinkedLine,
  formatEspionageSolutionsReadyLine,
  notifyEspionageFocusChat,
  notifySpyMuthurArchive,
} from "@/lib/cyberdeck/espionage-chat";
import { useSpyTeamStatus } from "@/lib/cyberdeck/use-spy-team-status";
import {
  readSpyMiragePairCredentials,
  saveSpyMiragePairCredentials,
} from "@/lib/cyberdeck/spy-pairing-client";

export function SpyMiragePane() {
  const { paired, terminated, terminatedMessage, resetLinkWatch } = useSpyEchoLinkWatch("mirage");
  const team = useSpyTeamStatus();
  const [status, setStatus] = useState<string | null>(null);
  const mirageLinked = team.echoMirage.state === "linked" || Boolean(paired && !terminated);

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
      saveSpyMiragePairCredentials(creds);
      resetLinkWatch();
      notifySpyTeamStatusChanged();
      notifySpyMuthurArchive(formatEspionageEchoMirageLinkedLine(result.echoHost));
      notifySpyMuthurArchive(formatEspionageSolutionsReadyLine());
      notifyEspionageFocusChat();
      setStatus(`Paired with ${ESPIONAGE_ECHO_DISPLAY} at ${result.echoHost}.`);
    },
    [resetLinkWatch],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-4 font-mono text-[10px] tracking-[0.04em] text-[#707070]">
      {terminated ? (
        <div className="rounded border border-red-900/50 bg-red-950/20 px-3 py-3 text-center">
          <p className="text-sm tracking-[0.12em] text-red-400/95">
            {terminatedMessage ?? ECHO_SPY_TERMINATED_MESSAGE}
          </p>
          <p className="mt-1 text-[9px] text-[#8a8a8a]">
            {ESPIONAGE_ECHO_DISPLAY} closed its Spy tab. Re-pair when it is active again.
          </p>
        </div>
      ) : null}

      <div>
        <p className="text-fuchsia-300/90">{ESPIONAGE_MODE_TITLE} // {ESPIONAGE_MIRAGE_DISPLAY}</p>
        <p className="mt-1 text-[9px] text-[#6a6a8a]">{ESPIONAGE_MIRAGE_TAGLINE}</p>
      </div>

      <p className="text-[9px] leading-relaxed text-[#5f5f5f]">
        Enter the 6-digit Mirage code from Echo Satellite (or this pane on the Echo Mac). Mirage finds Echo
        on your Wi‑Fi automatically — paste <code className="text-[#8a8a8a]">192.168.x.x:3050</code> under
        Advanced only if auto-detect fails.
      </p>

      {paired && !terminated ? (
        <p className="text-emerald-300/80">
          LINKED // {ESPIONAGE_ECHO_DISPLAY} {paired.echoHost} · node {paired.nodeId.slice(0, 8)}…
        </p>
      ) : !terminated ? (
        <p className="text-[#8a8a8a]">Not paired with {ESPIONAGE_ECHO_DISPLAY}.</p>
      ) : null}

      <SpyPairPinForm
        role="mirage"
        roleLabel={ESPIONAGE_MIRAGE_DISPLAY}
        focusClassName="focus:border-fuchsia-900/60"
        buttonLabel={
          terminated ? `Re-pair with ${ESPIONAGE_ECHO_DISPLAY}` : `Pair with ${ESPIONAGE_ECHO_DISPLAY}`
        }
        onPaired={handlePaired}
      />

      {status ? <p className="text-emerald-300/80">{status}</p> : null}

      {mirageLinked ? (
        <div className="border-t border-[#1c1c1c] pt-4">
          <EspionageSolutionsPanel />
        </div>
      ) : null}

      <div className="border-t border-[#1c1c1c] pt-4">
        <EspionageMirageHubPanel
          echoHost={paired?.echoHost ?? readSpyMiragePairCredentials()?.echoHost ?? null}
          echoHttpPort={paired?.httpPort ?? readSpyMiragePairCredentials()?.httpPort ?? null}
        />
      </div>
    </div>
  );
}
