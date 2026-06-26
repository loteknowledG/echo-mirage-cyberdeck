type DeckAudioModule = typeof import("@/features/cyberdeck/runtime/deck-audio-bundle");

import { isAudioAllowed, stopAllEchoMirageAudio } from "@/lib/cyberdeck/audio-gate";

let deckAudioPromise: Promise<DeckAudioModule> | null = null;

export function loadDeckAudio(): Promise<DeckAudioModule> {
  deckAudioPromise ??= import("@/features/cyberdeck/runtime/deck-audio-bundle");
  return deckAudioPromise;
}

export function stopAllDeckAudio(): void {
  stopAllEchoMirageAudio();
}

export function playDeckSystemSound(...args: Parameters<DeckAudioModule["playSystemSound"]>) {
  if (!isAudioAllowed()) return;
  void loadDeckAudio().then((audio) => audio.playSystemSound(...args));
}

export function playDeckNavigationSound(...args: Parameters<DeckAudioModule["playNavigationSound"]>) {
  if (!isAudioAllowed()) return;
  void loadDeckAudio().then((audio) => audio.playNavigationSound(...args));
}

export function startDeckSonarLoop(...args: Parameters<DeckAudioModule["startSonarLoop"]>) {
  if (!isAudioAllowed()) return;
  void loadDeckAudio().then((audio) => audio.startSonarLoop(...args));
}

export function stopDeckSonarLoop(...args: Parameters<DeckAudioModule["stopSonarLoop"]>) {
  void loadDeckAudio().then((audio) => audio.stopSonarLoop(...args));
}

export function bindDeckKeyboardSfx(...args: Parameters<DeckAudioModule["bindKeyboardSfx"]>) {
  let unbind: (() => void) | undefined;
  void loadDeckAudio().then((audio) => {
    unbind = audio.bindKeyboardSfx(...args);
  });
  return () => unbind?.();
}

export function playDeckMemorizeKeySound(...args: Parameters<DeckAudioModule["playMemorizeKeySound"]>) {
  if (!isAudioAllowed()) return;
  void loadDeckAudio().then((audio) => audio.playMemorizeKeySound(...args));
}

export function playDeckBleepBloop(...args: Parameters<DeckAudioModule["playBleepBloop"]>) {
  if (!isAudioAllowed()) return;
  void loadDeckAudio().then((audio) => audio.playBleepBloop(...args));
}

export function startDeckUplinkSonarPing(
  ...args: Parameters<DeckAudioModule["startUplinkSonarPingLoop"]>
) {
  if (!isAudioAllowed()) return;
  void loadDeckAudio().then((audio) => audio.startUplinkSonarPingLoop(...args));
}

export function stopDeckUplinkSonarPing(
  ...args: Parameters<DeckAudioModule["stopUplinkSonarPingLoop"]>
) {
  void loadDeckAudio().then((audio) => audio.stopUplinkSonarPingLoop(...args));
}

export function setDeckUplinkSonarVolume(
  ...args: Parameters<DeckAudioModule["setUplinkSonarVolume"]>
) {
  void loadDeckAudio().then((audio) => audio.setUplinkSonarVolume(...args));
}

export function playDeckWrongDoorShut(...args: Parameters<DeckAudioModule["playWrongDoorShut"]>) {
  if (!isAudioAllowed()) return;
  void loadDeckAudio().then((audio) => audio.playWrongDoorShut(...args));
}

export function playDeckDeclined(...args: Parameters<DeckAudioModule["playDeclined"]>) {
  if (!isAudioAllowed()) return;
  void loadDeckAudio().then((audio) => audio.playDeclined(...args));
}

export function playDeckDroidDizzy400(...args: Parameters<DeckAudioModule["playDroidDizzy400"]>) {
  if (!isAudioAllowed()) return;
  void loadDeckAudio().then((audio) => audio.playDroidDizzy400(...args));
}

export function playDeckDroidDizzy401(...args: Parameters<DeckAudioModule["playDroidDizzy401"]>) {
  if (!isAudioAllowed()) return;
  void loadDeckAudio().then((audio) => audio.playDroidDizzy401(...args));
}

export function playDeckOutOfGas429(...args: Parameters<DeckAudioModule["playOutOfGas429"]>) {
  if (!isAudioAllowed()) return;
  void loadDeckAudio().then((audio) => audio.playOutOfGas429(...args));
}

export function playDeckRaceReadySetGo(...args: Parameters<DeckAudioModule["playRaceReadySetGo"]>) {
  if (!isAudioAllowed()) return;
  void loadDeckAudio().then((audio) => audio.playRaceReadySetGo(...args));
}

export function setDeckSfxVolume(
  ...args: Parameters<DeckAudioModule["setDeckSfxVolume"]>
) {
  void loadDeckAudio().then((audio) => audio.setDeckSfxVolume(...args));
}

export function unlockDeckKeyboardSfx() {
  void loadDeckAudio().then((audio) => audio.unlockKeyboardSfx());
}
