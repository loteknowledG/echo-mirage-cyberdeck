"use client";

import {
  SURVEY_SELECTED_TEXT_PROMPT,
  SURVEY_SILENT_CAPTURE_PROMPT,
} from "@/lib/cyberdeck/powerfist-mission.types";
import {
  analyzeSurveyCaptureClient,
  analyzeSurveySelectionClient,
  surveyImageDataUrlToBase64,
} from "@/lib/cyberdeck/survey-analyze.client";
import {
  beginSurveyAnalyzeStatus,
  completeSurveyAnalyzeStatus,
} from "@/lib/cyberdeck/survey-analyze-status.client";
import { appendSurveyChatMessage, notifySurveyMuthurArchive } from "@/lib/cyberdeck/survey-chat";
import { surveyCaptureStackPngList } from "@/lib/cyberdeck/survey-capture-stack.client";
import {
  readLastSurveyCapture,
  readLastSurveySelection,
  storeLastSurveySelection,
  SURVEY_LAST_CAPTURE_EVENT,
  SURVEY_LAST_CAPTURE_STORAGE_KEY,
  SURVEY_LAST_SELECTION_EVENT,
  SURVEY_LAST_SELECTION_STORAGE_KEY,
} from "@/lib/cyberdeck/survey-deck-command.client";
import {
  appendMirageItemChatLines,
  formatMirageItemDisplayLine,
} from "@/lib/cyberdeck/survey-muthur-mission.client";

export type SurveyMirageQueueItemSource = "capture" | "clipboard" | "mission" | "manual";

export type SurveyMirageQueueItem = {
  id: string;
  title: string;
  prompt: string;
  /** Runtime-only — hydrated from `imageRef` when loaded from storage. */
  imageDataUrl?: string;
  /** Persisted pointer to a capture blob in localStorage (keeps queue JSON small). */
  imageRef?: string;
  answer?: string;
  transcript?: string;
  source: SurveyMirageQueueItemSource;
  createdAt: string;
};

export type SurveyMirageQueueControl =
  | { action: "select"; index: number }
  | { action: "next" }
  | { action: "prev" };

export type SurveyMirageQueueControlSource = "mirage" | "powerfist";

export const SURVEY_MIRAGE_ITEM_CHANGED_EVENT = "echo-mirage:survey-mirage-item-changed";
export const SURVEY_MIRAGE_ITEM_DISPLAY_EVENT = "echo-mirage:survey-mirage-item-display";
export const SURVEY_MIRAGE_QUEUE_CONTROL_EVENT = "echo-mirage:survey-mirage-queue-control";
export const SURVEY_MIRAGE_QUEUE_SYNC_CHANNEL = "echo-mirage-survey-mirage-queue-sync";

const ITEMS_STORAGE_KEY = "echo-mirage-survey-mirage-items-v1";
const INDEX_STORAGE_KEY = "echo-mirage-survey-mirage-item-index-v1";
const CAPTURE_IMAGE_PREFIX = "echo-mirage-survey-capture-img:";
const LEGACY_SESSION_ITEMS_KEY = ITEMS_STORAGE_KEY;
const LEGACY_SESSION_INDEX_KEY = INDEX_STORAGE_KEY;

let migratedSessionQueue = false;

type SpeechRecognitionResultLike = {
  results: ArrayLike<{ 0: { transcript: string } }>;
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionResultLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

function emitChanged(source?: SurveyMirageQueueControlSource): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(SURVEY_MIRAGE_ITEM_CHANGED_EVENT, {
      detail: { source: source ?? null },
    }),
  );
}

function broadcastQueueRefresh(): void {
  if (typeof window === "undefined" || !("BroadcastChannel" in window)) return;
  const channel = new BroadcastChannel(SURVEY_MIRAGE_QUEUE_SYNC_CHANNEL);
  channel.postMessage({ type: "refresh" });
  channel.close();
}

function persistCaptureImage(itemId: string, imageDataUrl: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(`${CAPTURE_IMAGE_PREFIX}${itemId}`, imageDataUrl);
    return true;
  } catch {
    return false;
  }
}

function loadCaptureImage(itemId: string): string | undefined {
  if (typeof window === "undefined") return undefined;
  return window.localStorage.getItem(`${CAPTURE_IMAGE_PREFIX}${itemId}`) ?? undefined;
}

