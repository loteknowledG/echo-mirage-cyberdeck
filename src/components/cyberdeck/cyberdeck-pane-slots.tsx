"use client";

import type { ReactNode } from "react";
import { MiragePaneLayer } from "@/components/cyberdeck/mirage-pane-layer";
import { useCyberdeckTabStore } from "@/lib/cyberdeck-tab-store";
import type { CyberdeckServerId } from "@/lib/cyberdeck-tab-store";

type PaneClassName = string | undefined;

/** Subscribes to tab store only — parent shell does not re-render on tab switch. */
export function CyberdeckFixedServerPane({
  serverId,
  className,
  children,
}: {
  serverId: CyberdeckServerId | "ct";
  className?: PaneClassName;
  children: ReactNode;
}) {
  const mounted = useCyberdeckTabStore((s) => s.mountedFixedServers.includes(serverId));
  const visible = useCyberdeckTabStore(
    (s) => s.activeCustomTabId == null && s.server === serverId,
  );
  if (!mounted) return null;
  return (
    <MiragePaneLayer visible={visible} className={className}>
      {children}
    </MiragePaneLayer>
  );
}

export function CyberdeckCustomTabPanes({
  renderTab,
}: {
  renderTab: (tab: {
    id: string;
    label: string;
    glyph: string;
    kind: string;
    browserUrl?: string;
    asset?: unknown;
  }) => ReactNode;
}) {
  const mountedCustomTabs = useCyberdeckTabStore((s) =>
    s.customTabs.filter((tab) => s.mountedCustomTabIds.includes(tab.id)),
  );
  const activeCustomTabId = useCyberdeckTabStore((s) => s.activeCustomTabId);

  return (
    <>
      {mountedCustomTabs.map((tab) => {
        const visible = activeCustomTabId === tab.id;
        const paneKey = `${tab.id}:${tab.kind}`;
        return (
          <MiragePaneLayer
            key={paneKey}
            paneKey={paneKey}
            visible={visible}
            className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
          >
            {visible ? renderTab(tab) : null}
          </MiragePaneLayer>
        );
      })}
    </>
  );
}

export function CyberdeckGatewaySettingsPane({
  className,
  children,
}: {
  className?: PaneClassName;
  children: ReactNode;
}) {
  const mounted = useCyberdeckTabStore((s) => s.mountedFixedServers.includes("s"));
  const visible = useCyberdeckTabStore(
    (s) => s.activeCustomTabId == null && s.server === "s",
  );
  if (!mounted) return null;
  return (
    <MiragePaneLayer visible={visible} className={className}>
      {children}
    </MiragePaneLayer>
  );
}
