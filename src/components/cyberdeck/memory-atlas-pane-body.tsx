"use client";

import { useEffect, useState } from "react";
import {
  CyberdeckPaneHeader,
  CyberdeckPaneHeaderSubtitle,
  CyberdeckPaneHeaderTitle,
} from "@/components/cyberdeck/pane-header";
import {
  MUTHUR_MEMORY_STORAGE_KEY,
  createEmptyMuthurMemory,
  loadMuthurMemoryWithResult,
  type MuthurMemoryState,
} from "@/lib/muthur-memory";

function iso(at: number) {
  if (!at) return "—";
  try {
    return new Date(at).toISOString();
  } catch {
    return String(at);
  }
}

export function CyberdeckMemoryAtlasPaneBody() {
  const [memory, setMemory] = useState<MuthurMemoryState>(() => createEmptyMuthurMemory());
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void loadMuthurMemoryWithResult().then((result) => {
      if (cancelled) return;
      setMemory(result.state);
      setLoadError(result.error);
      setHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="custom-scrollbar flex h-full min-h-0 flex-1 flex-col overflow-y-auto bg-black p-3">
      <div className="flex min-h-0 flex-1 flex-col rounded-sm border border-[#141414] bg-black transition-colors">
        <CyberdeckPaneHeader
          left={
            <div className="flex flex-col">
              <CyberdeckPaneHeaderTitle style={{ textShadow: "0 0 6px rgba(138,138,138,0.2)" }}>
                MEMORY ATLAS
              </CyberdeckPaneHeaderTitle>
              <CyberdeckPaneHeaderSubtitle>MUTHUR RECALL // READ ONLY</CyberdeckPaneHeaderSubtitle>
            </div>
          }
        />
        <div className="custom-scrollbar flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3 font-mono text-[10px]">
          <div className="rounded-sm border border-[#1c1c1c] bg-black/80 p-3 text-[#bdbdbd]">
            STORAGE_KEY: {MUTHUR_MEMORY_STORAGE_KEY}
            <br />
            HYDRATED: {hydrated ? "YES" : "NO"}
            <br />
            UPDATED_AT: {iso(memory.updatedAt)}
            <br />
            TURN_COUNT: {memory.turnCount}
          </div>
          <div className="rounded-sm border border-[#1c1c1c] bg-black/80 p-3 text-[#d5d5d5]">
            <div className="mb-2 text-[#8a8a8a]">SUMMARY</div>
            <div className="text-green-200/90">{memory.summary || "No summary present."}</div>
          </div>
          <div className="rounded-sm border border-[#1c1c1c] bg-black/80 p-3 text-[#d5d5d5]">
            <div className="mb-2 text-[#8a8a8a]">FACT LIST ({memory.facts.length})</div>
            <ul className="list-inside list-disc space-y-1 text-green-200/90">
              {memory.facts.length === 0 ? <li>NO FACTS INDEXED.</li> : memory.facts.map((fact) => <li key={fact}>{fact}</li>)}
            </ul>
          </div>
          <div className="rounded-sm border border-[#1c1c1c] bg-black/80 p-3 text-[#d5d5d5]">
            <div className="mb-2 text-[#8a8a8a]">RECENT TURNS ({memory.recentTurns.length})</div>
            <div className="custom-scrollbar max-h-[28vh] overflow-y-auto space-y-1">
              {memory.recentTurns.length === 0
                ? "NO TURN HISTORY."
                : memory.recentTurns.map((turn) => (
                    <div key={turn.id} className="text-[9px] leading-relaxed text-[#cfcfcf]">
                      [{iso(turn.at)}] {turn.role.toUpperCase()} :: {turn.text}
                    </div>
                  ))}
            </div>
          </div>
          {loadError ? (
            <div className="rounded-sm border border-amber-900/60 bg-amber-950/25 p-3 text-[9px] leading-relaxed text-amber-200/90">
              IndexedDB read error: {loadError}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
