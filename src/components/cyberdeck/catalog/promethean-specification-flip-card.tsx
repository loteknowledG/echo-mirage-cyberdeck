'use client';

import { cn } from "@/lib/utils";
import type { CatalogSpecificationSection } from "@/lib/catalog/echo-mirage-series";

export type PrometheanSpecificationFlipCardProps = {
  title: string;
  coverImage: string;
  coverAlt: string;
  specifications: CatalogSpecificationSection[];
  deploymentNotes: string[];
  flipped: boolean;
  onFlippedChange: (next: boolean) => void;
  className?: string;
};

export function PrometheanSpecificationFlipCard({
  title,
  coverImage,
  coverAlt,
  specifications,
  deploymentNotes,
  flipped,
  onFlippedChange,
  className,
}: PrometheanSpecificationFlipCardProps) {
  return (
    <div className={cn("relative h-full min-h-0 w-full", className)} style={{ perspective: "1600px" }}>
      <div
        className="relative h-full w-full transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{
          transformStyle: "preserve-3d",
          transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
        }}
      >
        {/* Front — full image (letterboxed, uncropped) */}
        <div
          className="absolute inset-0 overflow-hidden bg-black"
          style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}
        >
          <div className="flex h-full w-full items-center justify-center">
            <img
              src={coverImage}
              alt={coverAlt}
              className="max-h-full max-w-full object-contain"
              draggable={false}
            />
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-black/40 to-transparent" />

          <button
            type="button"
            onClick={() => onFlippedChange(true)}
            className={cn(
              "absolute right-0 top-1/2 z-10 -translate-y-1/2 border border-emerald-500/45 bg-black/90 px-2.5 py-6 font-mono text-[9px] tracking-[0.18em] text-emerald-200 shadow-[0_0_0_1px_rgba(16,185,129,0.08)_inset]",
              "transition-[border-color,background-color,color] duration-200",
              "hover:border-emerald-400/70 hover:bg-black/95 hover:text-emerald-100",
              "focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-emerald-500/50",
            )}
          >
            SPECS
          </button>
        </div>

        {/* Back — specification facet */}
        <div
          className="absolute inset-0 overflow-hidden bg-[#050505]"
          style={{
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
          }}
        >
          <button
            type="button"
            onClick={() => onFlippedChange(false)}
            className={cn(
              "absolute right-0 top-1/2 z-20 -translate-y-1/2 border border-emerald-500/45 bg-black/90 px-2.5 py-6 font-mono text-[9px] tracking-[0.18em] text-emerald-200 shadow-[0_0_0_1px_rgba(16,185,129,0.08)_inset]",
              "transition-[border-color,background-color,color] duration-200",
              "hover:border-emerald-400/70 hover:bg-black/95 hover:text-emerald-100",
              "focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-emerald-500/50",
            )}
          >
            PIC
          </button>

          <div className="flex h-full flex-col overflow-hidden border-r border-emerald-500/20 pr-11 sm:pr-12">
            <div className="flex shrink-0 items-start justify-between border-b border-[#1c1c1c] bg-black/80 px-4 py-3 sm:px-5">
              <div>
                <div className="font-mono text-[10px] tracking-[0.12em] text-[#909090] sm:text-[11px]">
                  SPECIFICATION SHEET
                </div>
                <div className="mt-0.5 font-mono text-[8px] tracking-[0.14em] text-[#585858] sm:text-[9px]">
                  {title.toUpperCase()}
                </div>
              </div>
            </div>

            <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
              <div className="grid gap-4 lg:grid-cols-2 lg:gap-5">
                <div className="space-y-4">
                  {specifications.slice(0, Math.ceil(specifications.length / 2)).map((section) => (
                    <SpecBlock key={section.heading} section={section} />
                  ))}
                </div>
                <div className="space-y-4">
                  {specifications.slice(Math.ceil(specifications.length / 2)).map((section) => (
                    <SpecBlock key={section.heading} section={section} />
                  ))}
                </div>
              </div>

              <div className="mt-5 rounded-sm border border-[#1c1c1c] bg-black/50 p-4">
                <div className="mb-2 font-mono text-[9px] tracking-[0.12em] text-[#707070] sm:text-[10px]">
                  DEPLOYMENT NOTES
                </div>
                <ul className="space-y-1.5 font-mono text-[10px] leading-snug tracking-[0.04em] text-[#5c5c5c] sm:text-[11px]">
                  {deploymentNotes.map((line) => (
                    <li key={line}>// {line}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SpecBlock({ section }: { section: CatalogSpecificationSection }) {
  return (
    <div className="rounded-sm border border-[#1c1c1c] bg-black/40 p-3 sm:p-3.5">
      <div className="mb-2 font-mono text-[9px] tracking-[0.14em] text-[#888888] sm:text-[10px]">
        {section.heading.toUpperCase()}
      </div>
      <ul className="space-y-1.5 font-mono text-[10px] leading-snug tracking-[0.03em] text-[#5a5a5a] sm:text-[11px]">
        {section.items.map((item) => (
          <li key={item}>— {item}</li>
        ))}
      </ul>
    </div>
  );
}
