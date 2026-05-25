/** Deferred audio/voice synthesis graph — import only via dynamic import(). */

export {
  bindKeyboardSfx,
  unlockKeyboardSfx,
  playNavigationSound,
  playSystemSound,
  startSonarLoop,
  stopSonarLoop,
  playBleepBloop,
  playWrongDoorShut,
  playDeclined,
  playDroidDizzy400,
  playDroidDizzy401,
  playOutOfGas429,
  playRaceReadySetGo,
} from "@/lib/AudioEngine";

export { applyMuthurEffectChain } from "@/voice/effectsChain";
export { speakDryFallback } from "@/voice/speakMuthur";
