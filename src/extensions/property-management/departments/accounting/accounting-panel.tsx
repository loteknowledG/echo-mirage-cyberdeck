import { DepartmentPanelFrame } from "@/extensions/property-management/components/department-panel-frame";

export function AccountingPanel() {
  return (
    <DepartmentPanelFrame departmentLabel="ACCOUNTING" title="Ledger and charges">
      <p className="text-[#8a9a90]">
        Placeholder accounting — rent rolls, charges, and payouts will render here.
      </p>
    </DepartmentPanelFrame>
  );
}
