import type { SurfaceClassification } from "./surface-classifier";

let currentSurfaceClassification: SurfaceClassification | null = null;
let lastCaptureTimestamp: string | null = null;
let captureSource: "auto" | "manual" | null = null;

export function setLastSurfaceClassification(classification: SurfaceClassification): void {
  currentSurfaceClassification = classification;
  lastCaptureTimestamp = new Date().toISOString();
}

export function getLastSurfaceClassification(): SurfaceClassification | null {
  return currentSurfaceClassification;
}

export function getLastCaptureTimestamp(): string | null {
  return lastCaptureTimestamp;
}

export function getCaptureSource(): "auto" | "manual" | null {
  return captureSource;
}

export function setCaptureSource(source: "auto" | "manual"): void {
  captureSource = source;
}

export function clearSurfaceInspection(): void {
  currentSurfaceClassification = null;
  lastCaptureTimestamp = null;
  captureSource = null;
}

export function hasRecentInspection(maxAgeMs = 30_000): boolean {
  if (!lastCaptureTimestamp) return false;
  const age = Date.now() - new Date(lastCaptureTimestamp).getTime();
  return age < maxAgeMs;
}

export function getInspectionSummary(): {
  classified: boolean;
  surface: string | null;
  confidence: string | null;
  timestamp: string | null;
  source: string | null;
} {
  if (!currentSurfaceClassification) {
    return { classified: false, surface: null, confidence: null, timestamp: null, source: null };
  }
  return {
    classified: true,
    surface: currentSurfaceClassification.surface,
    confidence: currentSurfaceClassification.confidence,
    timestamp: lastCaptureTimestamp,
    source: captureSource,
  };
}