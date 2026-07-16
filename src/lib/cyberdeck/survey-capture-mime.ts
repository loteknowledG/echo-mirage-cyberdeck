/** Wire field is still `pngBase64`; payload may be JPEG after Echo compresses for relay. */

export function surveyCaptureMimeFromBase64(base64: string): "image/jpeg" | "image/png" {
  const trimmed = base64.trim();
  // JPEG SOI marker FF D8 FF → base64 "/9j/"
  if (trimmed.startsWith("/9j/")) return "image/jpeg";
  return "image/png";
}

export function surveyCaptureDataUrl(base64: string): string {
  const mime = surveyCaptureMimeFromBase64(base64);
  return `data:${mime};base64,${base64.trim()}`;
}
