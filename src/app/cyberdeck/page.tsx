"use client";

import dynamic from "next/dynamic";
import { PanelLoader } from "@/features/cyberdeck/panel-loader";

const CyberdeckApp = dynamic(() => import("@/features/cyberdeck/cyberdeck-app"), {
  ssr: false,
  loading: () => <PanelLoader label="CYBERDECK" />,
});

/** Route shell — heavy runtime loads from cyberdeck-app async chunk. */
export default function CyberdeckPage() {
  return <CyberdeckApp />;
}