function hydrateQueueItem(item: SurveyMirageQueueItem): SurveyMirageQueueItem {
  if (item.imageDataUrl) return item;
  const ref = item.imageRef ?? item.id;
  const imageDataUrl = loadCaptureImage(ref);
  return imageDataUrl ? { ...item, imageDataUrl } : item;
}

function serializeQueueItem(item: SurveyMirageQueueItem): SurveyMirageQueueItem {
  if (!item.imageDataUrl) {
    const { imageDataUrl: _drop, ...rest } = item;
    return rest;
  }
  const stored = persistCaptureImage(item.id, item.imageDataUrl);
  if (!stored) {
    notifySurveyMuthurArchive(
      "SURVEY // Mirage queue · capture image too large for local storage — try Display Item on Mirage after freeing space.",
    );
    const { imageDataUrl: _drop, ...rest } = item;
    return rest;
  }
  const { imageDataUrl: _drop, ...rest } = item;
  return { ...rest, imageRef: item.id };
}

function migrateSessionQueueToLocalStorage(): void {
  if (typeof window === "undefined" || migratedSessionQueue) return;
  migratedSessionQueue = true;
  try {
    const legacyItems = window.sessionStorage.getItem(LEGACY_SESSION_ITEMS_KEY);
    const legacyIndex = window.sessionStorage.getItem(LEGACY_SESSION_INDEX_KEY);
    if (!legacyItems && !legacyIndex) return;
    if (!window.localStorage.getItem(ITEMS_STORAGE_KEY) && legacyItems) {
      window.localStorage.setItem(ITEMS_STORAGE_KEY, legacyItems);
    }
    if (!window.localStorage.getItem(INDEX_STORAGE_KEY) && legacyIndex) {
      window.localStorage.setItem(INDEX_STORAGE_KEY, legacyIndex);
    }
    window.sessionStorage.removeItem(LEGACY_SESSION_ITEMS_KEY);
    window.sessionStorage.removeItem(LEGACY_SESSION_INDEX_KEY);
  } catch {
    /* ignore */
  }
}

function readItems(): SurveyMirageQueueItem[] {
  if (typeof window === "undefined") return [];
  migrateSessionQueueToLocalStorage();
  try {
    const raw = window.localStorage.getItem(ITEMS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SurveyMirageQueueItem[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map(hydrateQueueItem);
  } catch {
    return [];
  }
}

function writeItems(items: SurveyMirageQueueItem[], options?: { sync?: boolean }): void {
  if (typeof window === "undefined") return;
  try {
    const serialized = items.map(serializeQueueItem);
    window.localStorage.setItem(ITEMS_STORAGE_KEY, JSON.stringify(serialized));
  } catch {
    notifySurveyMuthurArchive("SURVEY // Mirage queue · could not save item list (storage full).");
    return;
  }
  emitChanged();
  if (options?.sync !== false) {
    broadcastQueueRefresh();
  }
}

function readIndex(): number {
  if (typeof window === "undefined") return 0;
  migrateSessionQueueToLocalStorage();
  try {
    const raw = window.localStorage.getItem(INDEX_STORAGE_KEY);
    const value = Number(raw);
    return Number.isFinite(value) && value >= 0 ? value : 0;
  } catch {
    return 0;
  }
}

function writeIndex(index: number, source?: SurveyMirageQueueControlSource): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(INDEX_STORAGE_KEY, String(index));
  } catch {
    return;
  }
  emitChanged(source);
  broadcastQueueRefresh();
}

/** Listen on Survey panes so Mirage + PowerFist windows stay in sync. */
export function subscribeMirageQueueStorage(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;

  const onStorage = (event: StorageEvent) => {
    if (event.key !== ITEMS_STORAGE_KEY && event.key !== INDEX_STORAGE_KEY) return;
    onChange();
  };

  let syncChannel: BroadcastChannel | null = null;
  if ("BroadcastChannel" in window) {
    syncChannel = new BroadcastChannel(SURVEY_MIRAGE_QUEUE_SYNC_CHANNEL);
    syncChannel.onmessage = (event: MessageEvent<{ type?: string }>) => {
      if (event.data?.type === "refresh") onChange();
    };
  }

  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener("storage", onStorage);
    syncChannel?.close();
  };
}

function clampIndex(index: number, total: number): number {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(index, total - 1));
}

function summarizeItem(item: SurveyMirageQueueItem): string {
  const bits = [item.title];
  if (item.transcript?.trim()) bits.push("transcript");
  if (item.imageDataUrl || item.imageRef) bits.push("image");
  return bits.join(" · ");
}

