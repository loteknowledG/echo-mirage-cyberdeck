"use client";

import { useEffect } from "react";
import { startStealthCaptureDeck } from "@/lib/cyberdeck/espionage-stealth-capture-deck";

/** Echo capture-deck — blank surface, no mission UI, native silent capture only. */
export default function PowerfistCapturePairPage() {
  useEffect(() => {
    let deck: Awaited<ReturnType<typeof startStealthCaptureDeck>> = null;

    void startStealthCaptureDeck().then((handle) => {
      deck = handle;
    });

    return () => {
      deck?.close();
    };
  }, []);

  return <div className="min-h-screen bg-black" aria-hidden="true" />;
}
