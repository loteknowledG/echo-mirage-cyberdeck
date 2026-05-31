"use client";

import dynamic from "next/dynamic";

import { GlyphCatalogPrefetch } from "@/components/providers/glyph-catalog-prefetch";

const CyberdeckApp = dynamic(() => import("@/features/cyberdeck/cyberdeck-app"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[100svh] max-h-[100svh] min-h-0 items-center justify-center bg-black font-mono text-sm text-emerald-400 md:h-screen">
      CYBERDECK // LOADING
    </div>
  ),
});

/** Client boundary — dynamic import with ssr:false must live here, not in page.tsx. */
export function CyberdeckPageClient() {
  return (
    <>
      <GlyphCatalogPrefetch />
      <CyberdeckApp />
    </>
  );
}
