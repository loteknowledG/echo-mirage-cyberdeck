"use client";

import { useCallback, useState } from "react";
import { CyberdeckActionButton } from "@/components/cyberdeck/cyberdeck-control-button";
import {
  ECHO_SPY_TERMINATED_MESSAGE,
  ESPIONAGE_ECHO_DISPLAY,
  ESPIONAGE_MODE_TITLE,
  ESPIONAGE_POWERFIST_LABEL,
  ESPIONAGE_POWERFIST_TAGLINE,
} from "@/lib/cyberdeck/espionage-mode";
import { useSpyEchoLinkWatch } from "@/lib/cyberdeck/spy-echo-link-watch";
import {
  enterSpyPairCode,
  saveSpyPowerfistPairCredentials,
} from "@/lib/cyberdeck/spy-pairing-client";

export function SpyPowerfistPane() {
  const { paired, terminated, terminatedMessage, resetLinkWatch } = useSpyEchoLinkWatch("powerfist");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const handlePair = useCallback(async () => {
    const trimmed = code.trim();
    if (!trimmed) {
      setError("Paste the PowerFist pairing code from Echo.");
      return;
    }
    if (!trimmed.endsWith(":P")) {
      setError(`Use the ${ESPIONAGE_POWERFIST_LABEL} code from Echo (ends with :P).`);
      return;
    }

    setBusy(true);
    setError(null);
    setStatus(null);

    const result = await enterSpyPairCode(trimmed);
    setBusy(false);

    if (!result.ok) {
      setError(result.reason);
      return;
    }

    if (result.role !== "powerfist") {
      setError("That code is for Mirage, not PowerFist.");
      return;
    }

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
    setCode("");
    setStatus(`Paired with ${ESPIONAGE_ECHO_DISPLAY} at ${result.echoHost}.`);
  }, [code, resetLinkWatch]);

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
        On your phone: paste the code from {ESPIONAGE_ECHO_DISPLAY} Spy → {ESPIONAGE_ECHO_DISPLAY} (CODE FOR{" "}
        {ESPIONAGE_POWERFIST_LABEL}).
      </p>

      {paired && !terminated ? (
        <p className="text-emerald-300/80">
          LINKED // {ESPIONAGE_ECHO_DISPLAY} {paired.echoHost} · device {paired.deviceId.slice(0, 8)}…
        </p>
      ) : !terminated ? (
        <p className="text-[#8a8a8a]">Not paired with {ESPIONAGE_ECHO_DISPLAY}.</p>
      ) : null}

      <label className="flex flex-col gap-2">
        <span className="text-[9px] tracking-[0.08em] text-[#8a8a8a]">Echo pairing code</span>
        <textarea
          value={code}
          onChange={(event) => setCode(event.target.value)}
          rows={3}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          placeholder="192.168.x.x:3050:12345:secret:P"
          className="min-h-[4rem] resize-y border border-[#2d2d2d] bg-black px-2 py-2 font-mono text-[10px] tracking-[0.04em] text-[#cfcfcf] outline-none focus:border-amber-900/60"
        />
      </label>

      <CyberdeckActionButton disabled={busy} onClick={() => void handlePair()}>
        {terminated ? `Re-pair with ${ESPIONAGE_ECHO_DISPLAY}` : `Pair with ${ESPIONAGE_ECHO_DISPLAY}`}
      </CyberdeckActionButton>

      {status ? <p className="text-emerald-300/80">{status}</p> : null}
      {error ? <p className="text-red-300/90">{error}</p> : null}
    </div>
  );
}
