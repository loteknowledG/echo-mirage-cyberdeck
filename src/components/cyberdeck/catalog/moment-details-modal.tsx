'use client';

import { useEffect, useState } from "react";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { CatalogMoment } from "@/lib/catalog/echo-mirage-series";
import { PrometheanSpecificationFlipCard } from "@/components/cyberdeck/catalog/promethean-specification-flip-card";
import { cn } from "@/lib/utils";

type MomentDetailsModalProps = {
  moment: CatalogMoment;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function MomentDetailsModal({ moment, open, onOpenChange }: MomentDetailsModalProps) {
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    if (open) setFlipped(false);
  }, [open, moment.configurationId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "fixed inset-0 z-50 flex h-[100dvh] max-h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-0 bg-black p-0",
          "shadow-none duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          "data-[state=open]:zoom-in-100 data-[state=closed]:zoom-out-100 data-[state=open]:slide-in-from-left-0 data-[state=open]:slide-in-from-top-0 data-[state=closed]:slide-out-to-left-0 data-[state=closed]:slide-out-to-top-0",
        )}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogTitle className="sr-only">{moment.title} — full-screen configuration view</DialogTitle>

        <div className="relative min-h-0 flex-1">
          <DialogClose asChild>
            <button
              type="button"
              aria-label="Close"
              className={cn(
                "absolute right-4 top-[max(0.75rem,env(safe-area-inset-top))] z-[60] flex h-9 w-9 items-center justify-center rounded-sm border border-[#2a2a2a] bg-black/85 font-mono text-sm leading-none text-[#a3a3a3] backdrop-blur-sm",
                "transition hover:border-[#4a4a4a] hover:text-[#e4e4e4] focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-[#5a5a5a]",
              )}
            >
              x
            </button>
          </DialogClose>

          <PrometheanSpecificationFlipCard
            title={moment.title}
            coverImage={moment.coverImage}
            coverAlt={moment.coverAlt}
            specifications={moment.specifications}
            deploymentNotes={moment.deploymentNotes}
            flipped={flipped}
            onFlippedChange={setFlipped}
            className="h-full min-h-0"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
