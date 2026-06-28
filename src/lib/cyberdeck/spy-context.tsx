"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export type SpySubPane = "echo" | "mirage" | "powerfist";

export type SpyCaptureState = {
  missionId: string | null;
  pngBase64: string | null;
  imageDataUrl: string | null;
  capturedAt: string | null;
};

type SpyContextValue = {
  activeSubPane: SpySubPane;
  setActiveSubPane: (pane: SpySubPane) => void;
  capture: SpyCaptureState;
  setCapture: (next: Partial<SpyCaptureState>) => void;
  clearCapture: () => void;
  analysis: string | null;
  analysisError: string | null;
  analyzing: boolean;
  setAnalysis: (text: string | null, error?: string | null) => void;
  setAnalyzing: (busy: boolean) => void;
};

const EMPTY_CAPTURE: SpyCaptureState = {
  missionId: null,
  pngBase64: null,
  imageDataUrl: null,
  capturedAt: null,
};

const SpyContext = createContext<SpyContextValue | null>(null);

export function SpyProvider({ children }: { children: ReactNode }) {
  const [activeSubPane, setActiveSubPane] = useState<SpySubPane>("mirage");
  const [capture, setCaptureState] = useState<SpyCaptureState>(EMPTY_CAPTURE);
  const [analysis, setAnalysisText] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const setCapture = useCallback((next: Partial<SpyCaptureState>) => {
    setCaptureState((prev) => ({ ...prev, ...next }));
  }, []);

  const clearCapture = useCallback(() => {
    setCaptureState(EMPTY_CAPTURE);
    setAnalysisText(null);
    setAnalysisError(null);
  }, []);

  const setAnalysis = useCallback((text: string | null, error: string | null = null) => {
    setAnalysisText(text);
    setAnalysisError(error);
  }, []);

  const value = useMemo(
    () => ({
      activeSubPane,
      setActiveSubPane,
      capture,
      setCapture,
      clearCapture,
      analysis,
      analysisError,
      analyzing,
      setAnalysis,
      setAnalyzing,
    }),
    [
      activeSubPane,
      capture,
      analysis,
      analysisError,
      analyzing,
      setCapture,
      clearCapture,
      setAnalysis,
    ],
  );

  return <SpyContext.Provider value={value}>{children}</SpyContext.Provider>;
}

export function useSpyContext(): SpyContextValue {
  const ctx = useContext(SpyContext);
  if (!ctx) {
    throw new Error("useSpyContext must be used within SpyProvider");
  }
  return ctx;
}
