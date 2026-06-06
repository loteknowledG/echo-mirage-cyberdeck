import { DepartmentPanelFrame } from "@/extensions/property-management/components/department-panel-frame";

export function MaintenancePanel() {
  return (
    <DepartmentPanelFrame departmentLabel="MAINTENANCE" title="Work orders">
      <p className="text-[#8a9a90]">
        Placeholder maintenance queue — tickets, vendors, and SLA timers will render here.
      </p>
    </DepartmentPanelFrame>
  );
}
