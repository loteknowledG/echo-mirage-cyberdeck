"use client";

import dynamic from "next/dynamic";

const CyberdeckApp = dynamic(() => import("@/features/cyberdeck/cyberdeck-app"), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen min-h-0 items-center justify-center bg-black font-mono text-sm text-emerald-400">
      CYBERDECK // LOADING
    </div>
  ),
});

/** Client boundary — dynamic import with ssr:false must live here, not in page.tsx. */
export function CyberdeckPageClient() {
  return <CyberdeckApp />;
}
