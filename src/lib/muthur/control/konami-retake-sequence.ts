export const PI_USER_RETAKE_SEQUENCE = [
  "ArrowLeft",
  "ArrowLeft",
  "ArrowRight",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "ArrowUp",
  "ArrowDown",
] as const;

export type PiRetakeKey = (typeof PI_USER_RETAKE_SEQUENCE)[number];

export function createRetakeSequenceTracker() {
  let index = 0;
  return {
    reset() {
      index = 0;
    },
    push(key: string): boolean {
      const expected = PI_USER_RETAKE_SEQUENCE[index];
      if (key === expected) {
        index += 1;
        if (index >= PI_USER_RETAKE_SEQUENCE.length) {
          index = 0;
          return true;
        }
        return false;
      }
      index = key === PI_USER_RETAKE_SEQUENCE[0] ? 1 : 0;
      return false;
    },
    progress(): number {
      return index;
    },
    label(): string {
      return "← ← → → ↑ ↓ ↑ ↓";
    },
  };
}
