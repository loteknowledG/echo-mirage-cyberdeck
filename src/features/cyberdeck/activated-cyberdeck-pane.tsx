"use client";

import { useEffect, useMemo, useState, type ComponentType } from "react";
import { PanelLoader, type PanelLoadStage } from "@/features/cyberdeck/panel-loader";
import { importCyberdeckPane } from "@/features/cyberdeck/pane-chunks";
import { paneFetchHintsForKind, paneLabelForKind } from "@/features/cyberdeck/pane-registry";

type ActivatedCyberdeckPaneProps = Record<string, unknown> & {
  kind: string;
};

type LoadPhase = "fetch" | "mount";

const FETCH_HINT_INTERVAL_MS = 2200;

/**
 * Mounts a pane body only after activation. Each pane is a direct dynamic import
 * (no loader-router intermediary chunk).
 */
export function ActivatedCyberdeckPane({ kind, ...props }: ActivatedCyberdeckPaneProps) {
  const [Pane, setPane] = useState<ComponentType<any> | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [phase, setPhase] = useState<LoadPhase>("fetch");
  const [hintIndex, setHintIndex] = useState(0);

  const paneLabel = paneLabelForKind(kind);
  const fetchHints = useMemo(() => paneFetchHintsForKind(kind), [kind]);

  useEffect(() => {
    let cancelled = false;
    setPane(null);
    setLoadError(null);
    setPhase("fetch");
    setHintIndex(0);

    void importCyberdeckPane(kind)
      .then((mod) => {
        if (cancelled) return;
        setPhase("mount");
        setPane(() => mod.default);
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "Pane load failed.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [kind]);

  useEffect(() => {
    if (phase !== "fetch" || fetchHints.length === 0) return;

    const timer = window.setInterval(() => {
      setHintIndex((prev) => (prev + 1) % fetchHints.length);
    }, FETCH_HINT_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [phase, fetchHints.length]);

  const stages = useMemo((): PanelLoadStage[] => {
    const fetchDone = phase === "mount";
    const mountDone = Boolean(Pane);

    return [
      {
        id: "fetch",
        label: `${paneLabel} MODULE`,
        status: fetchDone ? "done" : "active",
      },
      {
        id: "mount",
        label: "MOUNT SURFACE",
        status: mountDone ? "done" : phase === "mount" ? "active" : "pending",
      },
    ];
  }, [Pane, paneLabel, phase]);

  const activeHint =
    phase === "fetch" && fetchHints.length > 0 ? fetchHints[hintIndex] : undefined;

  if (loadError) {
    return (
      <div className="flex flex-1 items-center justify-center p-4 font-mono text-[10px] text-red-400">
        {paneLabel} // {loadError}
      </div>
    );
  }

  if (!Pane) {
    return (
      <PanelLoader
        label={paneLabel}
        stages={stages}
        activeHint={activeHint}
      />
    );
  }

  return <Pane {...props} />;
}
