/** Shared file → operator document kind detection (operator + document tabs). */

const EDITABLE_TEXT_EXTENSIONS = [
  ".txt",
  ".md",
  ".markdown",
  ".json",
  ".jsonc",
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".css",
  ".scss",
  ".html",
  ".htm",
  ".xml",
  ".yaml",
  ".yml",
  ".sh",
  ".bash",
  ".py",
  ".rb",
  ".go",
  ".rs",
  ".java",
  ".c",
  ".cpp",
  ".h",
  ".hpp",
  ".cs",
  ".php",
  ".sql",
  ".csv",
  ".tsv",
  ".log",
  ".env",
  ".env.local",
  ".env.development",
  ".env.production",
  ".env.example",
];

export type OperatorIngestFileKind =
  | "markdown"
  | "json"
  | "code"
  | "text"
  | "image"
  | "video"
  | "file"
  | "css"
  | "html"
  | "javascript"
  | "typescript"
  | "python"
  | "pdf";

export function isEditableOperatorFile(file: File) {
  const lowerName = file.name.toLowerCase();
  const lowerType = (file.type || "").toLowerCase();
  return (
    lowerType.startsWith("text/") ||
    lowerType === "application/json" ||
    lowerType === "application/xml" ||
    lowerType === "application/javascript" ||
    lowerType === "application/typescript" ||
    lowerType === "application/x-yaml" ||
    lowerName.startsWith(".env") ||
    EDITABLE_TEXT_EXTENSIONS.some((ext) => lowerName.endsWith(ext))
  );
}

export function getOperatorFileKind(file: File): OperatorIngestFileKind {
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith(".md") || lowerName.endsWith(".markdown") || file.type === "text/markdown") {
    return "markdown";
  }
  if (
    lowerName.endsWith(".json") ||
    lowerName.endsWith(".jsonc") ||
    file.type === "application/json"
  ) {
    return "json";
  }
  if (isEditableOperatorFile(file)) {
    return "code";
  }
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  return "file";
}

export function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(typeof reader.result === "string" ? reader.result : "");
    };
    reader.onerror = () => {
      reject(reader.error || new Error("Failed to read file."));
    };
    reader.readAsDataURL(file);
  });
}
