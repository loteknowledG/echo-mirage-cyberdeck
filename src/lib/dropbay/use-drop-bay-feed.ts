"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Drop } from "@/lib/dropbay/dropbay-types";

type UseDropBayFeedOptions = {
  limit?: number;
};

export function useDropBayFeed(options: UseDropBayFeedOptions = {}) {
  const limit = options.limit ?? 100;
  const [drops, setDrops] = useState<Drop[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const limitRef = useRef(limit);

  useEffect(() => {
    limitRef.current = limit;
  }, [limit]);

  const prependDrop = useCallback((drop: Drop) => {
    setDrops((prev) => [drop, ...prev.filter((entry) => entry.id !== drop.id)].slice(0, limitRef.current));
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadInitial = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/drops?limit=${limitRef.current}`, { cache: "no-store" });
        const payload = (await res.json()) as { ok?: boolean; drops?: Drop[]; error?: string };
        if (!res.ok || !payload.ok) {
          throw new Error(payload.error || `Failed to load drops (${res.status})`);
        }
        if (!cancelled) setDrops(payload.drops ?? []);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load drops.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadInitial();

    const source = new EventSource("/api/drops/stream");
    source.onopen = () => {
      if (!cancelled) setConnected(true);
    };
    source.onmessage = (event) => {
      try {
        const drop = JSON.parse(event.data) as Drop;
        if (drop?.id) prependDrop(drop);
      } catch {
        /* ignore malformed SSE payloads */
      }
    };
    source.onerror = () => {
      if (!cancelled) setConnected(false);
    };

    return () => {
      cancelled = true;
      source.close();
      setConnected(false);
    };
  }, [prependDrop]);

  return { drops, loading, connected, error };
}
