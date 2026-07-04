"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { CyberdeckActionButton } from "@/components/cyberdeck/cyberdeck-control-button";
import { SurveyPairPinDisplay } from "@/components/cyberdeck/survey-pair-pin-display";
import {
  SURVEY_ECHO_DISPLAY,
  SURVEY_ECHO_TAGLINE,
  SURVEY_MIRAGE_DISPLAY,
  SURVEY_MIRAGE_TAGLINE,
  SURVEY_POWERFIST_LABEL,
  SURVEY_POWERFIST_TAGLINE,
  getOrCreateSurveyNodeId,
} from "@/lib/cyberdeck/survey-mode";
import {
  formatSurveyMiragePowerfistLinkedLine,
  notifySurveyMuthurArchive,
} from "@/lib/cyberdeck/survey-chat";
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

/** Mirage hub — PowerFist + Echo pairing QRs (Survey tab or Settings). */
export function SurveyMirageHubPanel(props: {
  echoHost: string | null;
  echoHttpPort: number | null;
}) {
  const [nodeId, setNodeId] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [remotePin, setRemotePin] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [capturePairUrl, setCapturePairUrl] = useState<string | null>(null);
  const [captureExpiresAt, setCaptureExpiresAt] = useState<string | null>(null);
  const [pairedDeviceId, setPairedDeviceId] = useState<string | null>(null);
  const [pairedEchoNodeId, setPairedEchoNodeId] = useState<string | null>(null);
  const [mirageNodeId, setMirageNodeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const prevPairedDeviceRef = useRef<string | null>(null);
  const announcedPinRef = useRef<string | null>(null);

  const announceHubPin = useCallback((pin: string) => {
    if (!pin || announcedPinRef.current === pin) return;
    announcedPinRef.current = pin;
    notifySurveyMuthurArchive(
      `SURVEY // ${SURVEY_MIRAGE_DISPLAY} hub PowerFist code: ${pin} — enter on Survey → ${SURVEY_POWERFIST_LABEL} tab (TRIPLE LINK). Not an Echo Satellite code.`,
    );
  }, []);

  const applyPhoneSession = useCallback(
    (session: {
      previewUrl: string | null;
      remotePin?: string | null;
      expiresAt: string | null;
      pairedRemote?: { deviceId: string; pairedAt: string } | null;
    }) => {
      setPreviewUrl(session.previewUrl);
      setRemotePin(session.remotePin ?? null);
      setExpiresAt(session.expiresAt);
      setPairedDeviceId(session.pairedRemote?.deviceId ?? null);
      if (session.remotePin) announceHubPin(session.remotePin);
    },
    [announceHubPin],
  );

  useEffect(() => {
    if (!pairedDeviceId || pairedDeviceId === prevPairedDeviceRef.current) return;
    prevPairedDeviceRef.current = pairedDeviceId;
    notifySurveyMuthurArchive(formatSurveyMiragePowerfistLinkedLine(pairedDeviceId));
  }, [pairedDeviceId]);

  useEffect(() => {
    setNodeId(getOrCreateSurveyNodeId());
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    let session = await fetchPowerfistQrSession();
    if (!session.ok) {
      setError("reason" in session ? session.reason : "Could not load Survey pairing.");
      setPreviewUrl(null);
      setRemotePin(null);
      setExpiresAt(null);
      setCapturePairUrl(null);
      setCaptureExpiresAt(null);
      setPairedDeviceId(null);
      setPairedEchoNodeId(null);
      setMirageNodeId(null);
      setLoading(false);
      return;
    }

    if (!session.remotePin && !session.pairedRemote) {
      const created = await createPowerfistQrSession();
      if (created.ok) {
        session = {
          ...session,
          previewUrl: created.previewUrl,
          remotePin: created.remotePin,
          expiresAt: created.expiresAt,
          pairedRemote: created.pairedRemote,
        };
      } else if (!session.previewUrl) {
        setError(created.reason);
      }
    }

    applyPhoneSession(session);
    setCapturePairUrl(session.capturePairUrl ?? null);
    setCaptureExpiresAt(session.captureExpiresAt ?? null);
    setPairedEchoNodeId(session.pairedCapture?.nodeId ?? null);
    setMirageNodeId(session.mirageNode?.nodeId ?? null);
    setLoading(false);
  }, [applyPhoneSession]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleGeneratePhoneQr = useCallback(async () => {
    setBusy(true);
    setError(null);
    const session = await createPowerfistQrSession();
    setBusy(false);
    if (!session.ok) {
      setError(session.reason);
      return;
    }
    applyPhoneSession(session);
  }, [applyPhoneSession]);

  const handleGenerateEchoQr = useCallback(async () => {
    if (!props.echoHost || !props.echoHttpPort) {
      setError(`Pair ${SURVEY_MIRAGE_DISPLAY} with ${SURVEY_ECHO_DISPLAY} first (paste :M code).`);
      return;
    }
    setBusy(true);
    setError(null);
    const session = await createPowerfistCaptureQrSession({
      echoHost: props.echoHost,
      echoHttpPort: props.echoHttpPort,
    });
    setBusy(false);
    if (!session.ok) {
      setError(session.reason);
      return;
    }
    setCapturePairUrl(session.capturePairUrl);
    setCaptureExpiresAt(session.expiresAt);
    setPairedEchoNodeId(session.pairedCapture?.nodeId ?? null);
    void refresh();
  }, [props.echoHost, props.echoHttpPort, refresh]);

  const handleUnpairPhone = useCallback(async () => {
    setBusy(true);
    const ok = await unpairPowerfistRemote();
    setBusy(false);
    if (!ok) {
      setError("Could not unpair PowerFist phone.");
      return;
    }
    setPairedDeviceId(null);
    setPreviewUrl(null);
    setRemotePin(null);
    setExpiresAt(null);
  }, []);

  const handleUnpairEcho = useCallback(async () => {
    setBusy(true);
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
    <div className="flex flex-col gap-4 font-mono text-[10px] tracking-[0.04em] text-[#707070]">
      <p className="text-fuchsia-300/80">
        {SURVEY_MIRAGE_DISPLAY} hub // node {(mirageNodeId ?? nodeId).slice(0, 8)}…
      </p>
      <p className="text-[9px] text-[#6a6a8a]">{SURVEY_MIRAGE_TAGLINE}</p>

      {loading ? <p className="text-[#8a8a8a]">Loading relay…</p> : null}

      <div className="border-b border-[#1c1c1c] pb-4">
        <div className="mb-2 text-[10px] tracking-[0.06em] text-[#8a8a8a]">
          {SURVEY_POWERFIST_LABEL} // phone
        </div>
        <p className="mb-3 text-[9px] text-[#5f5f5f]">{SURVEY_POWERFIST_TAGLINE}</p>
        <p className="mb-3 text-[9px] leading-relaxed text-amber-200/80">
          Triple-link code lives here (not on Echo Satellite, not in MUTHUR memory). Survey →{" "}
          {SURVEY_POWERFIST_LABEL} tab → TRIPLE LINK.
        </p>
        {pairedDeviceId ? (
          <p className="mb-3 text-emerald-300/90">PAIRED // PowerFist {pairedDeviceId.slice(0, 8)}…</p>
        ) : (
          <p className="mb-3 text-[#8a8a8a]">No phone paired.</p>
        )}
        {remotePin ? (
          <div className="mb-3 rounded border border-amber-900/40 bg-amber-950/20 p-3">
            <p className="mb-2 text-[9px] tracking-[0.08em] text-amber-200/90">
              Same-machine code (Survey → PowerFist tab)
            </p>
            <SurveyPairPinDisplay pin={remotePin} tone="amber" />
            <p className="mt-2 text-[8px] text-[#6a6a6a]">
              Expires in {formatExpiry(expiresAt)} · or scan QR below
            </p>
          </div>
        ) : (
          <p className="mb-3 text-[#8a8a8a]">
            {loading ? "Generating code…" : "Click PowerFist QR to show the 6-digit code."}
          </p>
        )}
        {previewUrl ? (
          <div className="mb-3 flex flex-col items-center gap-2 rounded border border-[#2d2d2d] bg-white p-3">
            <QRCodeSVG value={previewUrl} size={140} level="M" includeMargin />
            <p className="text-[8px] text-[#333]">Expires in {formatExpiry(expiresAt)}</p>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <CyberdeckActionButton disabled={busy || loading} onClick={() => void handleGeneratePhoneQr()}>
            {previewUrl || remotePin ? "New PowerFist QR + code" : "PowerFist QR"}
          </CyberdeckActionButton>
          {pairedDeviceId ? (
            <CyberdeckActionButton disabled={busy} onClick={() => void handleUnpairPhone()}>
              Unpair phone
            </CyberdeckActionButton>
          ) : null}
        </div>
      </div>

      <div>
        <div className="mb-2 text-[10px] tracking-[0.06em] text-[#8a8a8a]">
          {SURVEY_ECHO_DISPLAY} // screenshot computer
        </div>
        <p className="mb-3 text-[9px] text-[#5f5f5f]">{SURVEY_ECHO_TAGLINE}</p>
        {pairedEchoNodeId ? (
          <p className="mb-3 text-emerald-300/90">
            PAIRED // {SURVEY_ECHO_DISPLAY} {pairedEchoNodeId.slice(0, 8)}…
          </p>
        ) : (
          <p className="mb-3 text-[#8a8a8a]">Echo not paired.</p>
        )}
        {capturePairUrl ? (
          <div className="mb-3 flex flex-col items-center gap-2 rounded border border-cyan-900/30 bg-white p-3">
            <QRCodeSVG value={capturePairUrl} size={140} level="M" includeMargin />
            <p className="max-w-full break-all text-center text-[8px] text-[#333]">
              Scan on {SURVEY_ECHO_DISPLAY} · expires in {formatExpiry(captureExpiresAt)}
            </p>
          </div>
        ) : (
          <p className="mb-3 text-[#8a8a8a]">Generate QR for the screenshot computer.</p>
        )}
        <div className="flex flex-wrap gap-2">
          <CyberdeckActionButton disabled={busy || loading} onClick={() => void handleGenerateEchoQr()}>
            {capturePairUrl ? "New Echo QR" : "Echo QR"}
          </CyberdeckActionButton>
          {pairedEchoNodeId ? (
            <CyberdeckActionButton disabled={busy} onClick={() => void handleUnpairEcho()}>
              Unpair Echo
            </CyberdeckActionButton>
          ) : null}
        </div>
      </div>

      {error ? <p className="text-red-300/90">{error}</p> : null}
    </div>
  );
}
