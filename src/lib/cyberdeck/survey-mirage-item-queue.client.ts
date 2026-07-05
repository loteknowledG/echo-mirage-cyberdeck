"use client";

import {
  SURVEY_MISSION_SOLVE_EVENT,
  SURVEY_SILENT_CAPTURE_PROMPT,
  type SurveyMissionKind,
} from "@/lib/cyberdeck/powerfist-mission.types";
import { appendSurveyChatMessage, notifySurveyMuthurArchive } from "@/lib/cyberdeck/survey-chat";
import { SURVEY_LAST_CAPTURE_EVENT } from "@/lib/cyberdeck/survey-deck-command.client";

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

export function answerCurrentMirageItem(): { ok: boolean; message: string } {
  const { current, index, items } = getMirageQueueSnapshot();
  if (!current) {
    return { ok: false, message: "No item to answer — queue is empty." };
  }
  if (!current.imageDataUrl && !current.imageRef) {
    return { ok: false, message: "Current item has no image — capture or copy from Echo first." };
  }

  const imageDataUrl =
    current.imageDataUrl ?? loadCaptureImage(current.imageRef ?? current.id);
  if (!imageDataUrl) {
    return { ok: false, message: "Current item image missing from storage — capture again." };
  }

  const prompt =
    current.transcript?.trim() ||
    current.prompt ||
    SURVEY_SILENT_CAPTURE_PROMPT;

  window.dispatchEvent(
    new CustomEvent(SURVEY_MISSION_SOLVE_EVENT, {
      detail: {
        missionId: current.id,
        kind: "silent-capture-solve" satisfies SurveyMissionKind,
        imageDataUrl,
        prompt,
      },
    }),
  );

  return {
    ok: true,
    message: `Answering item ${index + 1}/${items.length} via MUTHUR…`,
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

  const onCapture = (event: Event) => {
    const pngBase64 = (event as CustomEvent<{ pngBase64?: string }>).detail?.pngBase64;
    if (!pngBase64) return;
    ingestMirageQueueItem({
      title: "Echo capture",
      prompt: SURVEY_SILENT_CAPTURE_PROMPT,
      imageDataUrl: `data:image/png;base64,${pngBase64}`,
      source: "capture",
    });
  };

  window.addEventListener(SURVEY_LAST_CAPTURE_EVENT, onCapture);

  return () => {
    window.removeEventListener(SURVEY_LAST_CAPTURE_EVENT, onCapture);
  };
}
