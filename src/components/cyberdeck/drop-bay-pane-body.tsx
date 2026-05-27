"use client";

import { useState } from "react";
import { CyberdeckPaneHeader, CyberdeckPaneHeaderTitle } from "@/components/cyberdeck/pane-header";
import { useDropBayFeed } from "@/lib/dropbay/use-drop-bay-feed";
import type { Drop } from "@/lib/dropbay/dropbay-types";

function formatTimestamp(timestamp: string): string {
  try {
    return new Date(timestamp).toLocaleString();
  } catch {
    return timestamp;
  }
}

function DropRow({ drop }: { drop: Drop }) {
  return (
    <article className="rounded-sm border border-[#1c1c1c] bg-black/80 px-3 py-2">
      <div className="mb-1 flex flex-wrap items-center gap-2 font-mono text-[9px] tracking-[0.08em] text-[#666]">
        <span>{formatTimestamp(drop.timestamp)}</span>
        <span className="text-emerald-500/80">[{drop.source.toUpperCase()}]</span>
        <span className="text-amber-500/80">{drop.status.toUpperCase()}</span>
      </div>
      {drop.text ? (
        <p className="whitespace-pre-wrap break-words font-mono text-[11px] leading-snug text-[#cfcfcf]">
          {drop.text}
        </p>
      ) : null}
      {drop.url ? (
        <a
          href={drop.url}
          target="_blank"
          rel="noreferrer"
          className="mt-1 block truncate font-mono text-[10px] text-emerald-300 underline decoration-emerald-500/40 underline-offset-2"
        >
          {drop.url}
        </a>
      ) : null}
      {drop.imageUrl ? (
        <a href={drop.imageUrl} target="_blank" rel="noreferrer" className="mt-2 block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={drop.imageUrl}
            alt="Drop image"
            className="max-h-56 w-auto max-w-full rounded-sm border border-[#222] object-contain"
          />
        </a>
      ) : null}
      <div className="mt-1 font-mono text-[8px] tracking-[0.06em] text-[#444]">{drop.id}</div>
    </article>
  );
}

export function CyberdeckDropBayPaneBody() {
  const { drops, loading, connected, error } = useDropBayFeed({ limit: 100 });

  return (
    <div className="custom-scrollbar flex h-full min-h-0 flex-1 flex-col overflow-y-auto bg-black p-3">
      <div className="flex min-h-0 flex-1 flex-col rounded-sm border border-[#141414] bg-black">
        <CyberdeckPaneHeader
          left={
            <div className="flex flex-col">
              <CyberdeckPaneHeaderTitle style={{ textShadow: "0 0 6px rgba(138,138,138,0.2)" }}>
                DROP BAY
              </CyberdeckPaneHeaderTitle>
              <span className="font-mono text-[9px] tracking-[0.08em] text-[#666]">
                REACTIVE INTAKE // LOCAL RELAY
              </span>
            </div>
          }
          right={
            <span
              className={`font-mono text-[9px] tracking-[0.08em] ${
                connected ? "text-emerald-400" : "text-[#666]"
              }`}
            >
              {connected ? "SSE LIVE" : "SSE OFFLINE"}
            </span>
          }
        />
        <div className="custom-scrollbar flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3">
          {loading ? (
            <div className="font-mono text-[10px] tracking-[0.08em] text-[#666]">LOADING DROPS…</div>
          ) : null}
          {error ? (
            <div className="rounded-sm border border-red-900/50 bg-red-950/20 px-3 py-2 font-mono text-[10px] text-red-300">
              {error}
            </div>
          ) : null}
          {!loading && !error && drops.length === 0 ? (
            <div className="font-mono text-[10px] tracking-[0.08em] text-[#666]">
              NO DROPS YET. SUBMIT FROM /send OR POST /api/drop.
            </div>
          ) : null}
          {drops.map((drop) => (
            <DropRow key={drop.id} drop={drop} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default CyberdeckDropBayPaneBody;
