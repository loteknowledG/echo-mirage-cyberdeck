"use client";

import {
  CyberdeckPaneHeader,
  CyberdeckPaneHeaderSubtitle,
  CyberdeckPaneHeaderTitle,
  CyberdeckPaneHeaderValue,
} from "@/components/cyberdeck/pane-header";
import { CyberdeckActionButton } from "@/components/cyberdeck/action-button";
import { emitSignal } from "@/lib/cyberdeck/signal-router";

const CATALOG_CARDS = [
  { id: "mk-i", title: "Echo Mirage Mark I", image: "/catalog/echo-mirage-cyberdeck.png" },
  { id: "mk-ii", title: "Echo Mirage Mark II", image: "/catalog/echo-mirage-series-em-series-01.png" },
  { id: "field", title: "Echo Mirage Field Unit", image: "/catalog/echo-mirage-cyberdeck.png" },
  { id: "bridge", title: "Echo Mirage Bridge Console", image: "/catalog/echo-mirage-series-em-series-01.png" },
  { id: "industrial", title: "Echo Mirage Industrial Rig", image: "/catalog/echo-mirage-cyberdeck.png" },
  { id: "classified", title: "Echo Mirage Classified", image: "/catalog/echo-mirage-series-em-series-01.png" },
];

export function CyberdeckCatalogPaneBody() {
  return (
    <div className="custom-scrollbar flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-3">
      <CyberdeckPaneHeader
        left={
          <div className="flex flex-col">
            <CyberdeckPaneHeaderTitle style={{ textShadow: "0 0 6px rgba(138,138,138,0.15)" }}>
              CATALOG
            </CyberdeckPaneHeaderTitle>
            <CyberdeckPaneHeaderSubtitle>ECHO MIRAGE SERIES // CRAFTWERK CYBERDECK CORPORATION</CyberdeckPaneHeaderSubtitle>
          </div>
        }
        right={<CyberdeckPaneHeaderValue>{CATALOG_CARDS.length} LINES</CyberdeckPaneHeaderValue>}
      />
      <div className="rounded-sm border border-[#1c1c1c] bg-black/75 p-3 font-mono text-[10px] leading-snug tracking-[0.04em] text-[#707070]">
        Premium deployment index. Classified industrial hardware for bridge, field, and autonomous command environments.
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {CATALOG_CARDS.map((card) => (
          <article key={card.id} className="rounded-sm border border-[#1c1c1c] bg-black/70 p-2">
            <div className="relative aspect-square overflow-hidden rounded-sm border border-[#2a2a2a] bg-black">
              <img
                src={card.image}
                alt={`${card.title} cover`}
                className="h-full w-full object-cover opacity-80 saturate-[0.85]"
              />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.16),transparent_48%)]" />
              <div className="absolute bottom-0 left-0 right-0 border-t border-black/70 bg-black/70 px-2 py-1 font-mono text-[10px] tracking-[0.05em] text-[#d6d6d6]">
                {card.title}
              </div>
            </div>
            <div className="mt-2 flex gap-2">
              <CyberdeckActionButton
                className="flex-1"
                variant="neutral"
                onClick={() =>
                  emitSignal({
                    source: "catalog",
                    type: "model_selected",
                    payload: { id: card.id, label: card.title },
                    severity: "info",
                  })
                }
              >
                [VIEW]
              </CyberdeckActionButton>
              <CyberdeckActionButton
                className="flex-1"
                variant="accent"
                onClick={() =>
                  emitSignal({
                    source: "catalog",
                    type: "model_configured",
                    payload: { id: card.id, label: card.title },
                    severity: "info",
                  })
                }
              >
                [CONFIGURE]
              </CyberdeckActionButton>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

export { CyberdeckCatalogPaneBody as CatalogPane };
