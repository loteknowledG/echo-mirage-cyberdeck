import type { ComponentType } from "react";
import { importCyberdeckPane, type CyberdeckPaneModule } from "@/features/cyberdeck/pane-chunks";

export type { CyberdeckPaneModule };

/** @deprecated Use importCyberdeckPane from pane-chunks. */
export function loadCyberdeckPane(kind: string): Promise<CyberdeckPaneModule> {
  return importCyberdeckPane(kind);
}
