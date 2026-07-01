"use client";

import { useEffect } from "react";
import { startSurveyCaptureDeck } from "@/lib/cyberdeck/survey-capture-deck";

/** Echo capture-deck — blank surface, no mission UI, native capture only. */
export default function PowerfistCapturePairPage() {
  useEffect(() => {
    let deck: Awaited<ReturnType<typeof startSurveyCaptureDeck>> = null;

    void startSurveyCaptureDeck().then((handle) => {
      deck = handle;
    });

    return () => {
      deck?.close();
    };
  }, []);

  return <div className="min-h-screen bg-black" aria-hidden="true" />;
}
