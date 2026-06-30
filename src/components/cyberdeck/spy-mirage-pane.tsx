"use client";

import { useCallback, useState } from "react";
import { EspionageMirageHubPanel } from "@/components/cyberdeck/espionage-mirage-hub-panel";
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
  readSpyMiragePairCredentials,
  saveSpyMiragePairCredentials,
} from "@/lib/cyberdeck/spy-pairing-client";

export function SpyMiragePane() {
  const { paired, terminated, terminatedMessage, resetLinkWatch } = useSpyEchoLinkWatch("mirage");
  const [status, setStatus] = useState<string | null>(null);

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
        Enter the 6-digit code from {ESPIONAGE_ECHO_DISPLAY} (CODE FOR {ESPIONAGE_MIRAGE_DISPLAY}). Mirage
        finds Echo on your LAN automatically — no IP typing needed unless auto-detect fails.
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

      <div className="border-t border-[#1c1c1c] pt-4">
        <EspionageMirageHubPanel
          echoHost={paired?.echoHost ?? readSpyMiragePairCredentials()?.echoHost ?? null}
          echoHttpPort={paired?.httpPort ?? readSpyMiragePairCredentials()?.httpPort ?? null}
        />
      </div>
    </div>
  );
}
