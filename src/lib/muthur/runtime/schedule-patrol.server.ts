import { getMuthurPersistentRuntime } from "./persistent-runtime.server";

/** Fire-and-forget: queue a health patrol after Agent coding verify passes. */
export function schedulePostCodingVerifyPatrol(touchedPaths: string[]): void {
  void (async () => {
    try {
      const runtime = getMuthurPersistentRuntime();
      await runtime.enqueueTask({
        kind: "patrol",
        label: `post-coding-verify-${Date.now()}`,
        source: "coding_verify",
        metadata: { touched_paths: touchedPaths },
      });
    } catch (error) {
      console.warn("[muthur-runtime] post-coding patrol schedule failed:", error);
    }
  })();
}
