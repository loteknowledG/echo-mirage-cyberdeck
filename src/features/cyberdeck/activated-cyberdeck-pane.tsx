"use client";

import { useEffect, useState, type ComponentType } from "react";
import { PanelLoader } from "@/features/cyberdeck/panel-loader";
import { paneLabelForKind } from "@/features/cyberdeck/pane-registry";

type ActivatedCyberdeckPaneProps = Record<string, unknown> & {
  kind: string;
};

/**
 * Mounts a pane body only after activation. The registry stays metadata-only;
 * chunk fetch happens here via loadCyberdeckPane().
 */
export function ActivatedCyberdeckPane({ kind, ...props }: ActivatedCyberdeckPaneProps) {
  const [Pane, setPane] = useState<ComponentType<any> | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setPane(null);
    setLoadError(null);

    void import("@/features/cyberdeck/load-cyberdeck-pane")
      .then((mod) => mod.loadCyberdeckPane(kind))
      .then((mod) => {
        if (!cancelled) setPane(() => mod.default);
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

  if (loadError) {
    return (
      <div className="flex flex-1 items-center justify-center p-4 font-mono text-[10px] text-red-400">
        {paneLabelForKind(kind)} // {loadError}
      </div>
    );
  }

  if (!Pane) {
    return <PanelLoader label={paneLabelForKind(kind)} />;
  }

  return <Pane {...props} />;
}
