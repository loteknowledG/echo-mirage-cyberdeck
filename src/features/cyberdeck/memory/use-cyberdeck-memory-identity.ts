"use client";

import { useCallback, useEffect, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { toast } from "sonner";
import {
  clearMuthurMemory,
  createEmptyMuthurMemory,
  loadMuthurMemoryWithResult,
  saveMuthurMemory,
  type MuthurMemoryState,
} from "@/lib/muthur-memory";
import { loadIdentityBundle } from "@/lib/identity/load-identity";
import type { Identity } from "@/lib/identity/identity-types";
import { loadOrchestrationBundle } from "@/lib/orchestration/load-orchestration";
import type { OrchestrationBundle } from "@/lib/orchestration/orchestration-types";

export type UseCyberdeckMemoryIdentityResult = {
  muthurMemory: MuthurMemoryState;
  setMuthurMemory: Dispatch<SetStateAction<MuthurMemoryState>>;
  muthurMemoryHydrated: boolean;
  muthurMemoryLoadError: string | null;
  muthurMemoryRef: MutableRefObject<MuthurMemoryState>;
  identity: Identity | null;
  orchestration: OrchestrationBundle | null;
  clearMuthurMemoryState: () => Promise<void>;
};

export function useCyberdeckMemoryIdentity(): UseCyberdeckMemoryIdentityResult {
  const [muthurMemory, setMuthurMemory] = useState<MuthurMemoryState>(() => createEmptyMuthurMemory());
  const [muthurMemoryHydrated, setMuthurMemoryHydrated] = useState(false);
  const [muthurMemoryLoadError, setMuthurMemoryLoadError] = useState<string | null>(null);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [orchestration, setOrchestration] = useState<OrchestrationBundle | null>(null);
  const muthurMemoryRef = useRef<MuthurMemoryState>(createEmptyMuthurMemory());

  useEffect(() => {
    loadIdentityBundle().then((bundle) => {
      setIdentity(bundle.identity);
    });
    loadOrchestrationBundle().then((bundle) => {
      setOrchestration(bundle);
    });
  }, []);

  const clearMuthurMemoryState = useCallback(async () => {
    if (typeof window !== "undefined") {
      const confirmed = window.confirm("Clear MUTHUR memory?");
      if (!confirmed) return;
    }

    await clearMuthurMemory();
    const fresh = createEmptyMuthurMemory();
    muthurMemoryRef.current = fresh;
    setMuthurMemory(fresh);
    setMuthurMemoryHydrated(true);
    toast.success("MUTHUR memory cleared");
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { state: loaded, error: loadErr } = await loadMuthurMemoryWithResult();
      if (cancelled) return;
      muthurMemoryRef.current = loaded;
      setMuthurMemory(loaded);
      setMuthurMemoryLoadError(loadErr);
      setMuthurMemoryHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!muthurMemoryHydrated) return;
    muthurMemoryRef.current = muthurMemory;
    void saveMuthurMemory(muthurMemory);
  }, [muthurMemory, muthurMemoryHydrated]);

  return {
    muthurMemory,
    setMuthurMemory,
    muthurMemoryHydrated,
    muthurMemoryLoadError,
    muthurMemoryRef,
    identity,
    orchestration,
    clearMuthurMemoryState,
  };
}
