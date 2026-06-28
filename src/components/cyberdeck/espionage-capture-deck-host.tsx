"use client";

import { useEffect } from "react";
import { readEspionageNodeRole } from "@/lib/cyberdeck/espionage-mode";
import { startStealthCaptureDeck } from "@/lib/cyberdeck/espionage-stealth-capture-deck";
import { readPowerfistCaptureCredentials } from "@/lib/cyberdeck/powerfist-capture-client";

/** Packaged Echo — resume silent capture-deck in the background after QR pair. */
export function EspionageCaptureDeckHost() {
  useEffect(() => {
    const role = readEspionageNodeRole();
    const creds = readPowerfistCaptureCredentials();
    const params = new URLSearchParams(window.location.search);
    const hasPairQuery = Boolean(params.get("pairId") && params.get("pairSecret"));

    if (role !== "echo" && !creds && !hasPairQuery) {
      return;
    }

    let deck: Awaited<ReturnType<typeof startStealthCaptureDeck>> = null;
    void startStealthCaptureDeck().then((handle) => {
      deck = handle;
    });

    return () => {
      deck?.close();
    };
  }, []);

  return null;
}
