import { DepartmentPanelFrame } from "@/extensions/property-management/components/department-panel-frame";

export function LeasingPanel() {
  return (
    <DepartmentPanelFrame departmentLabel="LEASING" title="Pipeline and tours">
      <p className="text-[#8a9a90]">
        Placeholder leasing desk — applicants, tours, and lease drafts will render here.
      </p>
    </DepartmentPanelFrame>
  );
}
