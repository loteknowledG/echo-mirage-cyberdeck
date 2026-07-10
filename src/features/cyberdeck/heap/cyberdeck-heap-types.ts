export const HEAP_STORAGE_KEY = "echo-mirage-heap-items";

export type HeapEntry = {
  id: string;
  name: string;
  text: string;
  createdAt: number;
};

type EchoMirageClipboardApi = {
  readText(): string;
  writeText(text: string): void;
};

export async function readEchoMirageClipboardText() {
  const bridge = (window as Window & { echoMirageClipboard?: EchoMirageClipboardApi })
    .echoMirageClipboard;
  if (bridge?.readText) {
    try {
      return bridge.readText();
    } catch {
      /* fall through */
    }
  }

  if (typeof navigator !== "undefined" && navigator.clipboard?.readText) {
    return navigator.clipboard.readText();
  }

  return "";
}
