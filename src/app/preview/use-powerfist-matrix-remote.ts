"use client";

import { useEffect, useRef, useState } from "react";
import {
  buildPowerfistRemoteWsUrl,
  clearPowerfistPairQueryFromUrl,
  completePowerfistPairFromQr,
  connectPowerfistRemoteSocket,
  readPowerfistPairParamsFromQuery,
  readPowerfistRemoteCredentials,
  type PowerfistSocketStatus,
} from "@/lib/cyberdeck/powerfist-remote-socket";

export function usePowerfistMatrixRemote(enabled: boolean) {
  const remoteSocketRef = useRef<ReturnType<typeof connectPowerfistRemoteSocket> | null>(null);
  const [remoteSocketStatus, setRemoteSocketStatus] = useState<PowerfistSocketStatus>("disconnected");
  const [pairMessage, setPairMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let socket: ReturnType<typeof connectPowerfistRemoteSocket> | null = null;

    const connectRemote = (host: string, port: number, remoteToken: string, deviceId: string) => {
      const wsUrl = buildPowerfistRemoteWsUrl(host, port, remoteToken, deviceId);
      socket = connectPowerfistRemoteSocket({
        wsUrl,
        onStatus: (status) => {
          if (!cancelled) setRemoteSocketStatus(status);
        },
      });
      remoteSocketRef.current = socket;
    };

    void (async () => {
      const pairParams = readPowerfistPairParamsFromQuery();
      if (pairParams) {
        setRemoteSocketStatus("pairing");
        const result = await completePowerfistPairFromQr(pairParams.pairId, pairParams.pairSecret);
        clearPowerfistPairQueryFromUrl();
        if (cancelled) return;
        if (!result.ok) {
          setPairMessage(result.reason);
          setRemoteSocketStatus("error");
          return;
        }
        setPairMessage("Paired with desktop Echo Mirage.");
        connectRemote(result.wsHost, result.wsPort, result.remoteToken, result.deviceId);
        return;
      }

      const saved = readPowerfistRemoteCredentials();
      if (!saved || cancelled) {
        setPairMessage("Scan desktop Settings → PowerFist QR to pair.");
        return;
      }

      connectRemote(saved.host, saved.port, saved.remoteToken, saved.deviceId);
    })();

    return () => {
      cancelled = true;
      socket?.close();
      remoteSocketRef.current = null;
    };
  }, [enabled]);

  return { remoteSocketRef, remoteSocketStatus, pairMessage };
}
