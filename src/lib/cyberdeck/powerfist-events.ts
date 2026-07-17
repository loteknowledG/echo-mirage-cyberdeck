export const POWERFIST_STACK_PUSH_EVENT = "echo-mirage:powerfist-stack-push";
export const POWERFIST_STACK_CHANNEL = "echo-mirage-powerfist-stack";

export type PowerFistStackActor = "operator" | "muthur";

export type PowerFistToolOverride = {
  name: string;
  args?: Record<string, unknown>;
  /** When set, the PowerFist composer field fills this argument key. */
  composerArg?: string;
};

export type PowerFistStackCommand = {
  kind: "powerfist-stack-push";
  actor: PowerFistStackActor;
  card: {
    deckName: string;
    title: string;
    type: string;
  };
  commandId: string;
  message: string;
  toolOverride?: PowerFistToolOverride;
  composerSupplement?: string;
  preparedArtifact?: {
    kind: "figlet" | "oneline";
    value: string;
  };
  targetPane: string;
};
