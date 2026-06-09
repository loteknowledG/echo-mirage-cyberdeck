/** Read-only snapshot of the MUTHUR/ECHO deck surface for Pi context. */

export type MuthurScreenChatLine = {
  role: "user" | "assistant" | "system" | "error";
  label: string;
  text: string;
};

export type MuthurScreenSnapshot = {
  capturedAt: string;
  activeServer: string | null;
  activeCustomTab: string | null;
  chat: MuthurScreenChatLine[];
  streamingMuthur: string | null;
  operator: {
    surfaceMode: "workspace" | "browser";
    fileName: string | null;
    filePath: string | null;
    previewSurface: string | null;
    docMode: "view" | "edit" | null;
    documentText: string | null;
  } | null;
  browserUrl: string | null;
};

const CHAT_LINE_LIMIT = 16;
const DOCUMENT_CHAR_LIMIT = 6000;

let latestSnapshot: MuthurScreenSnapshot | null = null;

export function setMuthurScreenSnapshot(snapshot: MuthurScreenSnapshot): void {
  latestSnapshot = snapshot;
  if (typeof window !== "undefined") {
    window.echoMirageMuthurScreenSnapshot = () => latestSnapshot;
  }
}

export function readMuthurScreenSnapshot(): MuthurScreenSnapshot | null {
  if (typeof window !== "undefined" && window.echoMirageMuthurScreenSnapshot) {
    return window.echoMirageMuthurScreenSnapshot();
  }
  return latestSnapshot;
}

export function formatMuthurScreenContextForPi(snapshot: MuthurScreenSnapshot | null): string {
  if (!snapshot) {
    return "\n\nMUTHUR screen snapshot: unavailable (open the cyberdeck ECHO/MUTHUR panes first).";
  }

  const lines: string[] = [
    "\n\n--- MUTHUR screen (read-only) ---",
    `Captured: ${snapshot.capturedAt}`,
  ];

  if (snapshot.activeServer) {
    lines.push(`Active server rail: ${snapshot.activeServer}`);
  }
  if (snapshot.activeCustomTab) {
    lines.push(`Active MIRAGE tab: ${snapshot.activeCustomTab}`);
  }

  if (snapshot.chat.length > 0) {
    lines.push("", "ECHO chat (recent):");
    for (const entry of snapshot.chat.slice(-CHAT_LINE_LIMIT)) {
      const body = entry.text.trim();
      if (!body) continue;
      lines.push(`[${entry.label}] ${body}`);
    }
  } else {
    lines.push("", "ECHO chat: (empty)");
  }

  if (snapshot.streamingMuthur?.trim()) {
    lines.push("", `[MUTHUR] (streaming) ${snapshot.streamingMuthur.trim()}`);
  }

  if (snapshot.operator) {
    const op = snapshot.operator;
    lines.push("", "Operator pane:");
    if (op.surfaceMode === "browser") {
      lines.push("- Mode: live web browser");
      if (snapshot.browserUrl) lines.push(`- URL: ${snapshot.browserUrl}`);
    } else if (op.fileName) {
      lines.push(`- File: ${op.fileName}`);
      if (op.previewSurface) lines.push(`- Surface: ${op.previewSurface}`);
      if (op.filePath) lines.push(`- Path: ${op.filePath}`);
      if (op.docMode) lines.push(`- Editor mode: ${op.docMode}`);
      const doc = op.documentText?.trim();
      if (doc) {
        const excerpt =
          doc.length > DOCUMENT_CHAR_LIMIT
            ? `${doc.slice(0, DOCUMENT_CHAR_LIMIT)}\n… [truncated]`
            : doc;
        lines.push("", "Open document text:", excerpt);
      }
    } else {
      lines.push("- No document open");
    }
  }

  lines.push(
    "",
    "You are Pi inside the same cyberdeck. Use this snapshot to answer questions about what MUTHUR and the operator are looking at. You cannot run MUTHUR tools from here.",
    "--- end MUTHUR screen ---",
  );

  return lines.join("\n");
}

declare global {
  interface Window {
    echoMirageMuthurScreenSnapshot?: () => MuthurScreenSnapshot | null;
  }
}
