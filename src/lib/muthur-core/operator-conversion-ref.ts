import type { MuthurOperatorConversionRef } from "@/lib/muthur-core/types";

export function extractOperatorConversionRef(output: unknown): MuthurOperatorConversionRef | null {
  if (!output || typeof output !== "object") return null;
  const record = output as Record<string, unknown>;
  const sourcePath = typeof record.sourcePath === "string" ? record.sourcePath.trim() : "";
  if (!sourcePath) return null;

  const outputPath = typeof record.outputPath === "string" ? record.outputPath.trim() : "";
  const outputName =
    outputPath.split(/[/\\]/).pop() ||
    sourcePath.replace(/\.(pdf|docx)$/i, ".md").split(/[/\\]/).pop() ||
    "converted.md";

  return { sourcePath, outputPath, outputName };
}

export function parseOperatorConversionJson(raw: string | null | undefined): MuthurOperatorConversionRef | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    return extractOperatorConversionRef(parsed);
  } catch {
    return null;
  }
}
