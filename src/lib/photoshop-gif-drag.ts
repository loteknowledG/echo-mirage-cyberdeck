/** Prepare animated GIF for HTML5 drag-out (desktop apps + Photos web). */

export function normalizeGifDragFileName(name: string): string {
  const trimmed = name.trim() || "export.gif";
  return /\.gif$/i.test(trimmed) ? trimmed : `${trimmed}.gif`;
}

export function normalizeGifDragFile(file: File): File {
  const name = normalizeGifDragFileName(file.name);
  if (file.type === "image/gif") return file;
  return new File([file], name, { type: "image/gif", lastModified: file.lastModified });
}

export async function readGifDragFile(file: File): Promise<File> {
  const buffer = await file.arrayBuffer();
  return new File([buffer], normalizeGifDragFileName(file.name), {
    type: "image/gif",
    lastModified: file.lastModified,
  });
}

export function setGifDragTransfer(dataTransfer: DataTransfer, file: File): void {
  const gifFile = normalizeGifDragFile(file);
  dataTransfer.effectAllowed = "copy";
  dataTransfer.dropEffect = "copy";
  dataTransfer.clearData();
  dataTransfer.items.clear();
  dataTransfer.items.add(gifFile);
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}
