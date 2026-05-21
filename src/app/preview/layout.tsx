import type { ReactNode } from "react";

/** Full-viewport shell so /preview matches preview.html without app chrome bleed */
export default function PreviewLayout({ children }: { children: ReactNode }) {
  return <div className="powerfist-preview-layout">{children}</div>;
}
