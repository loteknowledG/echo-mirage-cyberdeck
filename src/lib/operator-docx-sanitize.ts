/** Strip XML 1.0–illegal control chars from DOCX parts before client-side preview. */

const XML_INVALID_CONTROL = /[\x00-\x08\x0B\x0C\x0E-\x1F]/g;
const DOCX_XML_PATH = /\.xml$/i;

function sanitizeXmlText(text: string): string {
  return text.replace(XML_INVALID_CONTROL, "");
}

/** Word exports sometimes embed form-feed / control chars that break docx-preview XML parsing. */
export async function sanitizeDocxBlobForPreview(blob: Blob): Promise<Blob> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  let changed = false;

  await Promise.all(
    Object.keys(zip.files).map(async (path) => {
      const entry = zip.files[path];
      if (!entry || entry.dir || !DOCX_XML_PATH.test(path)) return;
      const text = await entry.async("string");
      const sanitized = sanitizeXmlText(text);
      if (sanitized === text) return;
      zip.file(path, sanitized);
      changed = true;
    }),
  );

  if (!changed) return blob;
  return zip.generateAsync({
    type: "blob",
    mimeType:
      blob.type || "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}
