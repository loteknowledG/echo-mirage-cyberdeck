export const POWERFIST_STACK_PUSH_EVENT = "echo-mirage:powerfist-stack-push";
export const POWERFIST_STACK_CHANNEL = "echo-mirage-powerfist-stack";

export type PowerFistStackActor = "operator" | "muthur";

export type PowerFistStackCommand = {
  kind: "powerfist-stack-push";
  actor: PowerFistStackActor;
  card: {
    deckName: string;
    risk: string;
    title: string;
    type: string;
  };
  commandId: string;
  message: string;
  preparedArtifact?: {
    kind: "figlet" | "oneline";
    value: string;
  };
  targetPane: string;
};
