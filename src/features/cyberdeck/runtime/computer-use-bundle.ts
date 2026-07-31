/** Deferred computer-use graph — import only via dynamic import(). */

export {
  detectSelfStatusIntent,
  detectInspectIntent,
  detectObserveIntent,
  detectStopObserveIntent,
  detectPauseObserveIntent,
  detectResumeObserveIntent,
} from "@/lib/computer-use/intent-detect";

export { formatStatusText } from "@/lib/computer-use/introspection";

export { runComputerUseAction as runComputerUseBridgeAction } from "@/lib/computer-use/electron-computer-use-bridge";

export { resolveUiTarget } from "@/lib/computer-use/ui-alias-registry";

export { addNarrationListener, narrate } from "@/lib/computer-use/narration";

export { isTeachingDemoTrigger, runTeachingDemo } from "@/lib/computer-use/guided-teaching";

export {
  emergencyStop,
  acknowledgeWatchdog,
  cancelTeachingWatchdog,
  resumeAfterStop,
} from "@/lib/computer-use/teardown";

export { formatSurfaceResponse } from "@/lib/computer-use/surface-classifier";

export {
  setLastSurfaceClassification,
  getLastSurfaceClassification,
  clearSurfaceInspection,
} from "@/lib/computer-use/inspect-layer";

export type { CanonicalTarget } from "@/lib/computer-use/ui-alias-registry";
