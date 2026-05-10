'use client';

import type { KeyboardEvent } from "react";
import { cn } from "@/lib/utils";

export type CatalogCardProps = {
  title: string;
  coverImage: string;
  coverAlt: string;
  configurationId?: string;
  className?: string;
  onOpen: () => void;
};

export function CatalogCard({
  title,
  coverImage,
  coverAlt,
  configurationId,
  className,
  onOpen,
}: CatalogCardProps) {
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpen();
    }
  };

  return (
    <button
      type="button"
      onClick={onOpen}
      onKeyDown={onKeyDown}
      className={cn(
        "group relative block w-full overflow-hidden rounded-sm border border-[#1a1a1a] bg-[#050505] text-left shadow-none outline-none",
        "aspect-square transition-[transform,box-shadow,border-color] duration-300 ease-out",
        "hover:border-[#2a2a2a] hover:shadow-[0_0_0_1px_rgba(255,255,255,0.04)_inset,0_12px_40px_rgba(0,0,0,0.45)]",
        "focus-visible:border-[#3d3d3d] focus-visible:ring-1 focus-visible:ring-[#5c5c5c]/50",
        "active:scale-[0.992]",
        className,
      )}
    >
      <span className="sr-only">Open configuration details for {title}</span>
      <img
        src={coverImage}
        alt={coverAlt}
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
        draggable={false}
      />
      <div
        className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-black/10"
        aria-hidden
      />
      <div
        className="absolute inset-x-0 bottom-0 backdrop-blur-[2px]"
        style={{
          maskImage: "linear-gradient(to top, black 55%, transparent)",
          WebkitMaskImage: "linear-gradient(to top, black 55%, transparent)",
        }}
        aria-hidden
      />
      <div className="absolute inset-x-0 bottom-0 flex flex-col justify-end p-3 sm:p-4">
        {configurationId ? (
          <div className="mb-1 font-mono text-[8px] tracking-[0.16em] text-[#6a6a6a] sm:text-[9px]">
            {configurationId}
          </div>
        ) : null}
        <div className="font-mono text-[11px] leading-tight tracking-[0.12em] text-[#d4d4d4] sm:text-xs">
          {title}
        </div>
      </div>
    </button>
  );
}
