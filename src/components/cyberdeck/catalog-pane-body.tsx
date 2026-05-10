'use client';

import { useState } from "react";
import {
  CyberdeckPaneHeader,
  CyberdeckPaneHeaderSubtitle,
  CyberdeckPaneHeaderTitle,
  CyberdeckPaneHeaderValue,
} from "@/components/cyberdeck/pane-header";
import { CatalogGrid } from "@/components/cyberdeck/catalog/catalog-grid";
import { CatalogCard } from "@/components/cyberdeck/catalog/catalog-card";
import { MomentDetailsModal } from "@/components/cyberdeck/catalog/moment-details-modal";
import { ECHO_MIRAGE_SERIES_MOMENT } from "@/lib/catalog/echo-mirage-series";

const CATALOG_MOMENTS = [ECHO_MIRAGE_SERIES_MOMENT];

export function CyberdeckCatalogPaneBody() {
  const [detailsOpen, setDetailsOpen] = useState(false);

  return (
    <div className="custom-scrollbar flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-3">
      <CyberdeckPaneHeader
        left={
          <div className="flex flex-col">
            <CyberdeckPaneHeaderTitle style={{ textShadow: "0 0 6px rgba(138,138,138,0.15)" }}>
              CATALOG
            </CyberdeckPaneHeaderTitle>
            <CyberdeckPaneHeaderSubtitle>
              DEPLOYMENT INDEX // CRAFTWERK CYBERDECK CORPORATION
            </CyberdeckPaneHeaderSubtitle>
          </div>
        }
        right={
          <CyberdeckPaneHeaderValue>
            {CATALOG_MOMENTS.length === 1 ? "1 LINE" : `${CATALOG_MOMENTS.length} LINES`}
          </CyberdeckPaneHeaderValue>
        }
      />

      <div className="rounded-sm border border-[#1c1c1c] bg-black/75 p-3 font-mono text-[10px] leading-snug tracking-[0.04em] text-[#707070]">
        Classified equipment manifest — Echo Mirage production line only. Select a configuration moment for
        specifications and deployment narrative.
      </div>

      <CatalogGrid>
        {CATALOG_MOMENTS.map((m) => (
          <CatalogCard
            key={m.configurationId}
            title={m.title}
            coverImage={m.coverImage}
            coverAlt={m.coverAlt}
            configurationId={m.configurationId}
            onOpen={() => setDetailsOpen(true)}
          />
        ))}
      </CatalogGrid>

      <MomentDetailsModal
        moment={ECHO_MIRAGE_SERIES_MOMENT}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
      />
    </div>
  );
}

/** Alias for documentation / future routing to a dedicated catalog module. */
export { CyberdeckCatalogPaneBody as CatalogPane };
