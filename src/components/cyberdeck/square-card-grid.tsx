'use client';

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type CyberdeckSquareCardGridProps = {
  children: ReactNode;
  className?: string;
};

export function CyberdeckSquareCardGrid({ children, className }: CyberdeckSquareCardGridProps) {
  return <div className={cn("cyberdeck-square-grid mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4", className)}>{children}</div>;
}
