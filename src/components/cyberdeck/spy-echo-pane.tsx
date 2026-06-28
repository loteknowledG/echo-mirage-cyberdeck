"use client";

import { useCallback, useEffect, useState } from "react";
import { CyberdeckActionButton } from "@/components/cyberdeck/cyberdeck-control-button";
import {
  ESPIONAGE_ECHO_DISPLAY,
  ESPIONAGE_ECHO_TAGLINE,
  ESPIONAGE_MIRAGE_DISPLAY,
  ESPIONAGE_MODE_TITLE,
  ESPIONAGE_POWERFIST_LABEL,
} from "@/lib/cyberdeck/espionage-mode";
import { startStealthCaptureDeck } from "@/lib/cyberdeck/espionage-stealth-capture-deck";
import {
  fetchEchoSpyCodes,
  formatCodeExpiry,
  regenerateEchoSpyCodes,
} from "@/lib/cyberdeck/spy-pairing-client";
import { readPowerfistCaptureCredentials } from "@/lib/cyberdeck/powerfist-capture-client";

function PairCodeBlock({
  label,
  code,
  expiresAt,
}: {
  label: string;
  code: string | null;
  expiresAt: string | null;
}) {
  if (!code) {
    return (
      <div className="rounded border border-[#1c1c1c] bg-black/50 p-3">
        <p className="mb-1 text-[9px] tracking-[0.08em] text-[#8a8a8a]">{label}</p>
        <p className="text-[9px] text-[#5f5f5f]">No active code — regenerate.</p>
      </div>
    );
  }

  return (
    <div className="rounded border border-[#1c1c1c] bg-black/50 p-3">
      <p className="mb-2 text-[9px] tracking-[0.08em] text-[#8a8a8a]">
        {label} · expires in {formatCodeExpiry(expiresAt)}
      </p>
      <p className="break-all font-mono text-[11px] leading-relaxed tracking-[0.04em] text-cyan-200/90">
        {code}
      </p>
      <p className="mt-2 text-[8px] leading-relaxed text-[#5f5f5f]">
        Paste this on the {label.includes("MIRAGE") ? ESPIONAGE_MIRAGE_DISPLAY : ESPIONAGE_POWERFIST_LABEL}{" "}
        device Spy tab.
      </p>
    </div>
  );
}

