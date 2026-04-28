"use client";

import type { RefObject } from "react";

export function FilesExtension({
  extensionColumnRef,
}: {
  extensionColumnRef: RefObject<HTMLDivElement>;
}) {
  return (
    <div
      ref={extensionColumnRef}
      tabIndex={-1}
      aria-label="Extension surface"
      className="cyberdeck-net-pane right flex h-full min-w-0 flex-col border-gray-800 bg-black outline-none focus-visible:ring-2 focus-visible:ring-green-500/35 focus-visible:ring-offset-2 focus-visible:ring-offset-black md:border-l"
    >
      <header className="flex shrink-0 items-center overflow-visible border-b border-gray-800 bg-black px-6 py-2">
        <div className="font-mono text-[10px] tracking-[0.08em] text-green-400">FILES EXTENSION</div>
      </header>
      <div className="custom-scrollbar flex-1 overflow-y-auto bg-black p-4">
        <div className="rounded-sm border border-green-900/70 bg-black/60 p-3 font-mono text-[10px] text-green-300/90">
          FILE WORKSPACE ONLINE
        </div>
        <div className="mt-3 font-mono text-[10px] text-green-500/80">
          Use chat commands:
          <br />
          - OPEN GATEWAY
          <br />- OPEN FILES
          <br />- OPEN MARKDOWN
        </div>
      </div>
    </div>
  );
}

