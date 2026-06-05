import {
  docxFilenameFromMarkdownName,
  pdfFilenameFromMarkdownName,
} from "@/lib/markdown-to-docx-intent";

export function replaceExportFilenameExtension(filename: string, nextExt: string): string {
  const trimmed = filename.trim() || "document";
  const ext = nextExt.startsWith(".") ? nextExt : `.${nextExt}`;
  if (/\.[^.]+$/.test(trimmed)) {
    return trimmed.replace(/\.[^.]+$/, ext);
  }
  return `${trimmed}${ext}`;
}

export function resolveExportDefaultSavePath(options: {
  suggestedFilename: string;
  localFilePath?: string | null;
  format: "pdf" | "docx";
}): { defaultPath?: string; defaultRelativePath: string } {
  const filename =
    options.format === "pdf"
      ? pdfFilenameFromMarkdownName(options.suggestedFilename)
      : docxFilenameFromMarkdownName(options.suggestedFilename);

  const local = options.localFilePath?.trim();
  if (local) {
    return {
      defaultPath: replaceExportFilenameExtension(local, options.format === "pdf" ? ".pdf" : ".docx"),
      defaultRelativePath: `docs/cadre/${filename}`,
    };
  }

  return { defaultRelativePath: `docs/cadre/${filename}` };
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

export type PersistExportBlobResult = {
  filename: string;
  outputPath?: string;
  canceled?: boolean;
};

export async function persistExportBlob(options: {
  blob: Blob;
  filename: string;
  defaultPath?: string;
  defaultRelativePath: string;
}): Promise<PersistExportBlobResult> {
  const saveBridge = window.echoMirageSave;
  if (saveBridge?.showBinaryDialog) {
    const base64 = await blobToBase64(options.blob);
    const result = await saveBridge.showBinaryDialog({
      base64,
      defaultPath: options.defaultPath,
      defaultRelativePath: options.defaultRelativePath,
    });
    if (result.canceled && !result.error) {
      return { filename: options.filename, canceled: true };
    }
    if (result.error) {
      throw new Error(result.error);
    }
    if (result.filePath) {
      const name = result.filePath.split(/[/\\]/).pop() || options.filename;
      return { filename: name, outputPath: result.filePath };
    }
  }

  const url = URL.createObjectURL(options.blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = options.filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  return { filename: options.filename };
}
