'use client';

import type { ButtonHTMLAttributes, PropsWithChildren } from "react";

type CyberdeckActionButtonProps = PropsWithChildren<
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: "neutral" | "accent" | "danger";
  }
>;

const VARIANT_CLASSNAMES: Record<NonNullable<CyberdeckActionButtonProps["variant"]>, string> = {
  neutral:
    "border-[#2d2d2d] bg-black text-[#8a8a8a] hover:border-emerald-500/60 hover:text-emerald-200",
  accent:
    "border-emerald-500/70 bg-emerald-500/10 text-emerald-200 hover:border-emerald-400 hover:text-emerald-100",
  danger:
    "border-[#2d2d2d] bg-black text-[#8a8a8a] hover:border-red-500/60 hover:text-red-200",
};

export function CyberdeckActionButton({
  variant = "neutral",
  className = "",
  children,
  ...props
}: CyberdeckActionButtonProps) {
  return (
    <button
      className={`rounded border px-2 py-2 font-mono text-[9px] tracking-[0.08em] transition ${VARIANT_CLASSNAMES[variant]} ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  );
}
