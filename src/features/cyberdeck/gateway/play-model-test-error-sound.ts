import {
  playDeckDeclined,
  playDeckDroidDizzy400,
  playDeckDroidDizzy401,
  playDeckOutOfGas429,
  playDeckRaceReadySetGo,
  playDeckWrongDoorShut,
} from "@/features/cyberdeck/runtime/defer-deck-audio";

export function playModelTestErrorSound(line: string): void {
  if (line.includes("VALID_RESPONSE")) {
    playDeckRaceReadySetGo();
    return;
  }
  if (line.includes("HTTP_401")) {
    playDeckDroidDizzy401();
    return;
  }
  if (line.includes("HTTP_400")) {
    playDeckDroidDizzy400();
    return;
  }
  if (line.includes("HTTP_429")) {
    playDeckOutOfGas429();
    return;
  }
  if (line.includes("EMPTY_PROBE")) {
    playDeckDeclined();
    return;
  }
  if (line.includes("FAILURE")) {
    playDeckWrongDoorShut();
  }
}
