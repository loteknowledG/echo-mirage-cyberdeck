"use client";

import type { CaseListItem } from "@/lib/property-manager/cases";
import { formatCaseClock, formatCaseLabel, severityClass } from "@/lib/property-manager/cases";
import { cn } from "@/lib/utils";

type CaseCardProps = {
  item: CaseListItem;
  selected?: boolean;
  onSelect: () => void;
};

export function CaseCard({ item, selected, onSelect }: CaseCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full rounded-sm border p-3 text-left transition-colors",
        selected
          ? "border-emerald-500/45 bg-emerald-500/8"
          : "border-[#25352c] bg-black/70 hover:border-emerald-500/30",
      )}
    >
      <div className="font-mono text-[11px] tracking-[0.04em] text-[#e0e0e0]">{item.title}</div>
      <div className="mt-1 font-mono text-[9px] tracking-[0.06em] text-[#8a9a90]">
        {item.propertyName} · Unit {item.unitId.toUpperCase()}
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-[9px] tracking-[0.05em] text-[#9a9a9a]">
        <div>
          <dt className="text-[#606060]">Stage</dt>
          <dd>{formatCaseLabel(item.stage)}</dd>
        </div>
        <div>
          <dt className="text-[#606060]">Status</dt>
          <dd>{formatCaseLabel(item.status)}</dd>
        </div>
        <div>
          <dt className="text-[#606060]">Severity</dt>
          <dd className={severityClass(item.severity)}>{formatCaseLabel(item.severity)}</dd>
        </div>
        <div>
          <dt className="text-[#606060]">Last Contact</dt>
          <dd>{formatCaseClock(item.lastContactAt)}</dd>
        </div>
        <div>
          <dt className="text-[#606060]">Calls</dt>
          <dd>{item.callCount}</dd>
        </div>
      </dl>
      {item.tags.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1">
          {item.tags.slice(0, 6).map((tag) => (
            <span
              key={tag}
              className="rounded-sm border border-[#2d2d2d] px-1.5 py-0.5 font-mono text-[8px] tracking-[0.06em] text-[#8a8a8a]"
            >
              {tag}
            </span>
          ))}
        </div>
      ) : null}
    </button>
  );
}
