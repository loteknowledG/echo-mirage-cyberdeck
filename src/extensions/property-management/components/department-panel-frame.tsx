import type { ReactNode } from "react";

type DepartmentPanelFrameProps = {
  departmentLabel: string;
  title: string;
  children?: ReactNode;
};

export function DepartmentPanelFrame({
  departmentLabel,
  title,
  children,
}: DepartmentPanelFrameProps) {
  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-sm border border-[#25352c] bg-black/80">
      <header className="shrink-0 border-b border-[#25352c] px-4 py-2 font-mono text-[10px] tracking-[0.08em] text-[#8a9a90]">
        <span className="text-emerald-300">{departmentLabel}</span>
        <span className="mx-2 text-[#54605a]">//</span>
        <span>{title}</span>
      </header>
      <div className="min-h-0 flex-1 overflow-auto p-4 font-mono text-sm leading-relaxed text-[#d2ddd7]">
        {children}
      </div>
    </section>
  );
}
