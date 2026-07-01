"use client";

import { useEffect } from "react";
import { readSurveyNodeRole } from "@/lib/cyberdeck/survey-mode";
import { startSurveyCaptureDeck } from "@/lib/cyberdeck/survey-capture-deck";
import { readPowerfistCaptureCredentials } from "@/lib/cyberdeck/powerfist-capture-client";

/** Packaged Echo — resume capture deck in the background after QR pair. */
export function SurveyCaptureDeckHost() {
  useEffect(() => {
    const role = readSurveyNodeRole();
    const creds = readPowerfistCaptureCredentials();
    const params = new URLSearchParams(window.location.search);
    const hasPairQuery = Boolean(params.get("pairId") && params.get("pairSecret"));

    if (role !== "echo" && !creds && !hasPairQuery) {
      return;
    }

    let deck: Awaited<ReturnType<typeof startSurveyCaptureDeck>> = null;
    void startSurveyCaptureDeck().then((handle) => {
      deck = handle;
    });

    return () => {
      deck?.close();
    };
  }, []);

  return null;
}
