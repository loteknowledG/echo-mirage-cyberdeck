"use client";

import type { SVGProps } from "react";
import { resolveIcon, type Icon } from "@wikimedia/codex-icons";
import { cn } from "@/lib/utils";

type CodexIconProps = Omit<SVGProps<SVGSVGElement>, "children" | "dangerouslySetInnerHTML"> & {
  icon: Icon;
  langCode?: string;
  dir?: "ltr" | "rtl" | "auto";
};

export function CodexIcon({
  icon,
  langCode = "en",
  dir = "ltr",
  className,
  "aria-hidden": ariaHidden = true,
  focusable = false,
  ...props
}: CodexIconProps) {
  const resolved = resolveIcon(icon, langCode, dir);
  const markup = typeof resolved === "string" ? resolved : resolved.path;

  return (
    <svg
      viewBox="0 0 20 20"
      aria-hidden={ariaHidden}
      focusable={focusable}
      className={cn("inline-block h-4 w-4 fill-current", className)}
      dangerouslySetInnerHTML={{ __html: markup }}
      {...props}
    />
  );
}
