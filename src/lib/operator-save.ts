import { resolveCadreSaveTarget } from "@/lib/cadre-constitutional-routing";
import { deriveOperatorSaveFilename } from "@/lib/operator-markdown-title";
import {
  canSaveOperatorFileInPlace,
  isOperatorFolderPaneFilePath,
  writeFileToFolderRoot,
  type OperatorDocFolderRoot,
} from "@/lib/operator-folder-nav";

export type OperatorSaveIntent = {
  text: string;
  mimeType: string;
  kind: string | undefined;
  suggestedFilename: string;
  suggestedSavePath: string;
  cadreTarget: ReturnType<typeof resolveCadreSaveTarget> | null;
  fileTypes: Array<{
    description?: string;
    accept: Record<string, string[]>;
  }>;
};

export const OPERATOR_SAVE_FILE_TYPES: OperatorSaveIntent["fileTypes"] = [
  {
    description: "All files",
    accept: { "*/*": [".*"] },
  },
  {
    description: "Markdown",
    accept: {
      "text/markdown": [".md", ".markdown"],
    },
  },
  {
    description: "Text",
    accept: {
      "text/plain": [".txt", ".md", ".markdown", ".env", ".env.local", ".json", ".yaml", ".yml"],
    },
  },
];

export function buildOperatorSaveIntent(options: {
  text: string;
  kind: string | undefined;
  mimeType: string;
  currentName?: string;
  headerName?: string;
  /** Logical path when opened from the folder pane (e.g. repo/.env.local). */
  sourceFilePath?: string | null;
  /** @deprecated Use currentName */
  fallbackName?: string;
}): OperatorSaveIntent {
  const { text, kind, mimeType, currentName, headerName, sourceFilePath, fallbackName } = options;
  const cadreTarget =
    kind === "markdown" ? resolveCadreSaveTarget(text, { kind: "markdown" }) : null;
  const sourceFileName = sourceFilePath?.split("/").pop()?.trim();
  const suggestedFilename = deriveOperatorSaveFilename({
    kind,
    text,
    currentName: currentName ?? sourceFileName ?? fallbackName,
    headerName,
  });
  const suggestedSavePath = cadreTarget?.constitutionalPrefix
    ? `${cadreTarget.relativeDirectory}${suggestedFilename}`.replace(/\/{2,}/g, "/")
    : isOperatorFolderPaneFilePath(sourceFilePath)
      ? sourceFilePath
      : suggestedFilename;

  return {
    text,
    mimeType,
    kind,
    suggestedFilename,
    suggestedSavePath,
    cadreTarget,
    fileTypes: OPERATOR_SAVE_FILE_TYPES,
  };
}

export async function saveOperatorFileInPlace(
  filePath: string,
  text: string,
  roots: OperatorDocFolderRoot[],
): Promise<{ ok: boolean; filePath?: string; error?: string }> {
  if (!canSaveOperatorFileInPlace(filePath, roots)) {
    return { ok: false, error: "No saved file path to overwrite." };
  }
  const rootName = filePath.split("/")[0];
  const root = roots.find((entry) => entry.name === rootName);
  if (!root) {
    return { ok: false, error: "Folder root is no longer available." };
  }
  return writeFileToFolderRoot(root, filePath, text);
}

export async function saveViaCadreApi(
  intent: OperatorSaveIntent,
  showErrors = false,
): Promise<boolean> {
  if (!intent.cadreTarget?.constitutionalPrefix) return false;
  try {
    const res = await fetch("/api/cadre-save-doc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        relativePath: intent.suggestedSavePath,
        content: intent.text,
      }),
    });
    const payload = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      path?: string;
      error?: string;
    };
    if (!res.ok || !payload.ok) {
      throw new Error(payload.error || `Cadre save failed (${res.status})`);
    }
    return true;
  } catch (apiErr) {
    if (showErrors) {
      throw apiErr;
    }
    return false;
  }
}

export function downloadOperatorDoc(intent: OperatorSaveIntent): void {
  const blob = new Blob([intent.text], { type: intent.mimeType || "text/plain" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = intent.suggestedFilename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function isPickerAbortError(err: unknown): boolean {
  return (
    err instanceof DOMException && (err.name === "AbortError" || err.code === 20)
  );
}

export { canSaveOperatorFileInPlace };
