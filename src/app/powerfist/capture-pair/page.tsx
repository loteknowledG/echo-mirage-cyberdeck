"use client";

import { useEffect, useState } from "react";
import {
  ESPIONAGE_ECHO_DISPLAY,
  ESPIONAGE_MODE_TITLE,
} from "@/lib/cyberdeck/espionage-mode";
import { isBrowserScreenCaptureSupported } from "@/lib/cyberdeck/browser-screen-capture";
import {
  buildPowerfistCaptureWsUrl,
  completePowerfistCapturePairFromQr,
  connectPowerfistCaptureSocket,
  readPowerfistCapturePairParamsFromQuery,
  savePowerfistCaptureCredentials,
} from "@/lib/cyberdeck/powerfist-capture-client";

export default function PowerfistCapturePairPage() {
  const [status, setStatus] = useState(`${ESPIONAGE_ECHO_DISPLAY} // pairing with Mirage hub…`);
  const browserCapture = isBrowserScreenCaptureSupported();

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
              browserCapture
                ? `${ESPIONAGE_MODE_TITLE} // ${ESPIONAGE_ECHO_DISPLAY} // LINKED // pick screen when PowerFist triggers`
                : `${ESPIONAGE_MODE_TITLE} // ${ESPIONAGE_ECHO_DISPLAY} // LINKED // awaiting PowerFist capture missions`,
            );
          } else if (next === "error") {
            setStatus(`${ESPIONAGE_ECHO_DISPLAY} // relay error — re-scan Echo QR on Mirage`);
          }
        },
        onCapturePrompt: () => {
          setStatus(`${ESPIONAGE_ECHO_DISPLAY} // CAPTURE // choose screen or window in browser dialog…`);
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
  }, [browserCapture]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-black p-6 font-mono text-sm text-cyan-200">
      <div className="max-w-md text-center tracking-[0.08em]">
        <p>{status}</p>
        {browserCapture ? (
          <p className="mt-4 text-[11px] leading-relaxed text-cyan-200/60">
            Keep this tab open. When PowerFist triggers capture, your browser will ask which screen or
            window to share.
          </p>
        ) : (
          <p className="mt-4 text-[11px] leading-relaxed text-amber-200/70">
            Browser screen capture unavailable — using localhost silent capture when missions arrive.
          </p>
        )}
      </div>
    </main>
  );
}
