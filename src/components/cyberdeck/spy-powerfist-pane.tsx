"use client";

import { useCallback, useState } from "react";
import { SpyPairPinForm } from "@/components/cyberdeck/spy-pair-pin-form";
import {
  ECHO_SPY_TERMINATED_MESSAGE,
  ESPIONAGE_ECHO_DISPLAY,
  ESPIONAGE_MODE_TITLE,
  ESPIONAGE_POWERFIST_LABEL,
  ESPIONAGE_POWERFIST_TAGLINE,
} from "@/lib/cyberdeck/espionage-mode";
import { useSpyEchoLinkWatch } from "@/lib/cyberdeck/spy-echo-link-watch";
import { saveSpyPowerfistPairCredentials } from "@/lib/cyberdeck/spy-pairing-client";

export function SpyPowerfistPane() {
  const { paired, terminated, terminatedMessage, resetLinkWatch } = useSpyEchoLinkWatch("powerfist");
  const [status, setStatus] = useState<string | null>(null);

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
      saveSpyPowerfistPairCredentials(creds);
      resetLinkWatch();
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
        <p className="text-amber-200/90">{ESPIONAGE_MODE_TITLE} // {ESPIONAGE_POWERFIST_LABEL}</p>
        <p className="mt-1 text-[9px] text-[#6a6a8a]">{ESPIONAGE_POWERFIST_TAGLINE}</p>
      </div>

      <p className="text-[9px] leading-relaxed text-[#5f5f5f]">
        On your phone: enter the Echo LAN address and 6-digit code from {ESPIONAGE_ECHO_DISPLAY} Spy →{" "}
        {ESPIONAGE_ECHO_DISPLAY} (CODE FOR {ESPIONAGE_POWERFIST_LABEL}).
      </p>

      {paired && !terminated ? (
        <p className="text-emerald-300/80">
          LINKED // {ESPIONAGE_ECHO_DISPLAY} {paired.echoHost} · device {paired.deviceId.slice(0, 8)}…
        </p>
      ) : !terminated ? (
        <p className="text-[#8a8a8a]">Not paired with {ESPIONAGE_ECHO_DISPLAY}.</p>
      ) : null}

      <SpyPairPinForm
        role="powerfist"
        roleLabel={ESPIONAGE_POWERFIST_LABEL}
        focusClassName="focus:border-amber-900/60"
        buttonLabel={
          terminated ? `Re-pair with ${ESPIONAGE_ECHO_DISPLAY}` : `Pair with ${ESPIONAGE_ECHO_DISPLAY}`
        }
        onPaired={handlePaired}
      />

      {status ? <p className="text-emerald-300/80">{status}</p> : null}
    </div>
  );
}
