"use client";

import { useCallback, useEffect, useState } from "react";
import { CaseDetail } from "@/components/property-manager/CaseDetail";
import { CaseList } from "@/components/property-manager/CaseList";
import {
  CASE_BOARD_FILTERS,
  fetchCaseBoardItems,
  fetchCaseDetail,
  type CaseBoardFilter,
  type CaseDetailPayload,
  type CaseListItem,
} from "@/lib/property-manager/cases";
import type { SelectedCaseDialerContext } from "@/lib/property-manager/call-sessions";
import { cn } from "@/lib/utils";

type CaseViewerBoardProps = {
  onSelectedCaseChange?: (selected: SelectedCaseDialerContext | null) => void;
  refreshSignal?: number;
};

/** Operations board with audited case actions. */
export function CaseViewerBoard({ onSelectedCaseChange, refreshSignal = 0 }: CaseViewerBoardProps) {
  const [filter, setFilter] = useState<CaseBoardFilter>("open");
  const [items, setItems] = useState<CaseListItem[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [detail, setDetail] = useState<CaseDetailPayload | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const loadList = useCallback(async (nextFilter: CaseBoardFilter) => {
    setListLoading(true);
    setListError(null);
    try {
      const cases = await fetchCaseBoardItems(nextFilter);
      setItems(cases);
      setSelectedSlug((current) => {
        if (current && cases.some((item) => item.slug === current)) return current;
        return cases[0]?.slug ?? null;
      });
    } catch (error) {
      setListError(error instanceof Error ? error.message : "Failed to load cases");
      setItems([]);
      setSelectedSlug(null);
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadList(filter);
  }, [filter, loadList, refreshSignal]);

  useEffect(() => {
    if (!selectedSlug) {
      setDetail(null);
      setDetailError(null);
      return;
    }

    let cancelled = false;
    setDetailLoading(true);
    setDetailError(null);

    void fetchCaseDetail(selectedSlug)
      .then((payload) => {
        if (!cancelled) setDetail(payload);
      })
      .catch((error) => {
        if (!cancelled) {
          setDetail(null);
          setDetailError(error instanceof Error ? error.message : "Failed to load case");
        }
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedSlug]);

  useEffect(() => {
    if (!onSelectedCaseChange) return;
    if (!detail?.case) {
      onSelectedCaseChange(null);
      return;
    }
    const { id, slug, title, residentName, residentPhone, propertyName, unitId } = detail.case;
    onSelectedCaseChange({ id, slug, title, residentName, residentPhone, propertyName, unitId });
  }, [detail?.case, onSelectedCaseChange]);

  const handleCaseUpdated = useCallback(
    (payload: CaseDetailPayload) => {
      setDetail(payload);
      void loadList(filter);
    },
    [filter, loadList],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
      <div className="shrink-0 rounded-sm border border-[#25352c] bg-black/75 px-2 py-2">
        <div className="mb-2 font-mono text-[8px] tracking-[0.12em] text-[#606060]">
          OPERATIONS BOARD // CASE ACTIONS AUDITED
        </div>
        <div className="flex flex-wrap gap-1">
          {CASE_BOARD_FILTERS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => setFilter(entry.id)}
              className={cn(
                "rounded-sm border px-2 py-1 font-mono text-[8px] tracking-[0.08em] transition-colors",
                filter === entry.id
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                  : "border-[#2d2d2d] text-[#8a8a8a] hover:border-[#3d3d3d]",
              )}
            >
              {entry.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 overflow-hidden lg:grid-cols-[minmax(14rem,22rem)_minmax(0,1fr)]">
        <section className="flex min-h-0 flex-col overflow-hidden rounded-sm border border-[#25352c] bg-black/70">
          <header className="shrink-0 border-b border-[#25352c] px-3 py-2 font-mono text-[9px] tracking-[0.1em] text-[#8a9a90]">
            CASES ({items.length})
          </header>
          <CaseList
            items={items}
            selectedSlug={selectedSlug}
            loading={listLoading}
            error={listError}
            onSelect={setSelectedSlug}
          />
        </section>

        <section className="flex min-h-0 flex-col overflow-hidden rounded-sm border border-[#25352c] bg-black/70">
          <header className="shrink-0 border-b border-[#25352c] px-3 py-2 font-mono text-[9px] tracking-[0.1em] text-[#8a9a90]">
            CASE DETAIL
          </header>
          <CaseDetail
            detail={detail}
            loading={detailLoading}
            error={detailError}
            onCaseUpdated={handleCaseUpdated}
          />
        </section>
      </div>
    </div>
  );
}
