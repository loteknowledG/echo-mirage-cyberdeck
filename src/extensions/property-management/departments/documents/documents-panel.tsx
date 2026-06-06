import { DepartmentPanelFrame } from "@/extensions/property-management/components/department-panel-frame";

export function DocumentsPanel() {
  return (
    <DepartmentPanelFrame departmentLabel="DOCUMENTS" title="Leases and notices">
      <p className="text-[#8a9a90]">
        Placeholder documents — leases, notices, and templates will render here. No document editor
        integration yet.
      </p>
    </DepartmentPanelFrame>
  );
}