export function resolveMirageQueueItemImage(item: SurveyMirageQueueItem): string | null {
  if (item.imageDataUrl?.trim()) return item.imageDataUrl;
  const ref = item.imageRef ?? item.id;
  return loadCaptureImage(ref) ?? null;
}

export function getMirageQueueDebugSnapshot(): {
  itemCount: number;
  index: number;
  items: Array<{ id: string; title: string; hasImage: boolean; imageBytes: number | null }>;
  captureBlobKeys: number;
} {
  const { items, index } = getMirageQueueSnapshot();
  const captureBlobKeys =
    typeof window === "undefined"
      ? 0
      : Object.keys(window.localStorage).filter((key) => key.startsWith(CAPTURE_IMAGE_PREFIX))
          .length;
  return {
    itemCount: items.length,
    index,
    items: items.map((item) => {
      const image = resolveMirageQueueItemImage(item);
      return {
        id: item.id.slice(0, 8),
        title: item.title,
        hasImage: Boolean(image),
        imageBytes: image ? Math.round((image.length * 3) / 4) : null,
      };
    }),
    captureBlobKeys,
  };
}

export function getMirageQueueSnapshot(): {
  items: SurveyMirageQueueItem[];
  index: number;
  current: SurveyMirageQueueItem | null;
} {
  const items = readItems();
  const index = clampIndex(readIndex(), items.length);
  return { items, index, current: items[index] ?? null };
}

export function ingestMirageQueueItem(input: {
  title?: string;
  prompt?: string;
  imageDataUrl?: string;
  source?: SurveyMirageQueueItemSource;
  select?: boolean;
}): SurveyMirageQueueItem {
  const items = readItems();
  const item: SurveyMirageQueueItem = {
    id: crypto.randomUUID(),
    title: input.title?.trim() || `Item ${items.length + 1}`,
    prompt: input.prompt?.trim() || SURVEY_SILENT_CAPTURE_PROMPT,
    imageDataUrl: input.imageDataUrl,
    source: input.source ?? "capture",
    createdAt: new Date().toISOString(),
  };
  const next = [...items, item];
  writeItems(next);
  if (input.select !== false) {
    writeIndex(next.length - 1);
  }
  notifySurveyMuthurArchive(
    `SURVEY // Mirage item queue · ${next.length} total · ${summarizeItem(item)}`,
  );
  return item;
}

export function selectMirageQueueIndex(
  index: number,
  source: SurveyMirageQueueControlSource = "mirage",
): {
  ok: boolean;
  message: string;
  item: SurveyMirageQueueItem | null;
} {
  const items = readItems();
  if (items.length === 0) {
    return { ok: false, message: "No items in queue.", item: null };
  }
  const nextIndex = clampIndex(index, items.length);
  writeIndex(nextIndex, source);
  const item = items[nextIndex] ?? null;
  return {
    ok: true,
    message: item
      ? `Selected item ${nextIndex + 1}/${items.length} — ${summarizeItem(item)}`
      : `Selected item ${nextIndex + 1}/${items.length}`,
    item,
  };
}

export function applyMirageQueueControl(
  control: SurveyMirageQueueControl,
  source: SurveyMirageQueueControlSource,
  options?: { broadcast?: boolean },
): {
  ok: boolean;
  message: string;
  item: SurveyMirageQueueItem | null;
} {
  let result: { ok: boolean; message: string; item: SurveyMirageQueueItem | null };
  switch (control.action) {
    case "next":
      result = navigateMirageQueue(1, source);
      break;
    case "prev":
      result = navigateMirageQueue(-1, source);
      break;
    case "select":
      result = selectMirageQueueIndex(control.index, source);
      break;
    default: {
      const _exhaustive: never = control;
      return { ok: false, message: `Unknown control: ${String(_exhaustive)}`, item: null };
    }
  }

  if (result.ok && options?.broadcast !== false && typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(SURVEY_MIRAGE_QUEUE_CONTROL_EVENT, {
        detail: { control, source, local: true },
      }),
    );
  }

  return result;
}

