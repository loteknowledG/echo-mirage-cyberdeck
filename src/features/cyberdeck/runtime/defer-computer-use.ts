type ComputerUseBundle = typeof import("./computer-use-bundle");

let computerUsePromise: Promise<ComputerUseBundle> | null = null;

/** Lazy-load the deferred computer-use graph. */
export function loadComputerUse(): Promise<ComputerUseBundle> {
  computerUsePromise ??= import("./computer-use-bundle");
  return computerUsePromise;
}

/** Cheap gate before pulling the computer-use chunk during chat send. */
export function messageMayUseComputerUse(message: string): boolean {
  const text = message.toLowerCase().trim();
  return /\b(status report|inspect|teaching demo|indicate|highlight|indicators?|pointers?|markers?)\b/i.test(
    text,
  );
}
