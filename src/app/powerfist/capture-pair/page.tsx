"use client";

import { useEffect, useState } from "react";
import {
  ESPIONAGE_ECHO_DISPLAY,
  ESPIONAGE_MODE_TITLE,
} from "@/lib/cyberdeck/espionage-mode";
import {
  buildPowerfistCaptureWsUrl,
  completePowerfistCapturePairFromQr,
  connectPowerfistCaptureSocket,
  readPowerfistCapturePairParamsFromQuery,
  savePowerfistCaptureCredentials,
} from "@/lib/cyberdeck/powerfist-capture-client";

export default function PowerfistCapturePairPage() {
  const [status, setStatus] = useState(`${ESPIONAGE_ECHO_DISPLAY} // pairing with Mirage hub…`);

  useEffect(() => {
    let socket: ReturnType<typeof connectPowerfistCaptureSocket> | null = null;
    let cancelled = false;

    void (async () => {
      const params = readPowerfistCapturePairParamsFromQuery();
      if (!params) {
        setStatus(`${ESPIONAGE_ECHO_DISPLAY} // missing pair code — scan Echo QR on Mirage Settings`);
        return;
      }

      const result = await completePowerfistCapturePairFromQr(params.pairId, params.pairSecret);
      if (cancelled) return;

      if (!result.ok) {
        setStatus(`${ESPIONAGE_ECHO_DISPLAY} // ${result.reason}`);
        return;
      }

      savePowerfistCaptureCredentials(result.wsHost, result.wsPort, result.captureToken, result.nodeId);
      const wsUrl = buildPowerfistCaptureWsUrl(
        result.wsHost,
        result.wsPort,
        result.captureToken,
        result.nodeId,
      );
      socket = connectPowerfistCaptureSocket({
        wsUrl,
        onStatus: (next) => {
          if (next === "connected") {
            setStatus(
              `${ESPIONAGE_MODE_TITLE} // ${ESPIONAGE_ECHO_DISPLAY} // LINKED // silent capture on PowerFist trigger`,
            );
          } else if (next === "error") {
            setStatus(`${ESPIONAGE_ECHO_DISPLAY} // relay error — re-scan Echo QR on Mirage`);
          }
        },
        onMissionResult: (detail) => {
          if (detail.ok) {
            setStatus(
              `${ESPIONAGE_ECHO_DISPLAY} // mission ${detail.missionId.slice(0, 8)}… sent to Mirage`,
            );
            return;
          }
          setStatus(`${ESPIONAGE_ECHO_DISPLAY} // mission failed // ${detail.reason ?? "unknown"}`);
        },
      });
    })();

    return () => {
      cancelled = true;
      socket?.close();
    };
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-black p-6 font-mono text-sm text-cyan-200">
      <div className="max-w-md text-center tracking-[0.08em]">
        <p>{status}</p>
        <p className="mt-4 text-[11px] leading-relaxed text-cyan-200/60">
          Keep Echo running locally on the screenshot computer. Silent capture uses the localhost
          desktop agent (Windows + samus-manus).
        </p>
      </div>
    </main>
  );
}
