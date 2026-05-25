type ComputerUseModule = typeof import("@/features/cyberdeck/runtime/computer-use-bundle");

let computerUsePromise: Promise<ComputerUseModule> | null = null;

export function loadComputerUse(): Promise<ComputerUseModule> {
  computerUsePromise ??= import("@/features/cyberdeck/runtime/computer-use-bundle");
  return computerUsePromise;
}

/** Cheap gate before pulling the computer-use chunk during chat send. */
export function messageMayUseComputerUse(message: string): boolean {
  const text = message.toLowerCase().trim();
  return (
    /\b(status report|inspect|observe|workflow|card table|execution deck|reviewer hand|staged hand|clear deck|push hand|execute|teaching demo|indicate|highlight|indicator|pointer|markers)\b/i.test(
      text,
    ) ||
    /^(yes|no|skip|optional|recovery|record this|ignore this|mark as recovery|yes record|no skip)(?:[.!?])?$/i.test(
      text,
    ) ||
    /^muthur,\s*(yes|no|skip|optional|recovery|record this|ignore this)/i.test(text)
  );
}
