/** Deferred audio/voice synthesis graph — import only via dynamic import(). */

export {
  bindKeyboardSfx,
  unlockKeyboardSfx,
  playMemorizeKeySound,
  playNavigationSound,
  playSystemSound,
  startSonarLoop,
  stopSonarLoop,
  startUplinkSonarPingLoop,
  stopUplinkSonarPingLoop,
  setUplinkSonarVolume,
  getUplinkSonarVolume,
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
