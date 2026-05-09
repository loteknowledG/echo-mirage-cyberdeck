'use client';

import { CyberdeckActionButton } from "@/components/cyberdeck/action-button";
import {
  CyberdeckPaneHeader,
  CyberdeckPaneHeaderSubtitle,
  CyberdeckPaneHeaderTitle,
  CyberdeckPaneHeaderValue,
} from "@/components/cyberdeck/pane-header";
import { CyberdeckSquareCard } from "@/components/cyberdeck/square-card";
import { CyberdeckSquareCardGrid } from "@/components/cyberdeck/square-card-grid";

type CatalogItem = {
  name: string;
  subtitle: string;
  price: string;
  summary: string;
  specs: string[];
  featured?: boolean;
};

const CATALOG_ITEMS: CatalogItem[] = [
  {
    name: "Craftwerk // MK-I",
    subtitle: "Featured build // operator-grade field deck",
    price: "$4,800",
    summary: "Balanced for live terminal work, browser ops, and compact deployment.",
    specs: ["16GB unified memory", "6-hour battery", "OLED side rail", "Secure boot"],
    featured: true,
  },
  {
    name: "Craftwerk // NOMAD",
    subtitle: "Portable build // light-footprint travel deck",
    price: "$3,200",
    summary: "Smaller chassis for quick tasks, comms, and remote operator sessions.",
    specs: ["12GB unified memory", "3x USB-C", "Hot-swap storage", "Fanless design"],
  },
  {
    name: "Craftwerk // VAULT",
    subtitle: "Heavy build // hardened workstation",
    price: "$6,900",
    summary: "Ruggedized shell with extra thermal headroom and secure isolation.",
    specs: ["32GB unified memory", "Shielded enclosure", "Dual NVMe", "Air-gapped mode"],
  },
  {
    name: "Craftwerk // RELAY",
    subtitle: "Network build // comms-forward unit",
    price: "$5,100",
    summary: "Optimized for relay work, diagnostics, and long-haul connectivity.",
    specs: ["Wi-Fi 7", "LTE fallback", "Noise-suppressed mic", "Encrypted session vault"],
  },
];

function getCraftwerkPurchaseHref() {
  const configured = process.env.NEXT_PUBLIC_CRAFTWERK_PURCHASE_URL?.trim();
  if (configured) return configured;
  const subject = encodeURIComponent("Craftwerk Cyberdeck Purchase");
  const body = encodeURIComponent(
    "Hello Craftwerk,\n\nI would like to purchase a Craftwerk cyberdeck. Please send the current catalog, lead time, and checkout details.\n",
  );
  return `mailto:sales@craftwerk.cyberdeck?subject=${subject}&body=${body}`;
}

export function CyberdeckCatalogPaneBody() {
  const purchaseHref = getCraftwerkPurchaseHref();

  const handlePurchaseClick = () => {
    if (typeof window === "undefined") return;
    if (purchaseHref.startsWith("mailto:") || purchaseHref.startsWith("tel:")) {
      window.location.href = purchaseHref;
      return;
    }
    window.open(purchaseHref, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="custom-scrollbar flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-3">
      <CyberdeckPaneHeader
        left={
          <div className="flex flex-col">
            <CyberdeckPaneHeaderTitle style={{ textShadow: "0 0 6px rgba(138,138,138,0.2)" }}>
              CATELOG
            </CyberdeckPaneHeaderTitle>
            <CyberdeckPaneHeaderSubtitle>CYBERDECK MODEL INDEX // CRAFTWERK LINE</CyberdeckPaneHeaderSubtitle>
          </div>
        }
        right={<CyberdeckPaneHeaderValue>{CATALOG_ITEMS.length} MODELS</CyberdeckPaneHeaderValue>}
      />

      <div className="rounded-sm border border-[#1c1c1c] bg-black/80 p-3 font-mono text-[10px] leading-snug text-[#8a8a8a]">
        Browse the current Craftwerk lineup and select a build to purchase or inquire about.
      </div>

      <CyberdeckSquareCardGrid className="xl:grid-cols-4">
        {CATALOG_ITEMS.map((item) => (
          <CyberdeckSquareCard
            key={item.name}
            className={`justify-between overflow-hidden ${item.featured ? "border-emerald-500/55 bg-emerald-500/5 shadow-[0_0_0_1px_rgba(16,185,129,0.10)_inset]" : ""}`.trim()}
          >
            <div className="flex min-h-0 flex-1 flex-col gap-2">
              {item.featured ? (
                <div className="flex min-h-0 flex-[1.25] overflow-hidden rounded-sm border border-[#1c1c1c] bg-black/80">
                  <img
                    src="/catalog/echo-mirage-cyberdeck.png"
                    alt="Echo Mirage Cyberdeck"
                    className="h-full w-full object-cover"
                    draggable={false}
                  />
                </div>
              ) : null}

              <div className="flex min-h-0 flex-[0.75] flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-mono text-[11px] tracking-[0.08em] text-emerald-200">
                      {item.name}
                    </div>
                    <div className="mt-1 font-mono text-[9px] tracking-[0.08em] text-[#8a8a8a]">
                      {item.subtitle}
                    </div>
                  </div>
                  {item.featured ? (
                    <div className="rounded border border-emerald-500/40 px-2 py-1 font-mono text-[8px] tracking-[0.08em] text-emerald-200">
                      FEATURED
                    </div>
                  ) : null}
                </div>

                <div className="font-mono text-[10px] tracking-[0.08em] text-[#cfcfcf]">{item.price}</div>
                <div className="font-mono text-[9px] leading-snug tracking-[0.05em] text-[#8a8a8a]">
                  {item.summary}
                </div>

                <div className="mt-auto space-y-1 pt-2">
                  {item.specs.map((spec) => (
                    <div key={spec} className="font-mono text-[8px] tracking-[0.08em] text-[#6f6f6f]">
                      // {spec}
                    </div>
                  ))}
                </div>

                {item.featured ? (
                  <div className="mt-1 space-y-2">
                    <CyberdeckActionButton variant="accent" onClick={handlePurchaseClick} className="w-full">
                      PURCHASE CRAFTWERK
                    </CyberdeckActionButton>
                    <div className="text-[8px] leading-snug tracking-[0.08em] text-[#6f6f6f]">
                      Opens the Craftwerk checkout URL when configured, otherwise starts a purchase inquiry.
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </CyberdeckSquareCard>
        ))}
      </CyberdeckSquareCardGrid>
    </div>
  );
}
