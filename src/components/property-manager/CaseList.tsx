"use client";

import { CaseCard } from "@/components/property-manager/CaseCard";
import type { CaseListItem } from "@/lib/property-manager/cases";

type CaseListProps = {
  items: CaseListItem[];
  selectedSlug: string | null;
  loading?: boolean;
  error?: string | null;
  onSelect: (slug: string) => void;
};

export function CaseList({ items, selectedSlug, loading, error, onSelect }: CaseListProps) {
  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 font-mono text-[10px] tracking-[0.08em] text-[#707070]">
        Loading cases…
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

  if (items.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center font-mono text-[10px] tracking-[0.06em] text-[#707070]">
        <p>No cases match this filter.</p>
        <p className="text-[9px] text-[#555]">Run a call simulation to create case evidence on disk.</p>
      </div>
    );
  }

  return (
    <div className="custom-scrollbar min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
      {items.map((item) => (
        <CaseCard
          key={item.slug}
          item={item}
          selected={selectedSlug === item.slug}
          onSelect={() => onSelect(item.slug)}
        />
      ))}
    </div>
  );
}
