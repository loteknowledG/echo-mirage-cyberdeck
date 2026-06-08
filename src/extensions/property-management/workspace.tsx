"use client";

import { propertyManagementExtension } from "@/extensions/property-management/extension";
import { DepartmentRail } from "@/extensions/property-management/components/department-rail";
import { useActiveDepartment } from "@/extensions/property-management/hooks/use-active-department";
import { AccountingPanel } from "@/extensions/property-management/departments/accounting/accounting-panel";
import { DocumentsPanel } from "@/extensions/property-management/departments/documents/documents-panel";
import { InspectionsPanel } from "@/extensions/property-management/departments/inspections/inspections-panel";
import { LeasingPanel } from "@/extensions/property-management/departments/leasing/leasing-panel";
import { MaintenancePanel } from "@/extensions/property-management/departments/maintenance/maintenance-panel";
import { MapPanel } from "@/extensions/property-management/departments/map/map-panel";
import { OverviewPanel } from "@/extensions/property-management/departments/overview/overview-panel";
import { PropertiesPanel } from "@/extensions/property-management/departments/properties/properties-panel";
import type {
  DepartmentRailItem,
  PropertyManagementDepartmentId,
} from "@/extensions/property-management/types";
import { cn } from "@/lib/utils";

const DEPARTMENT_RAIL: readonly DepartmentRailItem[] = [
  { id: "overview", label: "OVERVIEW", hint: "Portfolio snapshot" },
  { id: "properties", label: "PROPERTIES", hint: "Units and buildings" },
  { id: "maintenance", label: "MAINTENANCE", hint: "Work orders" },
  { id: "leasing", label: "LEASING", hint: "Pipeline and tours" },
  { id: "accounting", label: "ACCOUNTING", hint: "Ledger and charges" },
  { id: "inspections", label: "INSPECTIONS", hint: "Checklists and reports" },
  { id: "documents", label: "DOCUMENTS", hint: "Leases and notices" },
  { id: "map", label: "MAP", hint: "Geographic view" },
] as const;

function renderDepartmentPanel(id: PropertyManagementDepartmentId) {
  switch (id) {
    case "overview":
      return <OverviewPanel />;
    case "properties":
      return <PropertiesPanel />;
    case "maintenance":
      return <MaintenancePanel />;
    case "leasing":
      return <LeasingPanel />;
    case "accounting":
      return <AccountingPanel />;
    case "inspections":
      return <InspectionsPanel />;
    case "documents":
      return <DocumentsPanel />;
    case "map":
      return <MapPanel />;
    default:
      return <OverviewPanel />;
  }
}

type PropertyManagementWorkspaceProps = {
  className?: string;
};

/** Property Management extension workspace — department rail + placeholder panels. */
export function PropertyManagementWorkspace({ className }: PropertyManagementWorkspaceProps) {
  const { activeDepartment, selectDepartment } = useActiveDepartment();

  return (
    <div
      data-extension={propertyManagementExtension.id}
      data-testid="property-management-workspace"
      className={cn("flex min-h-0 flex-1 flex-col bg-black text-[#d2ddd7]", className)}
    >
      <header className="shrink-0 border-b border-[#25352c] px-4 py-3">
        <pre className="overflow-x-auto font-mono text-[10px] leading-tight tracking-[0.04em] text-emerald-300/90">
          {propertyManagementExtension.bannerAscii}
        </pre>
        <p className="mt-2 font-mono text-[10px] tracking-[0.08em] text-[#8a9a90]">
          {propertyManagementExtension.name.toUpperCase()} // EXTENSION //{" "}
          {propertyManagementExtension.kind.toUpperCase()}
        </p>
      </header>

      <div className="flex min-h-0 flex-1">
        <DepartmentRail
          items={DEPARTMENT_RAIL}
          activeId={activeDepartment}
          onSelect={selectDepartment}
        />
        <main className="flex min-h-0 min-w-0 flex-1 flex-col p-4">
          {renderDepartmentPanel(activeDepartment)}
        </main>
      </div>
    </div>
  );
}

export default PropertyManagementWorkspace;
