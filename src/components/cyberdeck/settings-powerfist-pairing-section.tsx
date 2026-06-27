"use client";

import { useCallback, useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { CyberdeckActionButton } from "@/components/cyberdeck/cyberdeck-control-button";
import {
  ESPIONAGE_ECHO_DISPLAY,
  ESPIONAGE_ECHO_TAGLINE,
  ESPIONAGE_MIRAGE_DISPLAY,
  ESPIONAGE_MIRAGE_TAGLINE,
  ESPIONAGE_MODE_TITLE,
  ESPIONAGE_POWERFIST_LABEL,
  ESPIONAGE_POWERFIST_TAGLINE,
  espionageRoleLabel,
  espionageTeamSummary,
  readEspionageNodeRole,
  writeEspionageNodeRole,
  type EspionageNodeRole,
  getOrCreateEspionageNodeId,
} from "@/lib/cyberdeck/espionage-mode";
import {
  createPowerfistCaptureQrSession,
  createPowerfistQrSession,
  fetchPowerfistQrSession,
  unpairPowerfistCapture,
  unpairPowerfistRemote,
} from "@/lib/cyberdeck/powerfist-remote-socket";

function formatExpiry(expiresAt: string | null): string {
  if (!expiresAt) return "—";
  const ms = Date.parse(expiresAt) - Date.now();
  if (ms <= 0) return "Expired";
  const minutes = Math.ceil(ms / 60_000);
  return `${minutes} min`;
}

function RoleBadge({ role }: { role: EspionageNodeRole }) {
  const tone =
    role === "echo"
      ? "text-cyan-300/90"
      : role === "mirage"
        ? "text-fuchsia-300/90"
        : "text-[#8a8a8a]";
  return (
    <span className={`font-mono text-[11px] tracking-[0.12em] ${tone}`}>
      {ESPIONAGE_MODE_TITLE} // {espionageRoleLabel(role)}
    </span>
  );
}

export function SettingsPowerfistPairingSection() {
  const [role, setRole] = useState<EspionageNodeRole>("off");
  const [nodeId, setNodeId] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [capturePairUrl, setCapturePairUrl] = useState<string | null>(null);
  const [captureExpiresAt, setCaptureExpiresAt] = useState<string | null>(null);
  const [pairedDeviceId, setPairedDeviceId] = useState<string | null>(null);
  const [pairedEchoNodeId, setPairedEchoNodeId] = useState<string | null>(null);
  const [mirageNodeId, setMirageNodeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRole(readEspionageNodeRole());
    setNodeId(getOrCreateEspionageNodeId());
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    const session = await fetchPowerfistQrSession();
    if (!session.ok) {
      setError("reason" in session ? session.reason : "Could not load Espionage pairing.");
      setPreviewUrl(null);
      setExpiresAt(null);
      setCapturePairUrl(null);
      setCaptureExpiresAt(null);
      setPairedDeviceId(null);
      setPairedEchoNodeId(null);
      setMirageNodeId(null);
      setLoading(false);
      return;
    }
    setPreviewUrl(session.previewUrl);
    setExpiresAt(session.expiresAt);
    setCapturePairUrl(session.capturePairUrl ?? null);
    setCaptureExpiresAt(session.captureExpiresAt ?? null);
    setPairedDeviceId(session.pairedRemote?.deviceId ?? null);
    setPairedEchoNodeId(session.pairedCapture?.nodeId ?? null);
    setMirageNodeId(session.mirageNode?.nodeId ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleRoleChange = useCallback((next: EspionageNodeRole) => {
    writeEspionageNodeRole(next);
    setRole(next);
  }, []);

  const handleGeneratePhoneQr = useCallback(async () => {
    setBusy(true);
    setError(null);
    const session = await createPowerfistQrSession();
    setBusy(false);
    if (!session.ok) {
      setError(session.reason);
      return;
    }
    setPreviewUrl(session.previewUrl);
    setExpiresAt(session.expiresAt);
    setPairedDeviceId(session.pairedRemote?.deviceId ?? null);
  }, []);

  const handleGenerateEchoQr = useCallback(async () => {
    setBusy(true);
    setError(null);
    const session = await createPowerfistCaptureQrSession();
    setBusy(false);
    if (!session.ok) {
      setError(session.reason);
      return;
    }
    setCapturePairUrl(session.capturePairUrl);
    setCaptureExpiresAt(session.expiresAt);
    setPairedEchoNodeId(session.pairedCapture?.nodeId ?? null);
    void refresh();
  }, [refresh]);

  const handleUnpairPhone = useCallback(async () => {
    setBusy(true);
    setError(null);
    const ok = await unpairPowerfistRemote();
    setBusy(false);
    if (!ok) {
      setError("Could not unpair PowerFist phone.");
      return;
    }
    setPairedDeviceId(null);
    setPreviewUrl(null);
    setExpiresAt(null);
  }, []);

  const handleUnpairEcho = useCallback(async () => {
    setBusy(true);
    setError(null);
    const ok = await unpairPowerfistCapture();
    setBusy(false);
    if (!ok) {
      setError("Could not unpair Echo.");
      return;
    }
    setPairedEchoNodeId(null);
    setCapturePairUrl(null);
    setCaptureExpiresAt(null);
  }, []);

  return (
    <section className="flex flex-col gap-2" data-testid="settings-espionage-mode">
      <RoleBadge role={role} />
      <div className="rounded-sm border border-[#1c1c1c] bg-black/75 p-3 font-mono text-[10px] leading-relaxed tracking-[0.04em] text-[#707070]">
        <p className="mb-3 text-[9px] leading-relaxed tracking-[0.04em] text-[#5f5f5f]">
          {espionageTeamSummary(role)}
        </p>

        <div className="mb-4 flex flex-wrap gap-2">
          <CyberdeckActionButton
            disabled={busy}
            onClick={() => handleRoleChange("mirage")}
            className={role === "mirage" ? "ring-1 ring-fuchsia-400/40" : undefined}
          >
            This is {ESPIONAGE_MIRAGE_DISPLAY}
          </CyberdeckActionButton>
          <CyberdeckActionButton
            disabled={busy}
            onClick={() => handleRoleChange("echo")}
            className={role === "echo" ? "ring-1 ring-cyan-400/40" : undefined}
          >
            This is {ESPIONAGE_ECHO_DISPLAY}
          </CyberdeckActionButton>
          {role !== "off" ? (
            <CyberdeckActionButton disabled={busy} onClick={() => handleRoleChange("off")}>
              Espionage off
            </CyberdeckActionButton>
          ) : null}
        </div>

        {role === "echo" ? (
          <div className="mb-4 rounded border border-cyan-900/40 bg-cyan-950/20 p-3">
            <p className="mb-2 text-cyan-300/90">{ESPIONAGE_ECHO_DISPLAY} // node {nodeId.slice(0, 8)}…</p>
            <p className="text-[9px] text-[#6a8a8a]">{ESPIONAGE_ECHO_TAGLINE}</p>
            <p className="mt-2 text-[9px] text-[#6a8a8a]">
              On this machine: open the Echo QR from {ESPIONAGE_MIRAGE_DISPLAY} (
              <span className="text-[#8a8a8a]">/powerfist/capture-pair</span>
              ). Enable Silent Mode in the Electron tray for stealth capture.
            </p>
          </div>
        ) : null}

        {role === "mirage" ? (
          <>
            <p className="mb-2 text-fuchsia-300/80">
              {ESPIONAGE_MIRAGE_DISPLAY} hub // node {(mirageNodeId ?? nodeId).slice(0, 8)}…
            </p>
            <p className="mb-4 text-[9px] text-[#6a6a8a]">{ESPIONAGE_MIRAGE_TAGLINE}</p>

            {loading ? (
              <p className="text-[#8a8a8a]">Loading relay…</p>
            ) : (
              <>
                <div className="mb-4 border-b border-[#1c1c1c] pb-4">
                  <div className="mb-2 font-mono text-[10px] tracking-[0.06em] text-[#8a8a8a]">
                    {ESPIONAGE_POWERFIST_LABEL} // phone
                  </div>
                  <p className="mb-3 text-[9px] text-[#5f5f5f]">{ESPIONAGE_POWERFIST_TAGLINE}</p>
                  {pairedDeviceId ? (
                    <p className="mb-3 text-emerald-300/90">
                      PAIRED // PowerFist {pairedDeviceId.slice(0, 8)}…
                    </p>
                  ) : (
                    <p className="mb-3 text-[#8a8a8a]">No phone paired.</p>
                  )}
                  {previewUrl ? (
                    <div className="mb-3 flex flex-col items-center gap-2 rounded border border-[#2d2d2d] bg-white p-3">
                      <QRCodeSVG value={previewUrl} size={160} level="M" includeMargin />
                      <p className="text-[8px] text-[#333]">Expires in {formatExpiry(expiresAt)}</p>
                    </div>
                  ) : (
                    <p className="mb-3 text-[#8a8a8a]">Generate QR for PowerFist on phone.</p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <CyberdeckActionButton disabled={busy} onClick={() => void handleGeneratePhoneQr()}>
                      {previewUrl ? "New PowerFist QR" : "PowerFist QR"}
                    </CyberdeckActionButton>
                    {pairedDeviceId ? (
                      <CyberdeckActionButton disabled={busy} onClick={() => void handleUnpairPhone()}>
                        Unpair phone
                      </CyberdeckActionButton>
                    ) : null}
                  </div>
                </div>

                <div>
                  <div className="mb-2 font-mono text-[10px] tracking-[0.06em] text-[#8a8a8a]">
                    {ESPIONAGE_ECHO_DISPLAY} // screenshot computer
                  </div>
                  <p className="mb-3 text-[9px] text-[#5f5f5f]">{ESPIONAGE_ECHO_TAGLINE}</p>
                  {pairedEchoNodeId ? (
                    <p className="mb-3 text-emerald-300/90">
                      PAIRED // {ESPIONAGE_ECHO_DISPLAY} {pairedEchoNodeId.slice(0, 8)}…
                    </p>
                  ) : (
                    <p className="mb-3 text-[#8a8a8a]">Echo not paired.</p>
                  )}
                  {capturePairUrl ? (
                    <div className="mb-3 flex flex-col items-center gap-2 rounded border border-cyan-900/30 bg-white p-3">
                      <QRCodeSVG value={capturePairUrl} size={160} level="M" includeMargin />
                      <p className="max-w-full break-all text-center text-[8px] text-[#333]">
                        Scan on {ESPIONAGE_ECHO_DISPLAY} · expires in {formatExpiry(captureExpiresAt)}
                      </p>
                    </div>
                  ) : (
                    <p className="mb-3 text-[#8a8a8a]">Generate QR for the screenshot computer.</p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <CyberdeckActionButton disabled={busy} onClick={() => void handleGenerateEchoQr()}>
                      {capturePairUrl ? "New Echo QR" : "Echo QR"}
                    </CyberdeckActionButton>
                    {pairedEchoNodeId ? (
                      <CyberdeckActionButton disabled={busy} onClick={() => void handleUnpairEcho()}>
                        Unpair Echo
                      </CyberdeckActionButton>
                    ) : null}
                  </div>
                </div>
              </>
            )}
          </>
        ) : null}

        {error ? <p className="mt-3 text-red-300/90">{error}</p> : null}
      </div>
    </section>
  );
}
