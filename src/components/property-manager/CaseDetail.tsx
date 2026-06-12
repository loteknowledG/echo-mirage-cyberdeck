"use client";

import { CaseActions } from "@/components/property-manager/CaseActions";
import { CallList } from "@/components/property-manager/CallList";
import type { CaseDetailPayload } from "@/lib/property-manager/cases";
import { formatCaseClock, formatCaseLabel, severityClass } from "@/lib/property-manager/cases";

type CaseDetailProps = {
  detail: CaseDetailPayload | null;
  loading?: boolean;
  error?: string | null;
  onCaseUpdated?: (detail: CaseDetailPayload) => void;
};

function EmptySection({ label }: { label: string }) {
  return <p className="font-mono text-[9px] tracking-[0.06em] text-[#606060]">{label}</p>;
}

export function CaseDetail({ detail, loading, error, onCaseUpdated }: CaseDetailProps) {
  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 font-mono text-[10px] tracking-[0.08em] text-[#707070]">
        Loading case record…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 font-mono text-[10px] tracking-[0.06em] text-rose-300">
        {error}
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center font-mono text-[10px] tracking-[0.06em] text-[#707070]">
        <p>Select a case to inspect its operational record.</p>
        <p className="text-[9px] text-[#555]">Evidence lives on disk under data/property-manager/cases/</p>
      </div>
    );
  }

  const { case: caseRecord } = detail;

  return (
    <div className="custom-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
      <header className="rounded-sm border border-[#25352c] bg-black/80 p-3">
        <div className="font-mono text-[11px] tracking-[0.05em] text-emerald-300/90">{caseRecord.title}</div>
        <div className="mt-1 font-mono text-[9px] tracking-[0.08em] text-[#8a9a90]">
          {caseRecord.id} · {caseRecord.slug}
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-2 font-mono text-[9px] text-[#9a9a9a]">
          <div>
            <dt className="text-[#606060]">Property</dt>
            <dd>
              {caseRecord.propertyName} · Unit {caseRecord.unitId.toUpperCase()}
            </dd>
          </div>
          <div>
            <dt className="text-[#606060]">Resident</dt>
            <dd>{caseRecord.residentName ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-[#606060]">Phone</dt>
            <dd>{caseRecord.residentPhone ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-[#606060]">Category / Issue</dt>
            <dd>
              {formatCaseLabel(caseRecord.category)} · {formatCaseLabel(caseRecord.issue)}
            </dd>
          </div>
          <div>
            <dt className="text-[#606060]">Stage</dt>
            <dd>{formatCaseLabel(caseRecord.stage)}</dd>
          </div>
          <div>
            <dt className="text-[#606060]">Status</dt>
            <dd>{formatCaseLabel(caseRecord.status)}</dd>
          </div>
          <div>
            <dt className="text-[#606060]">Severity</dt>
            <dd className={severityClass(caseRecord.severity)}>
              {formatCaseLabel(caseRecord.severity)}
            </dd>
          </div>
          <div>
            <dt className="text-[#606060]">Updated</dt>
            <dd>{formatCaseClock(caseRecord.updatedAt)}</dd>
          </div>
        </dl>
        {caseRecord.assignment ? (
          <p className="mt-2 font-mono text-[9px] text-[#9a9a9a]">
            Technician: {caseRecord.assignment.technicianName}
            {caseRecord.assignment.vendor ? ` · ${caseRecord.assignment.vendor}` : ""}
          </p>
        ) : null}
        {caseRecord.eta ? (
          <p className="mt-1 font-mono text-[9px] text-[#9a9a9a]">ETA: {caseRecord.eta.value}</p>
        ) : null}
      </header>

      {onCaseUpdated ? (
        <CaseActions caseRecord={caseRecord} onUpdated={onCaseUpdated} />
      ) : null}

      <section className="rounded-sm border border-[#1c1c1c] bg-black/60 p-3">
        <h3 className="mb-2 font-mono text-[8px] tracking-[0.12em] text-[#606060]">CASE SUMMARY</h3>
        {detail.summaryMd ? (
          <pre className="whitespace-pre-wrap font-mono text-[9px] leading-relaxed text-[#b0b0b0]">
            {detail.summaryMd}
          </pre>
        ) : (
          <EmptySection label="No summary.md on disk." />
        )}
      </section>

      <section className="rounded-sm border border-[#1c1c1c] bg-black/60 p-3">
        <h3 className="mb-2 font-mono text-[8px] tracking-[0.12em] text-[#606060]">TIMELINE</h3>
        {detail.timelineMd ? (
          <pre className="whitespace-pre-wrap font-mono text-[9px] leading-relaxed text-[#b0b0b0]">
            {detail.timelineMd}
          </pre>
        ) : (
          <EmptySection label="No timeline.md on disk." />
        )}
      </section>

      <section className="rounded-sm border border-[#1c1c1c] bg-black/60 p-3">
        <h3 className="mb-2 font-mono text-[8px] tracking-[0.12em] text-[#606060]">EVENTS</h3>
        {detail.events.length > 0 ? (
          <pre className="custom-scrollbar max-h-40 overflow-auto whitespace-pre-wrap font-mono text-[9px] leading-relaxed text-[#b0b0b0]">
            {JSON.stringify(detail.events, null, 2)}
          </pre>
        ) : (
          <EmptySection label="No events.json on disk." />
        )}
      </section>

      <section className="rounded-sm border border-[#1c1c1c] bg-black/60 p-3">
        <h3 className="mb-3 font-mono text-[8px] tracking-[0.12em] text-[#606060]">CALLS</h3>
        <CallList caseSlug={caseRecord.slug} calls={detail.calls} />
      </section>

      <section className="rounded-sm border border-[#1c1c1c] bg-black/60 p-3">
        <h3 className="mb-2 font-mono text-[8px] tracking-[0.12em] text-[#606060]">CASE.JSON</h3>
        <pre className="custom-scrollbar max-h-56 overflow-auto whitespace-pre-wrap font-mono text-[9px] leading-relaxed text-[#b0b0b0]">
          {JSON.stringify(caseRecord, null, 2)}
        </pre>
      </section>
    </div>
  );
}