export function navigateMirageQueue(
  delta: -1 | 1,
  source: SurveyMirageQueueControlSource = "powerfist",
): {
  ok: boolean;
  message: string;
  item: SurveyMirageQueueItem | null;
} {
  const items = readItems();
  if (items.length === 0) {
    return { ok: false, message: "No items yet — capture from Echo Deck first.", item: null };
  }
  const nextIndex = clampIndex(readIndex() + delta, items.length);
  writeIndex(nextIndex, source);
  const item = items[nextIndex] ?? null;
  return {
    ok: true,
    message: item
      ? `Item ${nextIndex + 1}/${items.length} — ${summarizeItem(item)}`
      : `Item ${nextIndex + 1}/${items.length}`,
    item,
  };
}

export function displayCurrentMirageItem(): { ok: boolean; message: string } {
  const { current, index, items } = getMirageQueueSnapshot();
  if (!current) {
    return { ok: false, message: "No item to display — queue is empty." };
  }
  window.dispatchEvent(
    new CustomEvent(SURVEY_MIRAGE_ITEM_DISPLAY_EVENT, {
      detail: current,
    }),
  );
  appendSurveyChatMessage({
    role: "system",
    text: `SURVEY // DISPLAY // item ${index + 1}/${items.length} — ${current.title}`,
  });
  return {
    ok: true,
    message: `Displaying item ${index + 1}/${items.length} in operator pane.`,
  };
}

function setMirageQueueItemAnswer(itemId: string, answer: string): void {
  const items = readItems();
  const index = items.findIndex((item) => item.id === itemId);
  if (index < 0) return;
  const next = [...items];
  next[index] = { ...next[index], answer: answer.trim() };
  writeItems(next);
}

function attachImageToMirageQueueItem(
  itemId: string,
  imageDataUrl: string,
): SurveyMirageQueueItem | null {
  const items = readItems();
  const index = items.findIndex((entry) => entry.id === itemId);
  if (index < 0) return null;
  const next = [...items];
  next[index] = { ...next[index], imageDataUrl };
  writeItems(next);
  return next[index] ?? null;
}

export type MiragePreviewContent =
  | {
      kind: "image";
      imageDataUrl: string;
      prompt: string;
      item: SurveyMirageQueueItem | null;
    }
  | {
      kind: "text";
      selectionText: string;
      prompt: string;
      item: SurveyMirageQueueItem | null;
    };

function resolveItemPrompt(item: SurveyMirageQueueItem): string {
  return item.transcript?.trim() || item.prompt?.trim() || SURVEY_SILENT_CAPTURE_PROMPT;
}

function resolveTextOnlyItem(item: SurveyMirageQueueItem): string | null {
  if (resolveMirageQueueItemImage(item)) return null;
  const text = resolveItemPrompt(item);
  if (text === SURVEY_SILENT_CAPTURE_PROMPT && item.source !== "clipboard") return null;
  return text;
}

export function resolveMiragePreviewContent(): MiragePreviewContent | null {
  const { current } = getMirageQueueSnapshot();

  if (current) {
    const imageDataUrl = resolveMirageQueueItemImage(current);
    if (imageDataUrl) {
      return {
        kind: "image",
        imageDataUrl,
        prompt: resolveItemPrompt(current),
        item: current,
      };
    }
    const selectionText = resolveTextOnlyItem(current);
    if (selectionText) {
      return {
        kind: "text",
        selectionText,
        prompt: selectionText,
        item: current,
      };
    }
  }

  const lastSelection = readLastSurveySelection();
  if (lastSelection?.text) {
    return {
      kind: "text",
      selectionText: lastSelection.text,
      prompt: lastSelection.text,
      item: current,
    };
  }

  const last = readLastSurveyCapture();
  if (last?.pngBase64) {
    return {
      kind: "image",
      imageDataUrl: `data:image/png;base64,${last.pngBase64}`,
      prompt: current ? resolveItemPrompt(current) : SURVEY_SILENT_CAPTURE_PROMPT,
      item: current,
    };
  }

  return null;
}

export function resolveMiragePreviewCapture(): {
  imageDataUrl: string;
  prompt: string;
  item: SurveyMirageQueueItem | null;
} | null {
  const preview = resolveMiragePreviewContent();
  if (!preview || preview.kind !== "image") return null;
  return preview;
}

function ensureMirageQueueItemForCapture(capture: {
  imageDataUrl: string;
  prompt: string;
  item: SurveyMirageQueueItem | null;
}): SurveyMirageQueueItem {
  if (capture.item) {
    const existing = resolveMirageQueueItemImage(capture.item);
    if (existing) return capture.item;
    const attached = attachImageToMirageQueueItem(capture.item.id, capture.imageDataUrl);
    if (attached) return attached;
  }

  return ingestMirageQueueItem({
    title: "Echo capture",
    prompt: capture.prompt,
    imageDataUrl: capture.imageDataUrl,
    source: "capture",
  });
}

