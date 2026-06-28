"use client";

import { useCallback, useEffect, useState } from "react";
import { CyberdeckActionButton } from "@/components/cyberdeck/cyberdeck-control-button";
import { EspionageMirageHubPanel } from "@/components/cyberdeck/espionage-mirage-hub-panel";
import {
  ESPIONAGE_MIRAGE_DISPLAY,
  ESPIONAGE_MIRAGE_TAGLINE,
  ESPIONAGE_MODE_TITLE,
  readEspionageNodeRole,
  writeEspionageNodeRole,
  type EspionageNodeRole,
} from "@/lib/cyberdeck/espionage-mode";
import { ESPIONAGE_SILENT_CAPTURE_PROMPT } from "@/lib/cyberdeck/powerfist-mission.types";
import { useSpyContext } from "@/lib/cyberdeck/spy-context";

export function SpyMiragePane() {
  const { capture, analysis, analysisError, analyzing, setAnalysis, setAnalyzing } = useSpyContext();
  const [role, setRole] = useState<EspionageNodeRole>("off");
  const [showHub, setShowHub] = useState(true);

  useEffect(() => {
    setRole(readEspionageNodeRole());
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (!capture.pngBase64) return;
    setAnalyzing(true);
    setAnalysis(null, null);
    try {
      const res = await fetch("/api/spy/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pngBase64: capture.pngBase64,
          prompt: ESPIONAGE_SILENT_CAPTURE_PROMPT,
          provider: "openai",
        }),
      });
      const payload = (await res.json()) as { ok?: boolean; text?: string; error?: string };
      if (!payload.ok || !payload.text) {
        setAnalysis(null, payload.error || "Analysis failed.");
        return;
      }
      setAnalysis(payload.text, null);
    } catch {
      setAnalysis(null, "Analysis request failed.");
    } finally {
      setAnalyzing(false);
    }
  }, [capture.pngBase64, setAnalysis, setAnalyzing]);

  const handleRoleMirage = useCallback(() => {
    writeEspionageNodeRole("mirage");
    setRole("mirage");
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-4 font-mono text-[10px] tracking-[0.04em] text-[#707070]">
      <div>
        <p className="text-fuchsia-300/90">{ESPIONAGE_MODE_TITLE} // {ESPIONAGE_MIRAGE_DISPLAY}</p>
        <p className="mt-1 text-[9px] text-[#6a6a8a]">{ESPIONAGE_MIRAGE_TAGLINE}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <CyberdeckActionButton disabled={role === "mirage"} onClick={handleRoleMirage}>
          This is {ESPIONAGE_MIRAGE_DISPLAY}
        </CyberdeckActionButton>
        <CyberdeckActionButton onClick={() => setShowHub((prev) => !prev)}>
          {showHub ? "Hide hub pairing" : "Show hub pairing"}
        </CyberdeckActionButton>
        <CyberdeckActionButton
          disabled={!capture.pngBase64 || analyzing}
          onClick={() => void handleAnalyze()}
        >
          {analyzing ? "Analyzing…" : "Analyze capture"}
        </CyberdeckActionButton>
      </div>

      {showHub ? (
        <div className="rounded border border-[#1c1c1c] bg-black/60 p-3">
          <EspionageMirageHubPanel />
        </div>
      ) : null}

      {capture.imageDataUrl ? (
        <div className="flex flex-col gap-2">
          <p className="text-[9px] text-[#8a8a8a]">
            CAPTURE // {capture.capturedAt ? new Date(capture.capturedAt).toLocaleTimeString() : "—"}
            {capture.missionId ? ` // mission ${capture.missionId.slice(0, 8)}…` : ""}
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={capture.imageDataUrl}
            alt="Spy capture"
            className="max-h-64 w-full rounded border border-[#2d2d2d] object-contain bg-[#0a0a0a]"
          />
        </div>
      ) : (
        <p className="text-[9px] text-[#5f5f5f]">
          No capture yet — use Echo sub-pane or wait for an ingested mission.
        </p>
      )}

      {analysisError ? <p className="text-red-300/90">{analysisError}</p> : null}
      {analysis ? (
        <div className="rounded border border-[#2d2d2d] bg-black/80 p-3 text-[10px] leading-relaxed text-[#cfcfcf] whitespace-pre-wrap">
          {analysis}
        </div>
      ) : null}
    </div>
  );
}
