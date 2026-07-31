import type { MuthurScreenSnapshot } from "@/lib/muthur-screen-context";
import type { MuthurObservationSnapshotInput } from "@/lib/muthur/observation/observation-types";

const CONTENT_LIMIT = 8000;

/** Map the live client deck snapshot into a server observation record (Vercel-safe). */
export function buildClientOperatorObservation(
  snapshot: MuthurScreenSnapshot | null,
): MuthurObservationSnapshotInput | null {
  const operator = snapshot?.operator;
  if (!operator?.fileName?.trim()) return null;

  const content = operator.documentText?.trim() ?? "";
  const excerpt = content.length > 200 ? `${content.slice(0, 200)}...` : content || null;
  const ext = operator.fileName.includes(".")
    ? operator.fileName.split(".").pop()?.toLowerCase() ?? null
    : null;

  return {
    route: "/cyberdeck",
    surface: "cyberdeck",
    activeTab: snapshot?.activeCustomTab ?? null,
    activePane: "operator",
    visibleDocument: operator.fileName,
    documentExcerpt: content.slice(0, 800) || null,
    editor: {
      active: operator.docMode === "edit",
      filePath: operator.filePath,
      fileName: operator.fileName,
      fileExtension: ext,
      language: operator.previewSurface,
      content: content.slice(0, CONTENT_LIMIT) || null,
      contentExcerpt: excerpt,
      selectionText: null,
      cursorLine: null,
      cursorColumn: null,
      dirty: false,
      readOnly: operator.docMode !== "edit",
    },
  };
}

/** System prompt block: operator pane state from the client (same turn, no server round-trip). */
export function formatClientDeckContextForMuthur(snapshot: MuthurScreenSnapshot | null): string {
  const operator = snapshot?.operator;
  if (!operator?.fileName?.trim()) return "";

  const lines = [
    "\n\nLive operator pane (client snapshot — authoritative this turn):",
    `File: ${operator.fileName}`,
  ];
  if (operator.filePath) lines.push(`Path: ${operator.filePath}`);
  if (operator.previewSurface) lines.push(`Surface: ${operator.previewSurface}`);
  if (operator.docMode) lines.push(`Mode: ${operator.docMode}`);
  const doc = operator.documentText?.trim();
  if (doc) {
    const excerpt =
      doc.length > 1200 ? `${doc.slice(0, 1200)}\n… [truncated]` : doc;
    lines.push("", "Document excerpt:", excerpt);
  }
  lines.push(
    "When the operator asks about this file, use the path above with localfs cat or open_operator_file — do not claim the pane is empty.",
  );
  return lines.join("\n");
}
