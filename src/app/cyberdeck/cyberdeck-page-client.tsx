"use client";

import dynamic from "next/dynamic";
import { Component, type ErrorInfo, type ReactNode } from "react";

import { CyberdeckStartupLoader } from "@/components/cyberdeck/cyberdeck-startup-loader";
import { SurveyCaptureDeckHost } from "@/components/cyberdeck/survey-capture-deck-host";
import { SurveyEmpLaunchHost } from "@/components/cyberdeck/survey-emp-launch-host";
import { SurveyExtensionPageContextHost } from "@/components/cyberdeck/survey-extension-page-context-host";
import { UI_STATE_STORAGE_KEY } from "@/features/cyberdeck/workspace/cyberdeck-ui-state";
import { GlyphCatalogPrefetch } from "@/components/providers/glyph-catalog-prefetch";
import { WORKSPACE_STATE_STORAGE_KEY } from "@/lib/workspace-state";

const CyberdeckApp = dynamic(() => import("@/features/cyberdeck/cyberdeck-app"), {
  ssr: false,
  loading: () => <CyberdeckStartupLoader />,
});

type CyberdeckErrorBoundaryProps = {
  children: ReactNode;
};

type CyberdeckErrorBoundaryState = {
  hasError: boolean;
  errorMessage: string | null;
};

const CYBERDECK_LAYOUT_RECOVERY_KEYS = [
  UI_STATE_STORAGE_KEY,
  WORKSPACE_STATE_STORAGE_KEY,
  "cyberdeck-content-split-v3:horizontal:2",
  "cyberdeck-content-split-v3:vertical:2",
  "muthur-composer-split-v1:vertical:2",
] as const;

class CyberdeckErrorBoundary extends Component<
  CyberdeckErrorBoundaryProps,
  CyberdeckErrorBoundaryState
> {
  state: CyberdeckErrorBoundaryState = { hasError: false, errorMessage: null };

  static getDerivedStateFromError(error: unknown): CyberdeckErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error instanceof Error ? error.message : "Unknown client render error",
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[cyberdeck] app render error", error, errorInfo);
  }

  private reloadApp = () => {
    window.location.reload();
  };

  private resetLayoutAndReload = () => {
    try {
      for (const key of CYBERDECK_LAYOUT_RECOVERY_KEYS) {
        window.localStorage.removeItem(key);
      }
    } catch {
      /* Reload even if browser storage is unavailable. */
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-[100svh] w-full items-center justify-center bg-black px-4 text-emerald-300">
          <div className="w-full max-w-md border border-[#1f1f1f] bg-black/95 p-4 font-mono text-xs">
            <div className="mb-2 text-emerald-300">CYBERDECK // APP ERROR</div>
            <div className="text-[#7a7a7a]">The client hit a render fault.</div>
            {this.state.errorMessage ? (
              <div className="mt-2 break-words text-[10px] text-red-300/80" role="alert">
                {this.state.errorMessage}
              </div>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className="border border-[#2d2d2d] px-3 py-1 text-[11px] text-emerald-300 hover:bg-[#111]"
                onClick={this.reloadApp}
              >
                Reload App
              </button>
              <button
                type="button"
                className="border border-[#2d2d2d] px-3 py-1 text-[11px] text-amber-200 hover:bg-[#111]"
                onClick={this.resetLayoutAndReload}
              >
                Reset Layout &amp; Reload
              </button>
            </div>
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
