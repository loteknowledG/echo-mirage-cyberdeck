import { DepartmentPanelFrame } from "@/extensions/property-management/components/department-panel-frame";

export function InspectionsPanel() {
  return (
    <DepartmentPanelFrame departmentLabel="INSPECTIONS" title="Checklists and reports">
      <p className="text-[#8a9a90]">
        Placeholder inspections — move-in/out checklists and photo reports will render here.
      </p>
    </DepartmentPanelFrame>
  );
}
