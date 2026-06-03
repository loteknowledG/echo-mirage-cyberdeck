"use client";

import dynamic from "next/dynamic";

import { CyberdeckStartupLoader } from "@/components/cyberdeck/cyberdeck-startup-loader";
import { GlyphCatalogPrefetch } from "@/components/providers/glyph-catalog-prefetch";

const CyberdeckApp = dynamic(() => import("@/features/cyberdeck/cyberdeck-app"), {
  ssr: false,
  loading: () => <CyberdeckStartupLoader />,
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
