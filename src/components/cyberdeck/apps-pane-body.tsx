"use client";

import {
  CyberdeckPaneHeader,
  CyberdeckPaneHeaderSubtitle,
  CyberdeckPaneHeaderTitle,
  CyberdeckPaneHeaderValue,
} from "@/components/cyberdeck/pane-header";
import { CyberdeckActionButton } from "@/components/cyberdeck/action-button";
import {
  DECK_APP_DEFINITIONS,
  deckAppDefinitionFor,
} from "@/lib/cyberdeck/deck-app-registry";
import {
  notifyDeckAppChange,
  saveDeckApp,
  type DeckAppId,
} from "@/lib/deck-app";
import { emitSignal } from "@/lib/cyberdeck/signal-router";
import { cn } from "@/lib/utils";

type CyberdeckAppsPaneBodyProps = {
  deckApp: DeckAppId;
  onDeckAppChange: (appId: DeckAppId) => void;
};

/** Apps rail pane — switch Echo Mirage between deck personalities (e.g. real estate). */
export function CyberdeckAppsPaneBody({
  deckApp,
  onDeckAppChange,
}: CyberdeckAppsPaneBodyProps) {
  const active = deckAppDefinitionFor(deckApp);

  const activateApp = (appId: DeckAppId) => {
    if (appId === deckApp) return;
    onDeckAppChange(appId);
    saveDeckApp(appId);
    notifyDeckAppChange(appId);
    const next = deckAppDefinitionFor(appId);
    emitSignal({
      source: "apps",
      type: "app_activated",
      payload: { id: appId, name: next.name },
      severity: "info",
    });
  };

  return (
    <div className="custom-scrollbar flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-3">
      <CyberdeckPaneHeader
        left={
          <div className="flex flex-col">
            <CyberdeckPaneHeaderTitle style={{ textShadow: "0 0 6px rgba(138,138,138,0.15)" }}>
              APPS
            </CyberdeckPaneHeaderTitle>
            <CyberdeckPaneHeaderSubtitle>DECK PERSONALITY // OPERATOR SURFACE TARGET</CyberdeckPaneHeaderSubtitle>
          </div>
        }
        right={<CyberdeckPaneHeaderValue>ACTIVE: {active.glyph}</CyberdeckPaneHeaderValue>}
      />

      <div className="rounded-sm border border-[#1c1c1c] bg-black/75 p-3 font-mono text-[10px] leading-snug tracking-[0.04em] text-[#707070]">
        Pick an app profile for the operator pane.{" "}
        <span className="text-[#9a9a9a]">{active.name}</span> is live — the{" "}
        <span className="text-[#9a9a9a]">OPERATOR</span> rail tab renders that workspace.
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {DECK_APP_DEFINITIONS.map((app) => {
          const selected = app.id === deckApp;
          return (
            <article
              key={app.id}
              className={cn(
                "rounded-sm border bg-black/70 p-3 transition-colors",
                selected ? "border-emerald-500/45" : "border-[#1c1c1c]",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-mono text-[11px] tracking-[0.06em] text-[#d6d6d6]">
                    {app.name}
                  </div>
                  <div className="mt-1 font-mono text-[9px] tracking-[0.08em] text-emerald-300/80">
                    {app.tagline.toUpperCase()}
                  </div>
                </div>
                <span className="shrink-0 rounded border border-[#2d2d2d] px-1.5 py-0.5 font-mono text-[9px] tracking-[0.08em] text-[#8a8a8a]">
                  {app.glyph}
                </span>
              </div>
              <p className="mt-3 font-mono text-[10px] leading-relaxed tracking-[0.04em] text-[#707070]">
                {app.description}
              </p>
              <div className="mt-3 flex gap-2">
                <CyberdeckActionButton
                  className="flex-1"
                  variant={selected ? "accent" : "neutral"}
                  aria-pressed={selected}
                  onClick={() => activateApp(app.id)}
                >
                  {selected ? "[ACTIVE]" : "[ACTIVATE]"}
                </CyberdeckActionButton>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
