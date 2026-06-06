import { DepartmentPanelFrame } from "@/extensions/property-management/components/department-panel-frame";

export function PropertiesPanel() {
  return (
    <DepartmentPanelFrame departmentLabel="PROPERTIES" title="Units and buildings">
      <p className="text-[#8a9a90]">
        Placeholder properties registry — buildings, units, owners, and occupancy will render here.
      </p>
    </DepartmentPanelFrame>
  );
}