export function answerCurrentMirageItem(): { ok: boolean; message: string } {
  void answerCurrentMirageItemAsync();
  return { ok: true, message: "Analyzing current item via Codex…" };
}

export async function answerCurrentMirageItemAsync(): Promise<{ ok: boolean; message: string }> {
  return solveMirageCaptureAsync();
}

/** Run vision on the capture stack (multi-page) or current preview capture. */
export async function solveMirageCaptureAsync(): Promise<{ ok: boolean; message: string }> {
  const stackPngs = surveyCaptureStackPngList();
  const capture = resolveMiragePreviewCapture();

  if (stackPngs.length === 0 && !capture) {
    return {
      ok: false,
      message: "No capture to solve — take a screenshot first.",
    };
  }

  const imageDataUrl =
    capture?.imageDataUrl ??
    (stackPngs.length > 0 ? `data:image/png;base64,${stackPngs[stackPngs.length - 1]}` : "");
  const multiPage = stackPngs.length > 1;
  const prompt = multiPage
    ? "These screenshots are consecutive pages of one question or problem (page 1 first). Read every page in order, reconstruct the full problem, then solve it. Be concise and actionable."
    : capture?.prompt || SURVEY_SILENT_CAPTURE_PROMPT;

  const item = ensureMirageQueueItemForCapture({
    imageDataUrl,
    prompt,
    item: capture?.item ?? null,
  });
  const { index, items } = getMirageQueueSnapshot();
  const itemIndex = items.findIndex((entry) => entry.id === item.id);
  const displayIndex = itemIndex >= 0 ? itemIndex : index;
  const pageLabel = multiPage ? ` · ${stackPngs.length} pages` : "";

  appendSurveyChatMessage({
    role: "system",
    text: `SURVEY // ANALYZE // item ${displayIndex + 1}/${items.length}${pageLabel}…`,
  });
  appendSurveyChatMessage({ role: "user", text: prompt });

  beginSurveyAnalyzeStatus({
    itemId: item.id,
    itemIndex: displayIndex,
    itemTotal: items.length,
    provider: "auto",
  });

  const pngBase64List =
    stackPngs.length > 0
      ? stackPngs
      : [surveyImageDataUrlToBase64(imageDataUrl)];

  const result = await analyzeSurveyCaptureClient({
    pngBase64: pngBase64List[0],
    pngBase64List,
    prompt,
    provider: "auto",
  });

  if (!result.ok) {
    completeSurveyAnalyzeStatus({ ok: false, error: result.error });
    appendSurveyChatMessage({
      role: "system",
      text: `SURVEY // ANALYZE FAILED // ${result.error}`,
    });
    return { ok: false, message: result.error };
  }

  setMirageQueueItemAnswer(item.id, result.text);
  completeSurveyAnalyzeStatus({
    ok: true,
    resultText: result.text,
    provider: result.provider,
  });
  appendSurveyChatMessage({ role: "assistant", text: result.text });
  notifySurveyMuthurArchive(
    `SURVEY // SOLVED // item ${displayIndex + 1}/${items.length}${pageLabel} (${result.provider})`,
  );

  return {
    ok: true,
    message: multiPage
      ? `Answered ${stackPngs.length} pages via ${result.provider}.`
      : `Answered item ${displayIndex + 1}/${items.length} via ${result.provider}.`,
  };
}

