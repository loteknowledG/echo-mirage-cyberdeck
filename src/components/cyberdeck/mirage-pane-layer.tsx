"use client";

import { memo, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type MiragePaneLayerProps = {
  visible: boolean;
  className?: string;
  /** Bump when pane content identity changes (e.g. tab kind convert) while staying visible. */
  paneKey?: string;
  "aria-hidden"?: boolean;
  children: ReactNode;
};

/** Skip React work for hidden keep-alive panes (dev perf). */
export const MiragePaneLayer = memo(function MiragePaneLayer({
  visible,
  className,
  paneKey,
  "aria-hidden": ariaHidden,
  children,
}: MiragePaneLayerProps) {
  return (
    <div
      className={cn(
        className,
        !visible && "hidden",
      )}
      aria-hidden={ariaHidden ?? !visible}
    >
      {children}
    </div>
  );
}, (prev, next) => {
  if (!prev.visible && !next.visible) return true;
  return (
    prev.visible === next.visible &&
    prev.className === next.className &&
    prev.paneKey === next.paneKey
  );
});
