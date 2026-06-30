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
  fetchEchoSpyStatus,
  formatCodeExpiry,
  normalizePairedMirages,
  regenerateEchoSpyCodes,
} from "@/lib/cyberdeck/spy-pairing-client";
import { SATELLITE_GITHUB_RELEASES_URL } from "@/lib/electron/desktop-install.client";
import { readPowerfistCaptureCredentials } from "@/lib/cyberdeck/powerfist-capture-client";

function PairPinBlock({
  label,
  pin,
  expiresAt,
}: {
  label: string;
  pin: string | null;
  expiresAt: string | null;
}) {
  if (!pin) {
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
      <p className="font-mono text-2xl tracking-[0.35em] text-cyan-200/90">{pin}</p>
      <p className="mt-2 text-[8px] leading-relaxed text-[#5f5f5f]">
        Type this 6-digit code on the {label.includes("MIRAGE") ? ESPIONAGE_MIRAGE_DISPLAY : ESPIONAGE_POWERFIST_LABEL}{" "}
        device Spy tab. Mirage finds Echo on Wi‑Fi automatically — no IP needed.
      </p>
    </div>
  );
}

export function SpyEchoPane() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [echoHost, setEchoHost] = useState<string | null>(null);
  const [httpPort, setHttpPort] = useState<number | null>(null);
  const [miragePin, setMiragePin] = useState<string | null>(null);
  const [powerfistPin, setPowerfistPin] = useState<string | null>(null);
  const [mirageExpiresAt, setMirageExpiresAt] = useState<string | null>(null);
  const [powerfistExpiresAt, setPowerfistExpiresAt] = useState<string | null>(null);
  const [pairedMirages, setPairedMirages] = useState<{ nodeId: string }[]>([]);
  const [pairedPowerfist, setPairedPowerfist] = useState<{ deviceId: string } | null>(null);
  const [statusSource, setStatusSource] = useState<"cyberdeck" | "local-cyberdeck" | "satellite" | null>(null);
  const [satelliteArmed, setSatelliteArmed] = useState<boolean | null>(null);
  const [satelliteWsStatus, setSatelliteWsStatus] = useState<string | null>(null);
  const [captureMirage, setCaptureMirage] = useState<{ host: string; port: number } | null>(null);
  const [notEchoMachine, setNotEchoMachine] = useState(false);
  const [captureRelayActive, setCaptureRelayActive] = useState(() => Boolean(readPowerfistCaptureCredentials()));
  const [relayBusy, setRelayBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    const status = await fetchEchoSpyStatus();
    setLoading(false);
    if (!status.ok) {
      setNotEchoMachine(true);
      setStatusSource(null);
      setError(status.reason);
      return;
    }
    setNotEchoMachine(false);
    setStatusSource(status.source);
    setEchoHost(status.echoHost);
    setHttpPort(status.httpPort);
    setMiragePin(status.miragePin);
    setPowerfistPin(status.powerfistPin);
    setMirageExpiresAt(status.mirageExpiresAt);
    setPowerfistExpiresAt(status.powerfistExpiresAt);
    setPairedMirages(normalizePairedMirages(status));
    setPairedPowerfist(status.pairedPowerfist);
    setSatelliteArmed(status.armed ?? null);
    setSatelliteWsStatus(status.wsStatus ?? null);
    setCaptureMirage(status.captureMirage ?? null);
  }, []);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => void refresh(), 5000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  const handleRefreshStatus = useCallback(async () => {
    setBusy(true);
    await refresh();
    setBusy(false);
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
    setMiragePin(status.miragePin);
    setPowerfistPin(status.powerfistPin);
    setMirageExpiresAt(status.mirageExpiresAt);
    setPowerfistExpiresAt(status.powerfistExpiresAt);
    setPairedMirages(normalizePairedMirages(status));
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
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-6 font-mono text-[10px] tracking-[0.08em] text-[#8a8a8a]">
        <p className="max-w-md leading-relaxed">
          This browser tab is the <strong className="text-[#9a9a9a]">hosted cyberdeck</strong>, not the Echo
          screenshot machine. Pairing codes and linked Mirages for {ESPIONAGE_ECHO_DISPLAY} live on the Mac
          running Echo Satellite.
        </p>
        <p className="max-w-md leading-relaxed">
          On the Echo Mac: install or update{" "}
          <a
            href={SATELLITE_GITHUB_RELEASES_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-cyan-300/90 underline-offset-2 hover:underline"
          >
            Echo Satellite
          </a>{" "}
          from GitHub, open it from the Dock (Status → Linked Mirages), or open the{" "}
          <strong className="text-[#9a9a9a]">local cyberdeck</strong> at{" "}
          <code className="text-[#bdbdbd]">http://127.0.0.1:3000</code>. Use{" "}
          <strong className="text-[#9a9a9a]">TEAM LINKS</strong> above after Mirage/PowerFist pair.
        </p>
        {error ? <p className="text-red-300/90">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-4 font-mono text-[10px] tracking-[0.04em] text-[#707070]">
      <div>
        <p className="text-cyan-300/90">{ESPIONAGE_MODE_TITLE} // {ESPIONAGE_ECHO_DISPLAY}</p>
        <p className="mt-1 text-[9px] text-[#6a8a8a]">{ESPIONAGE_ECHO_TAGLINE}</p>
        {echoHost ? (
          <p className="mt-2 text-[9px] text-[#5f5f5f]">
            Echo on LAN · {echoHost}
            {httpPort ? `:${httpPort}` : null}
            {statusSource === "satellite" ? " · via Echo Satellite" : null}
          </p>
        ) : null}
      </div>

      {statusSource === "satellite" ? (
        <p className="rounded border border-cyan-950/40 bg-cyan-950/10 px-3 py-2 text-[8px] leading-relaxed text-[#7a9a9a]">
          Reading from Echo Satellite on this Mac. PIN codes also appear in the Satellite window under{" "}
          <strong className="text-[#9a9a9a]">Spy pairing codes</strong>.
        </p>
      ) : null}

      {loading ? (
        <p className="text-[#8a8a8a]">Loading pairing codes…</p>
      ) : (
        <>
          {miragePin || powerfistPin ? (
            <>
              <PairPinBlock
                label={`CODE FOR ${ESPIONAGE_MIRAGE_DISPLAY}`}
                pin={miragePin}
                expiresAt={mirageExpiresAt}
              />
              <PairPinBlock
                label={`CODE FOR ${ESPIONAGE_POWERFIST_LABEL}`}
                pin={powerfistPin}
                expiresAt={powerfistExpiresAt}
              />
            </>
          ) : statusSource === "satellite" ? (
            <p className="text-[9px] text-[#8a8a8a]">
              No active PIN codes — open Echo Satellite or tap New codes below.
            </p>
          ) : null}

          {pairedMirages.length > 0 ? (
            <ul className="space-y-1">
              {pairedMirages.map((mirage) => (
                <li key={mirage.nodeId} className="text-emerald-300/80">
                  LINKED // {ESPIONAGE_MIRAGE_DISPLAY} {mirage.nodeId.slice(0, 8)}…
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[#8a8a8a]">No Mirage linked yet.</p>
          )}
          {captureMirage ? (
            <p className="text-emerald-300/80">
              CAPTURE RELAY // {captureMirage.host}:{captureMirage.port}
              {satelliteArmed ? " · ARMED" : " · disarmed"}
              {satelliteWsStatus ? ` · WS ${satelliteWsStatus.toUpperCase()}` : null}
            </p>
          ) : null}
          {pairedPowerfist ? (
            <p className="text-emerald-300/80">
              PAIRED // {ESPIONAGE_POWERFIST_LABEL} {pairedPowerfist.deviceId.slice(0, 8)}…
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <CyberdeckActionButton disabled={busy} onClick={() => void handleRefreshStatus()}>
              Refresh status
            </CyberdeckActionButton>
            <CyberdeckActionButton disabled={busy} onClick={() => void handleRegenerate()}>
              New codes
            </CyberdeckActionButton>
          </div>

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
