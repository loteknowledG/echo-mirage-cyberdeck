import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "System",
  robots: { index: false, follow: false },
};

export default function CapturePairLayout({ children }: { children: ReactNode }) {
  return children;
}
