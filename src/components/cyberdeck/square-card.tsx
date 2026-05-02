'use client';

import type { HTMLAttributes, PropsWithChildren } from "react";

type CyberdeckSquareCardProps = PropsWithChildren<
  HTMLAttributes<HTMLDivElement>
>;

export function CyberdeckSquareCard({
  className = "",
  children,
  ...props
}: CyberdeckSquareCardProps) {
  return (
    <div
      className={`flex aspect-square flex-col rounded-sm border border-[#1c1c1c] bg-black px-3 py-3 ${className}`.trim()}
      {...props}
    >
      {children}
    </div>
  );
}
