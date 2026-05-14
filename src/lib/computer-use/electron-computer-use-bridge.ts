import type { ComputerUseAction, ComputerUseResult } from "./computer-use-types";
import { runComputerUseAction as runAction } from "./action-runner";

export interface ElectronComputerUseAPI {
  runAction: (action: unknown) => Promise<unknown>;
  isAvailable: () => boolean;
}

type EchoMirageWindow = Window & {
  echoMirageComputerUse?: ElectronComputerUseAPI;
  echoMirage?: {
    computerUse?: ElectronComputerUseAPI;
  };
};

function isElectronEnvironment(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as EchoMirageWindow;
  return w.echoMirageComputerUse != null || w.echoMirage?.computerUse != null;
}

function getElectronAPI(): ElectronComputerUseAPI | null {
  if (typeof window === "undefined") return null;
  const w = window as EchoMirageWindow;
  if (w.echoMirageComputerUse) return w.echoMirageComputerUse;
  if (w.echoMirage?.computerUse) return w.echoMirage.computerUse;
  return null;
}

function isRendererOnlyAction(action: ComputerUseAction): boolean {
  return (
    action.name === "indicate_point" ||
    action.name === "indicate_highlight" ||
    action.name === "clear_indicators"
  );
}

export async function runComputerUseAction(action: ComputerUseAction): Promise<ComputerUseResult> {
  const electronAPI = getElectronAPI();

  if (!electronAPI?.runAction || isRendererOnlyAction(action)) {
    return runAction(action);
  }

  try {
    const result = await electronAPI.runAction(action);
    return result as ComputerUseResult;
  } catch (error) {
    return {
      success: false,
      action: action.name,
      status: "error",
      error: error instanceof Error ? error.message : "Electron bridge error",
      timestamp: new Date().toISOString(),
      durationMs: 0,
    };
  }
}

export function isElectronBridgeAvailable(): boolean {
  return isElectronEnvironment() && getElectronAPI()?.runAction != null;
}

export function createComputerUseBridge() {
  return {
    runComputerUseAction,
    isElectronBridgeAvailable,
    isElectronEnvironment,
  };
}
