"use client";

import { surveyCaptureDataUrl } from "@/lib/cyberdeck/survey-capture-mime";

/** In-session multi-page Echo captures for one multi-screen question. */

export const SURVEY_CAPTURE_STACK_CHANGED_EVENT = "echo-mirage-survey-capture-stack";
export const SURVEY_CAPTURE_STACK_STORAGE_KEY = "echo-mirage-survey-capture-stack-v1";
export const SURVEY_CAPTURE_STACK_MAX = 6;

export type SurveyCaptureStackPage = {
  id: string;
  pngBase64: string;
  at: string;
};

function emitChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(SURVEY_CAPTURE_STACK_CHANGED_EVENT));
}

function readRaw(): SurveyCaptureStackPage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(SURVEY_CAPTURE_STACK_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SurveyCaptureStackPage[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (page) =>
        page &&
        typeof page.id === "string" &&
        typeof page.pngBase64 === "string" &&
        page.pngBase64.trim().length > 0,
    );
  } catch {
    return [];
  }
}

function writeRaw(pages: SurveyCaptureStackPage[]): void {
  if (typeof window === "undefined") return;
  try {
    if (pages.length === 0) {
      window.sessionStorage.removeItem(SURVEY_CAPTURE_STACK_STORAGE_KEY);
    } else {
      window.sessionStorage.setItem(SURVEY_CAPTURE_STACK_STORAGE_KEY, JSON.stringify(pages));
    }
  } catch {
    /* quota — keep memory-only via event consumers reading last write attempt */
  }
  emitChanged();
}

export function readSurveyCaptureStack(): SurveyCaptureStackPage[] {
  return readRaw();
}

export function clearSurveyCaptureStack(): void {
  writeRaw([]);
}

/** Append a screenshot page (keeps newest at end; caps at SURVEY_CAPTURE_STACK_MAX). */
export function pushSurveyCaptureStackPage(pngBase64: string): SurveyCaptureStackPage[] {
  const trimmed = pngBase64.trim();
  if (!trimmed) return readRaw();
  const page: SurveyCaptureStackPage = {
    id: crypto.randomUUID(),
    pngBase64: trimmed,
    at: new Date().toISOString(),
  };
  const next = [...readRaw(), page].slice(-SURVEY_CAPTURE_STACK_MAX);
  writeRaw(next);
  return next;
}

export function removeSurveyCaptureStackPage(pageId: string): SurveyCaptureStackPage[] {
  const next = readRaw().filter((page) => page.id !== pageId);
  writeRaw(next);
  return next;
}

export function surveyCaptureStackAsDataUrls(): string[] {
  return readRaw().map((page) => surveyCaptureDataUrl(page.pngBase64));
}

export function surveyCaptureStackPngList(): string[] {
  return readRaw().map((page) => page.pngBase64);
}
