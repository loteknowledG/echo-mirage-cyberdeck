"use client";

import dynamic from "next/dynamic";
import { Component, type ErrorInfo, type ReactNode } from "react";

import { CyberdeckStartupLoader } from "@/components/cyberdeck/cyberdeck-startup-loader";
import { SurveyCaptureDeckHost } from "@/components/cyberdeck/survey-capture-deck-host";
import { SurveyEmpLaunchHost } from "@/components/cyberdeck/survey-emp-launch-host";
import { SurveyExtensionPageContextHost } from "@/components/cyberdeck/survey-extension-page-context-host";
import { GlyphCatalogPrefetch } from "@/components/providers/glyph-catalog-prefetch";

const CyberdeckApp = dynamic(() => import("@/features/cyberdeck/cyberdeck-app"), {
  ssr: false,
  loading: () => <CyberdeckStartupLoader />,
});

type CyberdeckErrorBoundaryProps = {
  children: ReactNode;
};

type CyberdeckErrorBoundaryState = {
  hasError: boolean;
};

class CyberdeckErrorBoundary extends Component<
  CyberdeckErrorBoundaryProps,
  CyberdeckErrorBoundaryState
> {
  state: CyberdeckErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[cyberdeck] app render error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-[100svh] w-full items-center justify-center bg-black px-4 text-emerald-300">
          <div className="w-full max-w-md border border-[#1f1f1f] bg-black/95 p-4 font-mono text-xs">
            <div className="mb-2 text-emerald-300">CYBERDECK // APP ERROR</div>
            <div className="text-[#7a7a7a]">The client hit a render fault. Retry without full reload first.</div>
            <button
              type="button"
              className="mt-3 border border-[#2d2d2d] px-3 py-1 text-[11px] text-emerald-300 hover:bg-[#111]"
              onClick={() => this.setState({ hasError: false })}
            >
              Retry Mount
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/** Client boundary — dynamic import with ssr:false must live here, not in page.tsx. */
export function CyberdeckPageClient() {
  return (
    <>
      <GlyphCatalogPrefetch />
      <SurveyCaptureDeckHost />
      <SurveyEmpLaunchHost />
      <SurveyExtensionPageContextHost />
      <CyberdeckErrorBoundary>
        <CyberdeckApp />
      </CyberdeckErrorBoundary>
    </>
  );
}