export function SpyEchoPane() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [echoHost, setEchoHost] = useState<string | null>(null);
  const [mirageCode, setMirageCode] = useState<string | null>(null);
  const [powerfistCode, setPowerfistCode] = useState<string | null>(null);
  const [mirageExpiresAt, setMirageExpiresAt] = useState<string | null>(null);
  const [powerfistExpiresAt, setPowerfistExpiresAt] = useState<string | null>(null);
  const [pairedMirage, setPairedMirage] = useState<{ nodeId: string } | null>(null);
  const [pairedPowerfist, setPairedPowerfist] = useState<{ deviceId: string } | null>(null);
  const [notEchoMachine, setNotEchoMachine] = useState(false);
  const [captureRelayActive, setCaptureRelayActive] = useState(() => Boolean(readPowerfistCaptureCredentials()));
  const [relayBusy, setRelayBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    const status = await fetchEchoSpyCodes();
    setLoading(false);
    if (!status.ok) {
      setNotEchoMachine(true);
      setError(status.reason);
      return;
    }
    setNotEchoMachine(false);
    setEchoHost(status.echoHost);
    setMirageCode(status.mirageCode);
    setPowerfistCode(status.powerfistCode);
    setMirageExpiresAt(status.mirageExpiresAt);
    setPowerfistExpiresAt(status.powerfistExpiresAt);
    setPairedMirage(status.pairedMirage);
    setPairedPowerfist(status.pairedPowerfist);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleRegenerate = useCallback(async () => {
    setBusy(true);
    setError(null);
    const status = await regenerateEchoSpyCodes();
    setBusy(false);
    if (!status.ok) {
      setError(status.reason);
      return;
    }
    setMirageCode(status.mirageCode);
    setPowerfistCode(status.powerfistCode);
    setMirageExpiresAt(status.mirageExpiresAt);
    setPowerfistExpiresAt(status.powerfistExpiresAt);
    setPairedMirage(status.pairedMirage);
    setPairedPowerfist(status.pairedPowerfist);
  }, []);

  const handleActivateCaptureRelay = useCallback(async () => {
    setRelayBusy(true);
    const handle = await startStealthCaptureDeck();
    setRelayBusy(false);
    setCaptureRelayActive(Boolean(handle));
    if (!handle) {
      setError("Capture relay not active — scan Mirage Echo QR on this machine first.");
    } else {
      setError(null);
    }
  }, []);

  if (notEchoMachine) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-6 font-mono text-[10px] tracking-[0.08em] text-[#8a8a8a]">
        <p className="max-w-md text-center leading-relaxed">
          {ESPIONAGE_ECHO_DISPLAY} pairing codes are shown on the screenshot computer. Open Spy →{" "}
          {ESPIONAGE_ECHO_DISPLAY} on the machine that captures the screen.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-4 font-mono text-[10px] tracking-[0.04em] text-[#707070]">
      <div>
        <p className="text-cyan-300/90">{ESPIONAGE_MODE_TITLE} // {ESPIONAGE_ECHO_DISPLAY}</p>
        <p className="mt-1 text-[9px] text-[#6a8a8a]">{ESPIONAGE_ECHO_TAGLINE}</p>
        {echoHost ? (
          <p className="mt-2 text-[9px] text-[#5f5f5f]">Echo on LAN · {echoHost}</p>
        ) : null}
      </div>

      {loading ? (
        <p className="text-[#8a8a8a]">Loading pairing codes…</p>
      ) : (
        <>
          <PairCodeBlock
            label={`CODE FOR ${ESPIONAGE_MIRAGE_DISPLAY}`}
            code={mirageCode}
            expiresAt={mirageExpiresAt}
          />
          <PairCodeBlock
            label={`CODE FOR ${ESPIONAGE_POWERFIST_LABEL}`}
            code={powerfistCode}
            expiresAt={powerfistExpiresAt}
          />

          {pairedMirage ? (
            <p className="text-emerald-300/80">
              PAIRED // {ESPIONAGE_MIRAGE_DISPLAY} {pairedMirage.nodeId.slice(0, 8)}…
            </p>
          ) : null}
          {pairedPowerfist ? (
            <p className="text-emerald-300/80">
              PAIRED // {ESPIONAGE_POWERFIST_LABEL} {pairedPowerfist.deviceId.slice(0, 8)}…
            </p>
          ) : null}

          <CyberdeckActionButton disabled={busy} onClick={() => void handleRegenerate()}>
            New codes
          </CyberdeckActionButton>

          <div className="rounded border border-[#1c1c1c] bg-black/50 p-3">
            <p className="mb-2 text-[9px] tracking-[0.08em] text-[#8a8a8a]">Silent capture relay</p>
            <p className="mb-3 text-[8px] leading-relaxed text-[#5f5f5f]">
              After Mirage shows an Echo QR, scan it on this machine (or open the link). Then activate
              the relay — it runs hidden in the desktop app tray.
            </p>
            {captureRelayActive ? (
              <p className="mb-2 text-emerald-300/80">RELAY ACTIVE // silent capture armed</p>
            ) : (
              <p className="mb-2 text-[#8a8a8a]">Relay not active.</p>
            )}
            <CyberdeckActionButton disabled={relayBusy} onClick={() => void handleActivateCaptureRelay()}>
              Activate capture relay
            </CyberdeckActionButton>
          </div>
        </>
      )}

      {error ? <p className="text-red-300/90">{error}</p> : null}
    </div>
  );
}
