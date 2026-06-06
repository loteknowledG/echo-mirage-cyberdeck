"use client";

import type {
  DepartmentRailItem,
  PropertyManagementDepartmentId,
} from "@/extensions/property-management/types";

type DepartmentRailProps = {
  items: readonly DepartmentRailItem[];
  activeId: PropertyManagementDepartmentId;
  onSelect: (id: PropertyManagementDepartmentId) => void;
};

export function DepartmentRail({ items, activeId, onSelect }: DepartmentRailProps) {
  return (
    <nav
      aria-label="Property management departments"
      className="flex shrink-0 flex-col gap-1 border-r border-[#25352c] bg-black/90 p-2"
    >
      {items.map((item) => {
        const active = item.id === activeId;
        return (
          <button
            key={item.id}
            type="button"
            title={item.hint}
            aria-current={active ? "page" : undefined}
            onClick={() => onSelect(item.id)}
            className={`rounded-sm border px-2 py-2 text-left font-mono text-[10px] tracking-[0.06em] transition ${
              active
                ? "border-emerald-500/70 bg-emerald-950/40 text-emerald-200"
                : "border-[#25352c] text-[#8a9a90] hover:border-emerald-900/60 hover:text-emerald-200/90"
            }`}
          >
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}
