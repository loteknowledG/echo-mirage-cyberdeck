"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { getTunesEngine, type TunesEngineSnapshot } from "@/lib/tunes/tunes-engine";

function subscribe(onStoreChange: () => void) {
  return getTunesEngine().subscribe(onStoreChange);
}

function getSnapshot(): TunesEngineSnapshot {
  return getTunesEngine().getSnapshot();
}

export function useTunesEngine(): {
  snapshot: TunesEngineSnapshot;
  engine: ReturnType<typeof getTunesEngine>;
  hydrated: boolean;
} {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const [hydrated, setHydrated] = useState(() => getTunesEngine().isHydrated());
  const engine = getTunesEngine();

  useEffect(() => {
    let cancelled = false;
    void engine.hydrate().then(() => {
      if (!cancelled) setHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, [engine]);

  return { snapshot, engine, hydrated };
}
