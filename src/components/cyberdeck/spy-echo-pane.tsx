"use client";

import { useCallback, useEffect, useState } from "react";
import { CyberdeckActionButton } from "@/components/cyberdeck/cyberdeck-control-button";
import {
  ESPIONAGE_ECHO_DISPLAY,
  ESPIONAGE_ECHO_TAGLINE,
  ESPIONAGE_MODE_TITLE,
  getOrCreateEspionageNodeId,
  readEspionageNodeRole,
  writeEspionageNodeRole,
  type EspionageNodeRole,
} from "@/lib/cyberdeck/espionage-mode";
import { useSpyContext } from "@/lib/cyberdeck/spy-context";
import {
  buildPowerfistCaptureWsUrl,
  connectPowerfistCaptureSocket,
  readPowerfistCaptureCredentials,
} from "@/lib/cyberdeck/powerfist-capture-client";
import type { PowerfistSocketStatus } from "@/lib/cyberdeck/powerfist-remote-socket";

export function SpyEchoPane() {
  const { setCapture, setActiveSubPane } = useSpyContext();
  const [nodeId, setNodeId] = useState("");
  const [role, setRole] = useState<EspionageNodeRole>("off");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wsStatus, setWsStatus] = useState<PowerfistSocketStatus>("disconnected");
  const [lastMission, setLastMission] = useState<string | null>(null);

  useEffect(() => {
    setNodeId(getOrCreateEspionageNodeId());
    setRole(readEspionageNodeRole());
  }, []);

  useEffect(() => {
    const creds = readPowerfistCaptureCredentials();
    if (!creds) return;

    const wsUrl = buildPowerfistCaptureWsUrl(
      creds.host,
      creds.port,
      creds.captureToken,
      creds.nodeId,
    );
    const socket = connectPowerfistCaptureSocket({
      wsUrl,
      onStatus: setWsStatus,
      onMissionResult: (detail) => {
        setLastMission(
          detail.ok
            ? `Mission ${detail.missionId.slice(0, 8)}… sent to Mirage`
            : `Mission failed: ${detail.reason ?? "unknown"}`,
        );
      },
    });

    return () => socket.close();
  }, []);

  const handleCapture = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/spy/capture", { method: "POST" });
      const payload = (await res.json()) as { ok?: boolean; pngBase64?: string; error?: string };
      if (!payload.ok || !payload.pngBase64) {
        setError(payload.error || "Capture failed.");
        return;
      }
      const pngBase64 = payload.pngBase64.trim();
      setCapture({
        missionId: null,
        pngBase64,
        imageDataUrl: `data:image/png;base64,${pngBase64}`,
        capturedAt: new Date().toISOString(),
      });
      setActiveSubPane("mirage");
    } catch {
      setError("Capture request failed.");
    } finally {
      setBusy(false);
    }
  }, [setActiveSubPane, setCapture]);

  const handleRoleEcho = useCallback(() => {
    writeEspionageNodeRole("echo");
    setRole("echo");
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-4 font-mono text-[10px] tracking-[0.04em] text-[#707070]">
      <div>
        <p className="text-cyan-300/90">{ESPIONAGE_MODE_TITLE} // {ESPIONAGE_ECHO_DISPLAY}</p>
        <p className="mt-1 text-[9px] text-[#6a8a8a]">{ESPIONAGE_ECHO_TAGLINE}</p>
        <p className="mt-2 text-[9px] text-[#5f5f5f]">Node {nodeId.slice(0, 8)}… · WS {wsStatus.toUpperCase()}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <CyberdeckActionButton disabled={busy} onClick={() => void handleCapture()}>
          Capture screen
        </CyberdeckActionButton>
        <CyberdeckActionButton disabled={role === "echo"} onClick={handleRoleEcho}>
          This is {ESPIONAGE_ECHO_DISPLAY}
        </CyberdeckActionButton>
      </div>

      <p className="text-[9px] leading-relaxed text-[#5f5f5f]">
        Multi-device: scan Echo QR on the Mirage sub-pane, then keep this Spy tab open on the
        screenshot computer. PowerFist or Mirage can trigger remote captures over the relay.
      </p>

      {lastMission ? <p className="text-emerald-300/80">{lastMission}</p> : null}
      {error ? <p className="text-red-300/90">{error}</p> : null}
    </div>
  );
}
