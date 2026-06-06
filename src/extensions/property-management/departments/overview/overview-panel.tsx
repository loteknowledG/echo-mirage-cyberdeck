import { DepartmentPanelFrame } from "@/extensions/property-management/components/department-panel-frame";

export function OverviewPanel() {
  return (
    <DepartmentPanelFrame departmentLabel="OVERVIEW" title="Portfolio snapshot">
      <p className="text-[#8a9a90]">
        Placeholder overview — portfolio KPIs, alerts, and department shortcuts will render here.
      </p>
      <ul className="mt-4 list-inside list-disc text-[12px] text-[#8a9a90]">
        <li>No database integration</li>
        <li>No MUTHUR integration</li>
        <li>Extension boundary only</li>
      </ul>
    </DepartmentPanelFrame>
  );
}
