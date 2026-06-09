import type { MuthurOperatorOpenFileRef } from "@/lib/muthur-core/types";

export function extractOperatorOpenRef(output: unknown): MuthurOperatorOpenFileRef | null {
  if (!output || typeof output !== "object") return null;
  const record = output as Record<string, unknown>;
  const filePath = typeof record.filePath === "string" ? record.filePath.trim() : "";
  if (!filePath) return null;

  const fileName =
    typeof record.fileName === "string" && record.fileName.trim()
      ? record.fileName.trim()
      : filePath.split(/[/\\]/).pop() || "file.txt";
  const mode = record.mode === "view" ? "view" : "edit";

  return { filePath, fileName, mode };
}

export function parseOperatorOpenJson(raw: string | null | undefined): MuthurOperatorOpenFileRef | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    return extractOperatorOpenRef(parsed);
  } catch {
    return null;
  }
}
