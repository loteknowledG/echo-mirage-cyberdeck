"use client";

import { useEffect, useState } from "react";
import { CyberdeckActionButton } from "@/components/cyberdeck/action-button";
import type { CaseCallDetailPayload, CaseCallListItem } from "@/lib/property-manager/cases";
import { fetchCaseCallDetail, formatCaseClock } from "@/lib/property-manager/cases";
import { cn } from "@/lib/utils";

type CallListProps = {
  caseSlug: string;
  calls: CaseCallListItem[];
};

function CallEvidencePanel({
  caseSlug,
  callId,
  onClose,
}: {
  caseSlug: string;
  callId: string;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<CaseCallDetailPayload | null>(null);
  const [view, setView] = useState<"summary" | "transcript" | "json">("summary");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchCaseCallDetail(caseSlug, callId)
      .then((payload) => {
        if (!cancelled) setDetail(payload);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load call");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [caseSlug, callId]);

  return (
    <div className="mt-2 rounded-sm border border-[#25352c] bg-black/80 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="font-mono text-[9px] tracking-[0.1em] text-emerald-300/90">{callId}</div>
        <CyberdeckActionButton variant="neutral" onClick={onClose}>
          Close
        </CyberdeckActionButton>
      </div>
      <div className="mb-2 flex flex-wrap gap-1">
        {(["summary", "transcript", "json"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setView(tab)}
            className={cn(
              "rounded-sm border px-2 py-1 font-mono text-[8px] tracking-[0.08em]",
              view === tab
                ? "border-emerald-500/40 text-emerald-300"
                : "border-[#2d2d2d] text-[#8a8a8a] hover:border-[#3d3d3d]",
            )}
          >
            {tab === "json" ? "JSON" : tab.toUpperCase()}
          </button>
        ))}
      </div>
      {loading ? (
        <p className="font-mono text-[9px] text-[#707070]">Loading call evidence…</p>
      ) : error ? (
        <p className="font-mono text-[9px] text-rose-300">{error}</p>
      ) : view === "summary" ? (
        <pre className="custom-scrollbar max-h-48 overflow-auto whitespace-pre-wrap font-mono text-[9px] leading-relaxed text-[#b0b0b0]">
          {detail?.summaryMd ?? "No call summary saved."}
        </pre>
      ) : view === "transcript" ? (
        <pre className="custom-scrollbar max-h-64 overflow-auto whitespace-pre-wrap font-mono text-[9px] leading-relaxed text-[#b0b0b0]">
          {detail?.transcriptMd ?? "No transcript saved."}
        </pre>
      ) : (
        <pre className="custom-scrollbar max-h-64 overflow-auto whitespace-pre-wrap font-mono text-[9px] leading-relaxed text-[#b0b0b0]">
          {detail?.transcriptJson
            ? JSON.stringify(detail.transcriptJson, null, 2)
            : "No JSON transcript saved."}
        </pre>
      )}
    </div>
  );
}

export function CallList({ caseSlug, calls }: CallListProps) {
  const [expandedCallId, setExpandedCallId] = useState<string | null>(null);

  if (calls.length === 0) {
    return (
      <p className="font-mono text-[9px] tracking-[0.06em] text-[#707070]">No calls recorded for this case.</p>
    );
  }

  return (
    <div className="space-y-2">
      {calls.map((call) => (
        <article key={call.callId} className="rounded-sm border border-[#1c1c1c] bg-black/60 p-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="font-mono text-[10px] tracking-[0.06em] text-[#d0d0d0]">{call.callId}</div>
              <div className="mt-1 font-mono text-[8px] tracking-[0.06em] text-[#707070]">
                {formatCaseClock(call.startedAt)} → {formatCaseClock(call.endedAt)}
              </div>
            </div>
            <CyberdeckActionButton
              variant="neutral"
              onClick={() =>
                setExpandedCallId((current) => (current === call.callId ? null : call.callId))
              }
            >
              {expandedCallId === call.callId ? "Hide" : "Open evidence"}
            </CyberdeckActionButton>
          </div>
          {call.summaryMd ? (
            <div className="mt-2">
              <div className="mb-1 font-mono text-[8px] tracking-[0.08em] text-[#606060]">Call summary</div>
              <p className="line-clamp-3 whitespace-pre-wrap font-mono text-[9px] leading-relaxed text-[#9a9a9a]">
                {call.summaryMd.replace(/^# Call Summary\s*/i, "").trim()}
              </p>
            </div>
          ) : (
            <p className="mt-2 font-mono text-[9px] text-[#606060]">No call summary on disk.</p>
          )}
          <div className="mt-2 flex flex-wrap gap-1 font-mono text-[8px] tracking-[0.06em] text-[#707070]">
            <span>{call.hasTranscriptMd ? "Open transcript option" : "Transcript unavailable"}</span>
            <span>{call.hasTranscriptJson ? "Open JSON transcript option" : "JSON transcript unavailable"}</span>
          </div>
          {expandedCallId === call.callId ? (
            <CallEvidencePanel
              caseSlug={caseSlug}
              callId={call.callId}
              onClose={() => setExpandedCallId(null)}
            />
          ) : null}
        </article>
      ))}
    </div>
  );
}
