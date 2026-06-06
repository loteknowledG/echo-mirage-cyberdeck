import { DepartmentPanelFrame } from "@/extensions/property-management/components/department-panel-frame";

export function MapPanel() {
  return (
    <DepartmentPanelFrame departmentLabel="MAP" title="Geographic view">
      <p className="text-[#8a9a90]">
        Placeholder map canvas — property pins and service zones will render here. No Mapbox
        integration yet.
      </p>
    </DepartmentPanelFrame>
  );
}
