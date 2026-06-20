export type PiMissionDetail = {
  missionText?: string;
  task?: string;
};

const GLOBAL_KEY = "__echoMiragePendingPiMission__";

export function queuePiMission(detail: PiMissionDetail): void {
  const globalRef = globalThis as typeof globalThis & {
    [GLOBAL_KEY]?: PiMissionDetail;
  };
  globalRef[GLOBAL_KEY] = detail;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("muthur-pi-mission", { detail }));
  }
}

export function peekPendingPiMission(): PiMissionDetail | null {
  const globalRef = globalThis as typeof globalThis & {
    [GLOBAL_KEY]?: PiMissionDetail;
  };
  const pending = globalRef[GLOBAL_KEY];
  return pending ? { ...pending } : null;
}

export function takePendingPiMission(): PiMissionDetail | null {
  const globalRef = globalThis as typeof globalThis & {
    [GLOBAL_KEY]?: PiMissionDetail;
  };
  const pending = globalRef[GLOBAL_KEY];
  if (pending) {
    delete globalRef[GLOBAL_KEY];
    return { ...pending };
  }
  return null;
}
