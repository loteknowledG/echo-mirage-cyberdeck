"use client";

import { PreviewMatrix } from "@/app/preview/preview-matrix";
import "@/app/preview/preview-matrix.css";

/** Embedded /preview Rola Dex matrix for the MIRAGE cyberdeck pane. */
export function CyberdeckRolaDexPaneBody() {
  return (
    <div className="cyberdeck-rola-dex-pane custom-scrollbar flex min-h-0 min-w-0 flex-1 flex-col overflow-auto bg-[#050807]">
      <div className="powerfist-preview-layout min-h-0 w-full flex-1">
        <PreviewMatrix />
      </div>
    </div>
  );
}
