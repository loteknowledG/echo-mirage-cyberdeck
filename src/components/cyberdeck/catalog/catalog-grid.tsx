'use client';

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type CatalogGridProps = {
  children: ReactNode;
  className?: string;
};

/**
 * Responsive manifest grid: 1 col (narrow) → 2 (tablet) → 3–5 (desktop widths).
 * Does not use .cyberdeck-square-grid so column intent is not overridden by auto-fit.
 */
export function CatalogGrid({ children, className }: CatalogGridProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 min-[1700px]:grid-cols-5",
        className,
      )}
    >
      {children}
    </div>
  );
}
