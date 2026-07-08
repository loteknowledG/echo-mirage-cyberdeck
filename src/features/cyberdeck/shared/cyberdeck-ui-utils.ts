import { textForMuthurSpeech } from "@/lib/muthur-speech-text";

export function contextMenuTargetIsTextField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return Boolean(target.closest("input, textarea, select"));
}

export function textForSpeech(value: string) {
  return textForMuthurSpeech(value);
}