/** Run Codex on Echo selected text (no screenshot). */
export async function solveMirageSelectedTextAsync(
  selectedText: string,
): Promise<{ ok: boolean; message: string }> {
  const text = selectedText.trim();
  if (!text) {
    return { ok: false, message: "No selected text to solve." };
  }

  const item = ingestMirageQueueItem({
    title: "Echo selection",
    prompt: text,
    source: "clipboard",
    select: true,
  });

  storeLastSurveySelection(text);

  const { index, items } = getMirageQueueSnapshot();
  const itemIndex = items.findIndex((entry) => entry.id === item.id);
  const displayIndex = itemIndex >= 0 ? itemIndex : index;

  const displayLine = formatMirageItemDisplayLine({ ...item, prompt: text });
  appendMirageItemChatLines({ ...item, prompt: text }, displayLine);
  window.dispatchEvent(
    new CustomEvent(SURVEY_MIRAGE_ITEM_DISPLAY_EVENT, {
      detail: { ...item, prompt: text },
    }),
  );

  appendSurveyChatMessage({
    role: "system",
    text: `SURVEY // STAGED TEXT // item ${displayIndex + 1}/${items.length} · ${text.length} chars from Echo`,
  });
  appendSurveyChatMessage({ role: "user", text });

  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

  appendSurveyChatMessage({
    role: "system",
    text: `SURVEY // ANALYZE TEXT // item ${displayIndex + 1}/${items.length} via Codex CLI…`,
  });

  beginSurveyAnalyzeStatus({
    itemId: item.id,
    itemIndex: displayIndex,
    itemTotal: items.length,
    provider: "codex",
  });

  const result = await analyzeSurveySelectionClient({
    selectionText: text,
    prompt: SURVEY_SELECTED_TEXT_PROMPT,
    provider: "auto",
  });

  if (!result.ok) {
    completeSurveyAnalyzeStatus({ ok: false, error: result.error });
    appendSurveyChatMessage({
      role: "system",
      text: `SURVEY // ANALYZE FAILED // ${result.error}`,
    });
    return { ok: false, message: result.error };
  }

  setMirageQueueItemAnswer(item.id, result.text);
  completeSurveyAnalyzeStatus({
    ok: true,
    resultText: result.text,
    provider: result.provider,
  });
  appendSurveyChatMessage({ role: "assistant", text: result.text });
  notifySurveyMuthurArchive(
    `SURVEY // SOLVED TEXT // item ${displayIndex + 1}/${items.length} (${result.provider})`,
  );

  return {
    ok: true,
    message: `Solved selected text (${text.length} chars) via ${result.provider}.`,
  };
}

export async function runMirageSpeechToTextItem(): Promise<{ ok: boolean; message: string }> {
  const { current, index, items } = getMirageQueueSnapshot();
  if (!current) {
    return { ok: false, message: "No item selected — add a capture first." };
  }

  const windowWithSpeech = window as Window & {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  const SpeechRecognitionCtor =
    windowWithSpeech.SpeechRecognition ?? windowWithSpeech.webkitSpeechRecognition;
  if (!SpeechRecognitionCtor) {
    return { ok: false, message: "Speech-to-text not supported in this browser." };
  }

  return new Promise((resolve) => {
    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    let settled = false;
    const finish = (result: { ok: boolean; message: string }) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim() ?? "";
      if (!transcript) {
        finish({ ok: false, message: "No speech detected." });
        return;
      }
      const queue = readItems();
      const idx = clampIndex(readIndex(), queue.length);
      const target = queue[idx];
      if (!target) {
        finish({ ok: false, message: "Item disappeared from queue." });
        return;
      }
      const updated = { ...target, transcript, prompt: transcript };
      queue[idx] = updated;
      writeItems(queue);
      appendSurveyChatMessage({
        role: "user",
        text: `[STT item ${idx + 1}] ${transcript}`,
      });
      finish({
        ok: true,
        message: `Item ${idx + 1}/${items.length} — "${transcript.slice(0, 100)}${transcript.length > 100 ? "…" : ""}"`,
      });
    };

    recognition.onerror = () => {
      finish({ ok: false, message: "Speech recognition failed — check mic permission." });
    };

    try {
      recognition.start();
    } catch {
      finish({ ok: false, message: "Could not start speech recognition." });
    }
  });
}

/** Wire capture/mission events into the Mirage item queue. */
export function installMirageQueueListeners(): () => void {
  if (typeof window === "undefined") return () => undefined;

  const onCapture = () => {
    emitChanged();
  };

  window.addEventListener(SURVEY_LAST_CAPTURE_EVENT, onCapture);
  window.addEventListener(SURVEY_LAST_SELECTION_EVENT, onCapture);
  window.addEventListener("storage", (event) => {
    if (
      event.key === SURVEY_LAST_CAPTURE_STORAGE_KEY ||
      event.key === SURVEY_LAST_SELECTION_STORAGE_KEY
    ) {
      emitChanged();
    }
  });

  return () => {
    window.removeEventListener(SURVEY_LAST_CAPTURE_EVENT, onCapture);
    window.removeEventListener(SURVEY_LAST_SELECTION_EVENT, onCapture);
  };
}
