import { CyberdeckPageClient } from "./cyberdeck-page-client";

/** Route shell — heavy runtime loads from cyberdeck-app async chunk. */
export default function CyberdeckPage() {
  return <CyberdeckPageClient />;
}
